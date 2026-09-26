// Mercado Pago (Checkout Pro) — só no servidor, porque usa o MP_ACCESS_TOKEN.
// O valor cobrado é SEMPRE o calculado pelo servidor (api/reservar.js); antes
// vinha do navegador e dava para gerar um link de R$ 1.
import { MIN_JANELA_PAGAMENTO } from '../src/lib/helpers.js';

const API = () => (process.env.MP_API_URL || 'https://api.mercadopago.com').replace(/\/+$/, '');
export const mpConfigurado = () => !!process.env.MP_ACCESS_TOKEN;

// O Mercado Pago quer ISO 8601 com deslocamento explícito.
const isoComOffset = (d) => d.toISOString().replace('Z', '+00:00');

// Corpo da preferência — separado para ser testável sem rede. A janela de
// pagamento fecha no próprio Mercado Pago (ver helpers.js: JANELA < HOLD).
export function montarPreferencia({ reservaId, codigo, hospede, valor, descricao, base, agora = new Date() }) {
  const fim = new Date(agora.getTime() + MIN_JANELA_PAGAMENTO * 60000);
  return {
    items: [{
      title: (descricao || `Sinal da reserva ${codigo || reservaId}`).slice(0, 250),
      quantity: 1,
      currency_id: 'BRL',
      unit_price: Math.round(Number(valor) * 100) / 100,
    }],
    payer: hospede?.email ? { name: hospede?.nome || undefined, email: hospede.email } : undefined,
    external_reference: reservaId,
    back_urls: {
      success: `${base}/?mp=success&reserva=${encodeURIComponent(reservaId)}`,
      pending: `${base}/?mp=pending&reserva=${encodeURIComponent(reservaId)}`,
      failure: `${base}/?mp=failure&reserva=${encodeURIComponent(reservaId)}`,
    },
    auto_return: 'approved',
    notification_url: `${base}/api/mp-webhook`,
    statement_descriptor: 'PINHEIRAMAR',
    expires: true,
    expiration_date_from: isoComOffset(agora),
    expiration_date_to: isoComOffset(fim),
    // Boleto fora: demora dias a compensar, incompatível com uma reserva que
    // segura as datas por minutos.
    payment_methods: { excluded_payment_types: [{ id: 'ticket' }] },
  };
}

export async function criarPreferencia(dados) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return { ok: false, motivo: 'nao_configurado' };
  if (!dados.base) return { ok: false, motivo: 'sem_dominio' };
  if (!(Number(dados.valor) > 0)) return { ok: false, motivo: 'valor_invalido' };
  try {
    const resp = await fetch(`${API()}/checkout/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(montarPreferencia(dados)),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.init_point) {
      console.error('[mercadopago] preferência recusada:', resp.status, data?.message || '');
      return { ok: false, motivo: 'recusado' };
    }
    return { ok: true, id: data.id, initPoint: data.init_point };
  } catch (err) {
    console.error('[mercadopago] erro ao criar preferência:', err);
    return { ok: false, motivo: 'rede' };
  }
}

// Consulta o pagamento de verdade (nunca confiar só no aviso recebido).
// { ok, pagamento } | { ok: false, naoExiste: true } | { ok: false, transitorio: true }
export async function consultarPagamento(id) {
  const token = process.env.MP_ACCESS_TOKEN;
  try {
    const resp = await fetch(`${API()}/v1/payments/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.status === 404) return { ok: false, naoExiste: true };
    if (!resp.ok) return { ok: false, transitorio: true, status: resp.status };
    return { ok: true, pagamento: await resp.json() };
  } catch (err) {
    return { ok: false, transitorio: true, erro: String(err) };
  }
}
