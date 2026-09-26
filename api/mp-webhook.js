// Webhook do Mercado Pago: chamado pelo Mercado Pago sempre que um pagamento
// muda de estado. É a única fonte de verdade sobre o pagamento (o regresso do
// hóspede ao site só melhora a experiência).
//
// Mudanças da revisão de 2026-09-25:
// • grava com verificação de versão (server/estado.js) — não apaga o que o
//   painel ou outras reservas gravaram entretanto;
// • responde erro (500) quando algo falha do nosso lado, para o Mercado Pago
//   tentar de novo (antes respondia sempre 200 e o aviso perdia-se);
// • só envia o e-mail DEPOIS de a confirmação estar gravada;
// • confere o valor pago contra o sinal: se veio menos, não confirma e deixa
//   a reserva sinalizada para o gestor ver no Painel;
// • numa reserva conjunta, o pagamento fica registado uma vez só (na reserva
//   principal) — antes entrava nas duas e contava o sinal em dobro;
// • estornos/chargebacks ficam sinalizados na reserva.
import { alterarEstado } from '../server/estado.js';
import { responder, baseDoSite } from '../server/http.js';
import { mpConfigurado, consultarPagamento } from '../server/mercadopago.js';
import { enviarConfirmacao, registarEnvio } from '../server/email.js';
import { overlaps, uid } from '../src/lib/helpers.js';
import { migrarDados } from '../src/lib/migracoes.js';

// As datas desta reserva continuam livres? Usado só para MARCAR conflitos
// (o hóspede já pagou), nunca para recusar.
export function datasEmConflito(reservas, reserva) {
  return (reservas || []).some(o =>
    o.id !== reserva.id && o.apartamentoId === reserva.apartamentoId && o.status !== 'cancelada'
    && !(o.status === 'pendente' && o.expiraEm && Date.parse(o.expiraEm) <= Date.now())
    && overlaps(reserva.checkIn, reserva.checkOut, o.checkIn, o.checkOut));
}

