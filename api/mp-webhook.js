// Webhook do Mercado Pago: chamado pelo Mercado Pago (nunca pelo navegador
// do hóspede) sempre que o estado de um pagamento muda. É a única fonte de
// verdade confiável sobre pagamento — nunca confiamos no redirecionamento de
// volta ao site (esse só melhora a experiência, pode falhar ou ser fechado
// pelo hóspede antes de completar).
//
// O que faz: recebe o aviso, busca o pagamento de verdade na API do Mercado
// Pago (usando o MP_ACCESS_TOKEN — nunca confiar nos dados que vêm só na
// notificação, podem ser forjados), e se estiver aprovado, avança o status
// da reserva correspondente de 'pendente' para 'reservado' (50% pago —
// ver STATUS em src/components/ui.jsx), localizada por external_reference,
// que é o id da reserva — ver BookingModal.jsx/api/mp-create-preference.js).
//
// Configuração: MP_ACCESS_TOKEN (ver mp-create-preference.js) + as mesmas
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY já usadas pelo site (funcionam
// aqui também: o prefixo VITE_ só controla o que o Vite expõe ao navegador
// no build, não impede o Node de as ler em process.env no servidor).
//
// Nota sobre concorrência: todo o estado do site vive numa única linha JSON
// na tabela app_state (ver supabase-setup.sql) — não há hoje uma tabela
// "reservas" própria com linhas independentes. Este webhook faz
// ler-atualizar-gravar (lê o estado inteiro, muda só esta reserva, grava de
// volta o estado inteiro): em teoria, se uma gravação do painel de gestão ou
// outra reserva acontecer exatamente no meio dessa janela, pode perder-se.
// Para o volume desta operação (poucas reservas/edições em simultâneo) o
// risco é baixo, mas é um ponto a resolver como trabalho futuro (mover
// "reservas" para uma tabela própria no Supabase) se o volume crescer.

import { createClient } from '@supabase/supabase-js';
import { overlaps, uid, money, fmtLong, nights } from '../src/lib/helpers.js';

// Junta "2 adultos, 1 criança" (ou só uma das partes, se a outra for 0) —
// mesma lógica de src/lib/email.js (hospedesTxt), duplicada de propósito
// (ver nota no topo de enviarEmailConfirmacao).
function hospedesTxt(reserva) {
  const adultos = Number(reserva.adultos) || 0;
  const criancas = Number(reserva.criancas) || 0;
  return [
    adultos ? `${adultos} adulto${adultos > 1 ? 's' : ''}` : null,
    criancas ? `${criancas} criança${criancas > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(', ') || '—';
}

// Envia o e-mail de confirmação da reserva pelo EmailJS. Aqui, no servidor,
// não se pode usar o SDK do navegador (src/lib/email.js) — usa-se a API REST,
// que fora do navegador exige a chave privada e que o envio por API esteja
// ligado em Account → Security na conta EmailJS (ver .env.example).
//
// Falhar aqui nunca põe em causa o pagamento nem a reserva: fica um aviso no
// log e a reserva continua confirmada — o e-mail é um reforço, não o registo.
async function enviarEmailConfirmacao(reserva, apt, residencial) {
  const publicKey = process.env.VITE_EMAILJS_PUBLIC_KEY;
  const serviceId = process.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = process.env.VITE_EMAILJS_TEMPLATE_ID;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!publicKey || !serviceId || !templateId || !privateKey) {
    console.warn('[mp-webhook] EmailJS não configurado no servidor — e-mail de confirmação não enviado (ver .env.example).');
    return false;
  }
  if (!reserva?.email) return false;
  try {
    // Mesmas variáveis (mesmos nomes) que buildParams() usa no envio pelo
    // navegador (src/lib/email.js) — o template do EmailJS é o mesmo dos
    // dois lados. CORRIGIDO em 2026-09-24: faltava `email` (o template usa
    // {{email}} como destinatário, não {{to_email}} — sem isto a EmailJS
    // respondia sempre 422 "The recipients address is empty", e nenhuma
    // reserva paga pelo Mercado Pago chegava a enviar o e-mail de
    // confirmação). Também enriquecido com os mesmos campos formatados
    // (datas por extenso, noites, hóspedes, valores em R$, saldo restante).
    const pago = Number(reserva.valorPago ?? reserva.sinal ?? 0);
    const restante = Math.round((Number(reserva.total || 0) - pago) * 100) / 100;
    const resp = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          email: reserva.email,
          to_email: reserva.email,
          to_name: reserva.hospede || reserva.nome || '',
          codigo_reserva: reserva.codigo,
          nome_propriedade: residencial?.nome || '',
          cidade: residencial?.cidade || '',
          apartamento: [apt?.nome, apt?.vista].filter(Boolean).join(' · '),
          check_in_fmt: fmtLong(reserva.checkIn),
          check_out_fmt: fmtLong(reserva.checkOut),
          noites: nights(reserva.checkIn, reserva.checkOut),
          hospedes_txt: hospedesTxt(reserva),
          total_fmt: money(reserva.total),
          sinal_fmt: money(reserva.sinal),
          sinal_pct: residencial?.sinalPct,
          restante_fmt: money(restante),
          endereco: residencial?.endereco || '',
          whatsapp: residencial?.telefone || '',
        },
      }),
    });
    if (!resp.ok) {
      console.warn('[mp-webhook] EmailJS recusou o envio:', resp.status, await resp.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[mp-webhook] Falha ao enviar o e-mail de confirmação:', err);
    return false;
  }
}

// As datas desta reserva continuam livres? Conta qualquer outra reserva que
// as ocupe e não esteja cancelada — incluindo uma provisória de outra pessoa
// ainda dentro do prazo. Usado só para marcar conflitos, nunca para recusar
// um pagamento já feito.
export function datasEmConflito(reservas, reserva) {
  return (reservas || []).some(o =>
    o.id !== reserva.id && o.apartamentoId === reserva.apartamentoId && o.status !== 'cancelada'
    && overlaps(reserva.checkIn, reserva.checkOut, o.checkIn, o.checkOut));
}

// Decide o que fazer com as reservas ligadas a um pagamento. Isolada de
// propósito — sem rede nem base de dados — para poder ser testada a sério:
// é a parte onde um engano custa dinheiro ou uma reserva perdida.
//
// `alvos` são a reserva do pagamento e, numa reserva conjunta (dois
// apartamentos), a outra metade, ligada pelo mesmo `pagamentoRef`.
// Só mexe em reservas ainda 'pendente': um reenvio do mesmo aviso, ou um
// gestor que já tenha avançado o estado à mão, não é desfeito aqui.
export function aplicarDesfechoPagamento(reservas, reservaId, payment, agoraISO = new Date().toISOString()) {
  const aprovado = payment.status === 'approved';
  const alvos = [];
  let mudou = false;
  const saida = (reservas || []).map(r => {
    if (r.id !== reservaId && r.pagamentoRef !== reservaId) return r;
    alvos.push(r.id);
    if (r.status !== 'pendente') return r;
    mudou = true;
    return aprovado
      // pago: deixa de ser provisória (sem prazo) e passa a Reservado — e o
      // valor real da transação (payment.transaction_amount, não um valor
      // "adivinhado") entra no histórico de pagamentos da reserva, a pedido
      // do Caio (2026-09-23): "o sinal sugerido deve ser na verdade o
      // registo do valor do pagamento realizado na reserva pelo site".
      // Um `valorPago` legado (só possível se alguém tiver editado esta
      // reserva manualmente antes do pagamento cair) é preservado como 1º
      // lançamento, exatamente como no painel (ReservationForm) — nunca
      // perdido, só materializado no histórico.
      ? (() => {
          const legado = (r.registrosPagamento || []).length === 0 && Number(r.valorPago) > 0
            ? [{ id: uid(), descricao: 'Valor pago anteriormente (registo antigo)', data: r.criadoEm || agoraISO.slice(0, 10), valor: Math.round((Number(r.valorPago) || 0) * 100) / 100 }]
            : (r.registrosPagamento || []);
          const registrosPagamento = [...legado, {
            id: uid(), descricao: 'Pagamento via Mercado Pago (sinal)', data: agoraISO.slice(0, 10),
            valor: Math.round((Number(payment.transaction_amount) || 0) * 100) / 100,
          }];
          const valorPago = Math.round(registrosPagamento.reduce((s, x) => s + (Number(x.valor) || 0), 0) * 100) / 100;
          return { ...r, status: 'reservado', expiraEm: null, pagamentoMpId: String(payment.id), pagamentoConfirmadoEm: agoraISO, registrosPagamento, valorPago };
        })()
      // recusado: o prazo passa a agora, portanto as datas ficam livres
      // imediatamente para novas consultas. Mantém-se 'pendente' de
      // propósito, em vez de apagar: o hóspede pode tentar pagar outra vez
      // no mesmo checkout, e aí este mesmo webhook ainda a encontra para
      // confirmar. Se ninguém pagar, é limpa depois (ver seed.js).
      : { ...r, expiraEm: agoraISO, pagamentoMpId: String(payment.id), pagamentoStatus: payment.status };
  });
  return { reservas: saida, alvos, mudou };
}

export default async function handler(req, res) {
  // O Mercado Pago não espera um corpo de resposta específico, só um 200
  // rápido — respondemos sempre 200 (mesmo quando ignoramos o aviso ou algo
  // falha do nosso lado) para não entrar num ciclo de reenvios automáticos
  // dele; os detalhes ficam só nos logs da função, para diagnóstico.
  try {
    // Log mínimo de cada chamada recebida (método, query e o tipo indicado no
    // corpo) — antes de qualquer "return" — para que, se o Mercado Pago um
    // dia não avançar uma reserva, dê para confirmar nos logs da função da
    // Vercel se o aviso chegou sequer (e com que forma), em vez de ter de
    // adivinhar entre "nunca chegou" e "chegou mas foi ignorado/falhou".
    console.log('[mp-webhook] recebido:', req.method, JSON.stringify(req.query || {}), 'body.type=', req.body && req.body.type);

    const token = process.env.MP_ACCESS_TOKEN;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!token || !supabaseUrl || !supabaseKey) {
      console.warn('[mp-webhook] Recebido mas não configurado (falta MP_ACCESS_TOKEN ou Supabase) — ignorado.');
      res.status(200).json({ ok: false, reason: 'not_configured' });
      return;
    }

    const q = req.query || {};
    const bodyId = req.body && typeof req.body === 'object' ? req.body?.data?.id : null;
    const paymentId = q['data.id'] || q.id || bodyId;
    const type = q.type || q.topic || (req.body && req.body.type);
    if (!paymentId || (type && type !== 'payment')) {
      console.log('[mp-webhook] ignorado — sem paymentId ou tipo != payment (type=', type, ', paymentId=', paymentId, ')');
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    // Busca o pagamento de verdade na API do MP — nunca confiar só na notificação.
    const payResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!payResp.ok) {
      console.warn('[mp-webhook] Não foi possível consultar o pagamento', paymentId, payResp.status);
      res.status(200).json({ ok: false, reason: 'payment_lookup_failed' });
      return;
    }
    const payment = await payResp.json();
    const reservaId = payment.external_reference;
    if (!reservaId) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    // 'approved' confirma; 'rejected'/'cancelled' são desfechos negativos e
    // definitivos daquela tentativa — aí a reserva provisória tem de largar
    // as datas já, sem esperar pelo prazo. Os estados intermédios
    // ('pending', 'in_process', 'authorized') não são desfecho nenhum: a
    // reserva continua provisória até ao prazo dela.
    const aprovado = payment.status === 'approved';
    const recusado = payment.status === 'rejected' || payment.status === 'cancelled';
    if (!aprovado && !recusado) {
      res.status(200).json({ ok: true, status: payment.status });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: row, error: readErr } = await supabase
      .from('app_state').select('data').eq('id', 'main').maybeSingle();
    if (readErr || !row?.data) {
      console.error('[mp-webhook] Não foi possível ler o app_state:', readErr);
      res.status(200).json({ ok: false, reason: 'state_read_failed' });
      return;
    }

    const state = row.data;
    const { reservas, alvos, mudou } = aplicarDesfechoPagamento(state.reservas, reservaId, payment);
    if (!alvos.length) {
      console.warn('[mp-webhook] Reserva não encontrada para external_reference', reservaId);
      res.status(200).json({ ok: false, reason: 'reserva_not_found' });
      return;
    }
    state.reservas = reservas;

    // Confirmar um pagamento pode chegar depois de o prazo da provisória ter
    // expirado e outra pessoa ter ficado com as mesmas noites. O hóspede
    // pagou, por isso a reserva mantém-se — mas fica marcada, para o gestor
    // ver no painel e resolver, em vez de ficarem duas reservas sobrepostas
    // sem ninguém dar por isso.
    if (aprovado && mudou) {
      state.reservas = state.reservas.map(r => {
        if (!alvos.includes(r.id) || r.status !== 'reservado') return r;
        return datasEmConflito(state.reservas, r) ? { ...r, conflitoDatas: true } : r;
      });
    }

    if (mudou) {
      const { error: writeErr } = await supabase
        .from('app_state')
        .update({ data: state, updated_at: new Date().toISOString() })
        .eq('id', 'main');
      if (writeErr) console.error('[mp-webhook] Falha ao gravar o desfecho do pagamento:', writeErr);
    }

    // Só agora, com o pagamento aprovado e a reserva gravada, é que o hóspede
    // recebe o e-mail de confirmação — antes saía assim que ele preenchia o
    // formulário, mesmo que o pagamento viesse a ser recusado.
    if (aprovado && mudou) {
      for (const id of alvos) {
        const r = state.reservas.find(x => x.id === id);
        if (!r || r.status !== 'reservado') continue;
        const apt = (state.apartamentos || []).find(a => a.id === r.apartamentoId);
        const residencial = (state.residenciais || []).find(x => x.id === apt?.residencialId);
        await enviarEmailConfirmacao(r, apt, residencial);
      }
    }

    res.status(200).json({ ok: true, status: payment.status, reservas: alvos.length });
  } catch (err) {
    console.error('[mp-webhook] erro inesperado:', err);
    res.status(200).json({ ok: false });
  }
}
