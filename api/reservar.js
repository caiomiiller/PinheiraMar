// POST /api/reservar — cria a reserva (1 ou 2 apartamentos) no servidor.
//
// O navegador só envia o pedido (datas, apartamentos, pessoas, extras e os
// dados do hóspede). Aqui, com os dados ATUAIS do banco:
//   • valida datas, capacidade, mínimo/máximo de noites e disponibilidade;
//   • calcula preço e sinal (o valor cobrado no Mercado Pago sai daqui);
//   • grava as duas metades de uma reserva conjunta de uma só vez, com
//     verificação de versão (server/estado.js) — sem apagar o que outros
//     gravaram entretanto;
//   • cria o link de pagamento com o domínio do próprio site.
// Antes, tudo isto era feito no navegador e gravado por cima do banco.
import { alterarEstado } from '../server/estado.js';
import { corpoJSON, responder, baseDoSite } from '../server/http.js';
import { mpConfigurado, criarPreferencia } from '../server/mercadopago.js';
import { enviarConfirmacao, registarEnvio } from '../server/email.js';
import { migrarDados } from '../src/lib/migracoes.js';
import { MIN_HOLD_PAGAMENTO } from '../src/lib/helpers.js';
import {
  validarHospede, validarPedido, montarReservas, reservaParaHospede, hojeISO, provisoriaParaLimpar,
  pendentesDoHospede, MAX_PENDENTES_POR_HOSPEDE,
} from '../src/lib/reservas.js';

const int = (v, min, max) => Math.max(min, Math.min(max, Math.floor(Number(v) || 0)));

export function normalizarPedido(b = {}) {
  return {
    itens: (Array.isArray(b.itens) ? b.itens : []).slice(0, 3).map(i => ({
      apartamentoId: String(i?.apartamentoId || '').slice(0, 40), hospedes: int(i?.hospedes, 0, 50),
    })),
    checkIn: String(b.checkIn || '').slice(0, 10),
    checkOut: String(b.checkOut || '').slice(0, 10),
    opcionais: (Array.isArray(b.opcionais) ? b.opcionais : []).slice(0, 20).map(o => ({
      taxaId: String(o?.taxaId || '').slice(0, 40), unidades: int(o?.unidades, 0, 50),
      escopo: o?.escopo === 'per_apt' ? 'per_apt' : 'group',
    })).filter(o => o.taxaId && o.unidades > 0),
    hospede: {
      nome: String(b.hospede?.nome || '').trim().slice(0, 120),
      email: String(b.hospede?.email || '').trim().slice(0, 160),
      telefone: String(b.hospede?.telefone || '').trim().slice(0, 40),
    },
    hospedesPesquisa: int(b.hospedesPesquisa, 0, 50),
    totalEsperado: b.totalEsperado == null || b.totalEsperado === '' ? null : Number(b.totalEsperado),
    sinalEsperado: b.sinalEsperado == null || b.sinalEsperado === '' ? null : Number(b.sinalEsperado),
    idioma: ['pt', 'es', 'en'].includes(b.idioma) ? b.idioma : 'pt',
  };
}

const CONFLITO = new Set(['indisponivel', 'preco_mudou']);
const difere = (a, b) => a != null && Number.isFinite(a) && Math.abs(a - b) > 0.009;
// tira o prazo (e o valor do link) de uma reserva do site: passa a manual
const semPrazo = ({ expiraEm, mpValorCobrado, ...r }) => r;

