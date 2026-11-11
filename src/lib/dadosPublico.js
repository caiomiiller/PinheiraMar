// Dados do SITE PÚBLICO. O navegador do visitante nunca recebe nem guarda o
// banco inteiro: lê o estado público pelo servidor (sem dados pessoais) e
// pede a reserva ao servidor, que confere e grava.
import { MODO_DEMO } from './config';
import { estadoPublico } from './publico.js';
import { migrarDados } from './migracoes.js';
import { MIN_JANELA_PAGAMENTO } from './helpers.js';
import { validarHospede, validarPedido, montarReservas, reservaParaHospede, hojeISO } from './reservas.js';

// Versões antigas do site guardavam uma cópia COMPLETA do banco (com nome,
// e-mail e telefone de todos os hóspedes) no localStorage de quem visitava
// ou reservava. Apaga essas cópias ao abrir o site.
export function limparCopiasAntigas() {
  try {
    const ls = window.localStorage;
    for (let i = ls.length - 1; i >= 0; i--) {
      const k = ls.key(i);
      if (k && k.startsWith('pinheiramar:data:')) ls.removeItem(k);
    }
  } catch { /* sem localStorage — nada a limpar */ }
}

/* ── modo demonstração: dados fictícios só neste navegador ── */
export const CHAVE_DEMO = 'pinheiramar:demo:v1';
export async function lerDemo() {
  try { const raw = window.localStorage.getItem(CHAVE_DEMO); if (raw) return migrarDados(JSON.parse(raw)).data; } catch { /* ignora */ }
  const { seedData } = await import('./seed');
  const d = migrarDados(seedData()).data;
  gravarDemo(d);
  return d;
}
export function gravarDemo(d) {
  try { window.localStorage.setItem(CHAVE_DEMO, JSON.stringify(d)); } catch { /* sem espaço: fica só em memória */ }
}

export async function carregarPublico() {
  if (MODO_DEMO) return estadoPublico(await lerDemo(), hojeISO());
  const resp = await fetch('/api/estado-publico', { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!resp.ok) throw new Error('estado_publico_' + resp.status);
  return resp.json();
}

// Pede a reserva ao servidor. Devolve sempre um objeto { ok, ... } — nunca
// lança — para o formulário poder explicar ao hóspede o que aconteceu.
export async function reservar(pedido) {
  if (MODO_DEMO) return reservarDemo(pedido);
  try {
    const resp = await fetch('/api/reservar', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(pedido),
    });
    const json = await resp.json().catch(() => null);
    if (!json) return { ok: false, erro: 'servico_indisponivel', status: resp.status };
    return { ...json, status: resp.status };
  } catch {
    return { ok: false, erro: 'rede' };
  }
}

async function reservarDemo(pedido) {
  const vh = validarHospede(pedido.hospede);
  if (!vh.ok) return { ok: false, erro: 'dados_hospede', campos: vh.erros };
  const e = await lerDemo();
  const agora = Date.now(); const hoje = hojeISO();
  const v = validarPedido(e, pedido, { agora, hoje });
  if (!v.ok) return v;
  const m = montarReservas(e, pedido, v, { agoraISO: new Date(agora).toISOString(), hoje, comPrazo: false });
  const difere = (a, b) => a != null && Number.isFinite(a) && Math.abs(a - b) > 0.009;
  if (difere(pedido.totalEsperado, m.total) || difere(pedido.sinalEsperado, m.sinal)) return { ok: false, erro: 'preco_mudou', total: m.total, sinal: m.sinal };
  gravarDemo({ ...e, reservas: [...e.reservas, ...m.reservas] });
  return { ok: true, reservas: m.reservas.map(reservaParaHospede), total: m.total, sinal: m.sinal, initPoint: null, pagamentoOnline: false, demo: true };
}

// Guarda a reserva acabada de criar para mostrar a confirmação quando o
// hóspede voltar do Mercado Pago (o site público já não tem acesso aos
// dados das reservas). Fica só neste separador.
const CHAVE_ULTIMA = 'pinheiramar:ultima-reserva';
export function guardarUltimaReserva(info) {
  try { window.sessionStorage.setItem(CHAVE_ULTIMA, JSON.stringify({ ...info, guardadoEm: Date.now() })); } catch { /* ignora */ }
}
export function lerUltimaReserva(reservaId) {
  try {
    const x = JSON.parse(window.sessionStorage.getItem(CHAVE_ULTIMA) || 'null');
    if (!x || !Array.isArray(x.reservas) || !x.reservas.some(r => r.id === reservaId)) return null;
    return x;
  } catch { return null; }
}

// "Tentar pagar de novo": o link de pagamento criado com a reserva continua a
// valer no Mercado Pago durante MIN_JANELA_PAGAMENTO minutos, e o servidor já
// aceita uma nova tentativa no mesmo link (api/mp-webhook.js). Aqui só se
// decide se ainda vale a pena mostrá-lo: devolve { url, ate } enquanto o link
// estiver dentro do prazo (com 1 minuto de folga), senão null. Não cria nem
// altera nada no servidor.
const FOLGA_REPAGAR_MS = 60 * 1000;
export function linkParaRepagar(info, agora = Date.now()) {
  const url = String(info?.initPoint || '');
  const criado = Number(info?.guardadoEm);
  if (!url || !Number.isFinite(criado)) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !/(^|\.)mercadopago\.com(\.[a-z]{2})?$/.test(u.hostname)) return null;
  } catch { return null; }
  const ate = criado + MIN_JANELA_PAGAMENTO * 60000 - FOLGA_REPAGAR_MS;
  return agora < ate ? { url, ate } : null;
}