const arred = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Decide o que fazer com as reservas de um pagamento. Pura (sem rede nem
// banco) para poder ser testada — ver tests/webhook.test.js.
export function aplicarDesfechoPagamento(reservas, reservaId, payment, agoraISO = new Date().toISOString()) {
  const status = payment?.status;
  const aprovado = status === 'approved';
  const recusado = status === 'rejected' || status === 'cancelled';
  const estornado = status === 'refunded' || status === 'charged_back';
  const mpId = String(payment?.id ?? '');
  const grupo = (reservas || []).filter(r => r.id === reservaId || r.pagamentoRef === reservaId);
  const alvos = grupo.map(r => r.id);
  const principalAtual = grupo.find(r => r.id === reservaId);
  // O valor esperado é o que foi de facto cobrado no link de pagamento
  // (guardado ao criar a reserva — api/reservar.js). Assim, mexer na reserva
  // no painel antes de o aviso chegar não faz um pagamento certo parecer
  // "a menos". Reservas antigas, sem esse registo: a soma dos sinais.
  const cobrado = Number(principalAtual?.mpValorCobrado);
  const esperado = arred(cobrado > 0 ? cobrado : grupo.reduce((s, r) => s + (Number(r.sinal) || 0), 0));
  const pago = arred(payment?.transaction_amount);
  const registosMP = (r) => (r?.registrosPagamento || []).filter(x => x && x.mpId);
  const jaRegistado = registosMP(principalAtual).some(x => String(x.mpId) === mpId);
  // pagamentos do Mercado Pago já registados nesta reserva + este
  const pagoTotal = arred(pago + (jaRegistado ? 0 : registosMP(principalAtual).reduce((s, x) => s + (Number(x.valor) || 0), 0)));
  const divergente = aprovado && esperado > 0 && pagoTotal + 0.009 < esperado;
  const confirmadas = [];
  let mudou = false;

  const saida = (reservas || []).map(r => {
    if (!alvos.includes(r.id)) return r;
    const principal = r.id === reservaId;

    if (estornado) {
      if (r.pagamentoEstornado?.mpId === mpId) return r;
      mudou = true;
      return { ...r, pagamentoEstornado: { status, mpId, em: agoraISO } };
    }
    if (r.status !== 'pendente') return r; // reenvio do mesmo aviso, ou já tratada à mão

    if (aprovado) {
      // o Mercado Pago avisa o mesmo pagamento mais de uma vez (e qualquer
      // pessoa pode repetir o aviso): se já foi registado, não repete
      if (jaRegistado || (!principal && r.pagamentoMpId === mpId)) return r;
      mudou = true;
      const legado = (r.registrosPagamento || []).length === 0 && Number(r.valorPago) > 0
        ? [{ id: uid(), descricao: 'Valor pago anteriormente (registo antigo)', data: r.criadoEm || agoraISO.slice(0, 10), valor: arred(r.valorPago) }]
        : (r.registrosPagamento || []);
      const registrosPagamento = principal
        ? [...legado, { id: uid(), descricao: 'Pagamento via Mercado Pago (sinal)', data: agoraISO.slice(0, 10), valor: pago, mpId }]
        : legado;
      const valorPago = arred(registrosPagamento.reduce((s, x) => s + (Number(x.valor) || 0), 0));
      const base = { ...r, pagamentoMpId: mpId, pagamentoStatus: status, registrosPagamento, valorPago };
      if (divergente) {
        // pagou menos do que o sinal: NÃO confirma, mas houve dinheiro — as
        // datas ficam seguras (sem prazo) até o gestor decidir (Painel → avisos)
        return { ...base, expiraEm: null, pagamentoDivergente: { esperado, pago: pagoTotal, mpId, em: agoraISO } };
      }
      const conf = { ...base, status: 'reservado', expiraEm: null, pagamentoConfirmadoEm: agoraISO };
      confirmadas.push(conf.id);
      return conf;
    }
    if (recusado) {
      if (r.pagamentoMpId === mpId && r.pagamentoStatus === status) return r; // aviso repetido
      mudou = true;
      // tentativa recusada: uma reserva provisória larga as datas já (o
      // hóspede pode tentar de novo no mesmo checkout, e este webhook ainda a
      // encontra). Uma que o gestor já assumiu (sem prazo) não é mexida.
      return { ...r, ...(r.expiraEm ? { expiraEm: agoraISO } : {}), pagamentoMpId: mpId, pagamentoStatus: status };
    }
    return r;
  });
  return { reservas: saida, alvos, mudou, divergente, confirmadas, esperado, pago };
}

const idDoAviso = (req) => {
  const q = req.query || {};
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  return {
    paymentId: q['data.id'] || q.id || body?.data?.id || null,
    tipo: q.type || q.topic || body.type || body.topic || null,
  };
};

export default async function handler(req, res) {
  try {
    const { paymentId, tipo } = idDoAviso(req);
    console.log('[mp-webhook] recebido:', req.method, 'tipo=', tipo, 'id=', paymentId);
    if (!mpConfigurado()) return responder(res, 200, { ok: false, motivo: 'nao_configurado' });
    if (!paymentId || (tipo && tipo !== 'payment')) return responder(res, 200, { ok: true, ignorado: true });

    const c = await consultarPagamento(paymentId);
    if (!c.ok && c.naoExiste) return responder(res, 200, { ok: true, ignorado: 'pagamento_inexistente' });
    if (!c.ok) {
      console.warn('[mp-webhook] consulta do pagamento falhou — o Mercado Pago vai tentar de novo', c.status || c.erro || '');
      return responder(res, 500, { ok: false, motivo: 'consulta_falhou' });
    }
    const payment = c.pagamento;
    const reservaId = payment.external_reference;
    const relevante = ['approved', 'rejected', 'cancelled', 'refunded', 'charged_back'].includes(payment.status);
    if (!reservaId || !relevante) return responder(res, 200, { ok: true, status: payment.status });

    const agoraISO = new Date().toISOString();
    let desfecho;
    const r = await alterarEstado((estado) => {
      const e = migrarDados(estado).data;
      const d = aplicarDesfechoPagamento(e.reservas, reservaId, payment, agoraISO);
      desfecho = d;
      if (!d.alvos.length || !d.mudou) return { estado: null, resultado: d };
      let reservas = d.reservas;
      if (d.confirmadas.length) {
        reservas = reservas.map(x => (d.confirmadas.includes(x.id) && datasEmConflito(reservas, x) ? { ...x, conflitoDatas: true } : x));
      }
      return { estado: { ...e, reservas }, resultado: d };
    });

    if (!desfecho?.alvos.length) {
      console.error('[mp-webhook] pagamento', payment.id, 'sem reserva correspondente (external_reference=', reservaId, ')');
      return responder(res, 200, { ok: false, motivo: 'reserva_nao_encontrada' });
    }
    if (desfecho.divergente) {
      console.warn('[mp-webhook] valor pago', desfecho.pago, 'menor que o sinal', desfecho.esperado, '— reserva não confirmada', reservaId);
    }
    // e-mail só depois de gravado, e só para o que acabou de ser confirmado
    if (r.gravado && desfecho.confirmadas.length) {
      const e = r.estado;
      const grupo = e.reservas
        .filter(x => desfecho.confirmadas.includes(x.id))
        .sort((a, b) => (a.id === reservaId ? -1 : b.id === reservaId ? 1 : 0))
        .map(x => ({ reserva: x, apt: (e.apartamentos || []).find(a => a.id === x.apartamentoId) }));
      const residencial = (e.residenciais || []).find(x => x.id === grupo[0]?.apt?.residencialId) || (e.residenciais || [])[0];
      const env = await enviarConfirmacao(grupo, residencial, { site: baseDoSite(req) });
      if (env.ok) await registarEnvio(grupo.map(g => g.reserva.id));
    }
    return responder(res, 200, { ok: true, status: payment.status, reservas: desfecho.alvos.length, gravado: !!r.gravado });
  } catch (err) {
    console.error('[mp-webhook] erro — o Mercado Pago vai tentar de novo:', err.codigo || err, err.detalhes || '');
    return responder(res, 500, { ok: false });
  }
}