export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { ok: false, erro: 'metodo_nao_permitido' });
  const b = corpoJSON(req);
  if (!b || typeof b !== 'object') return responder(res, 400, { ok: false, erro: 'pedido_invalido' });
  if (b.website) return responder(res, 400, { ok: false, erro: 'pedido_invalido' }); // campo-isca para robôs

  const pedido = normalizarPedido(b);
  const vh = validarHospede(pedido.hospede);
  if (!vh.ok) return responder(res, 422, { ok: false, erro: 'dados_hospede', campos: vh.erros });

  const agora = Date.now();
  const agoraISO = new Date(agora).toISOString();
  const hoje = hojeISO(new Date(agora));
  const pagamentoOnline = mpConfigurado();

  // 1) grava a reserva. Com pagamento online ela já nasce provisória (com
  //    prazo): se o hóspede desistir do checkout — ou se esta função for
  //    interrompida a meio — as datas voltam a ficar livres sozinhas. O valor
  //    que vai ser cobrado fica guardado (mpValorCobrado) para o webhook
  //    conferir o pagamento contra ele, mesmo que a reserva seja editada.
  let r;
  try {
    r = await alterarEstado((estado) => {
      const e = migrarDados(estado).data;
      const v = validarPedido(e, pedido, { agora, hoje });
      if (!v.ok) return { estado: null, resultado: v };
      if (pendentesDoHospede(e.reservas, pedido.hospede, agora) >= MAX_PENDENTES_POR_HOSPEDE) {
        return { estado: null, resultado: { ok: false, erro: 'muitas_pendentes' } };
      }
      const m = montarReservas(e, pedido, v, { agoraISO, hoje, comPrazo: false });
      if (difere(pedido.totalEsperado, m.total) || difere(pedido.sinalEsperado, m.sinal)) {
        return { estado: null, resultado: { ok: false, erro: 'preco_mudou', total: m.total, sinal: m.sinal } };
      }
      if (pagamentoOnline && m.sinal > 0) {
        const expiraEm = new Date(agora + MIN_HOLD_PAGAMENTO * 60000).toISOString();
        const id1 = m.reservas[0].id;
        m.reservas = m.reservas.map((x, i) => ({ ...x, expiraEm, pagamentoRef: id1, ...(i === 0 ? { mpValorCobrado: m.sinal } : {}) }));
      }
      const reservas = [...e.reservas.filter(x => !provisoriaParaLimpar(x, agora)), ...m.reservas];
      return { estado: { ...e, reservas }, resultado: { ok: true, m } };
    });
  } catch (err) {
    console.error('[reservar] não foi possível gravar:', err.codigo || err, err.detalhes || '');
    return responder(res, 503, { ok: false, erro: 'servico_indisponivel' });
  }
  const resultado = r.resultado;
  if (!resultado?.ok) {
    const { ok, ...info } = resultado || {};
    const st = CONFLITO.has(info.erro) ? 409 : info.erro === 'muitas_pendentes' ? 429 : 422;
    return responder(res, st, { ok: false, ...info });
  }

  const { m } = resultado;
  const ids = new Set(m.reservas.map(x => x.id));
  const aptos = m.orcamento.partes.map(p => p.apt);
  const grupo = m.reservas.map((reserva, i) => ({ reserva, apt: aptos[i] }));
  const resposta = { ok: true, reservas: m.reservas.map(reservaParaHospede), total: m.total, sinal: m.sinal, initPoint: null };

  // 2) pagamento online (se configurado): o valor é o sinal calculado aqui
  if (pagamentoOnline && m.sinal > 0) {
    const [r1] = m.reservas;
    const pref = await criarPreferencia({
      reservaId: r1.id, codigo: r1.codigo, hospede: { nome: r1.hospede, email: r1.email }, valor: m.sinal,
      descricao: `Sinal — ${m.residencial?.nome || 'Reserva'} — ${aptos.map(a => a.nome).join(' + ')}`,
      base: baseDoSite(req),
    });
    if (pref.ok) return responder(res, 200, { ...resposta, initPoint: pref.initPoint, pagamentoOnline: true });

    // 3) Mercado Pago indisponível: a reserva passa a manual (sem prazo) —
    //    segura as datas e a equipa combina o sinal por WhatsApp/Pix. Se nem
    //    isto der para gravar, não se promete nada ao hóspede: a provisória
    //    vence sozinha e ele pode tentar de novo.
    console.warn('[reservar] Mercado Pago indisponível — reserva segue pelo fluxo manual:', pref.motivo);
    try {
      await alterarEstado((e) => ({
        estado: { ...e, reservas: e.reservas.map(x => (ids.has(x.id) && x.status === 'pendente' ? semPrazo(x) : x)) },
        resultado: true,
      }));
    } catch (err) {
      console.error('[reservar] não foi possível passar a reserva para o fluxo manual:', err.codigo || err);
      return responder(res, 503, { ok: false, erro: 'servico_indisponivel' });
    }
    grupo.forEach(g => { g.reserva = semPrazo(g.reserva); });
  }

  // Fluxo manual (sem Mercado Pago, ou ele falhou): a reserva vale desde já
  // e a equipa combina o sinal por WhatsApp/Pix. O e-mail sai daqui.
  const env = await enviarConfirmacao(grupo, m.residencial);
  if (env.ok) await registarEnvio([...ids]);
  return responder(res, 200, { ...resposta, pagamentoOnline: false, emailEnviado: !!env.ok });
}
