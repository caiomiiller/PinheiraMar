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

    if (payment.status !== 'approved') {
      // pendente, rejeitado, estornado, etc. — não avançamos o status; a
      // reserva fica como está (o gestor vê pelo Estado no admin que ainda
      // não há confirmação e pode acompanhar manualmente se precisar).
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
    const idx = (state.reservas || []).findIndex(r => r.id === reservaId);
    if (idx === -1) {
      console.warn('[mp-webhook] Reserva não encontrada para external_reference', reservaId);
      res.status(200).json({ ok: false, reason: 'reserva_not_found' });
      return;
    }

    // idempotente: só avança 'pendente' → 'reservado'. Se um reenvio do
    // mesmo aviso chegar depois (ou o gestor já tiver avançado o status
    // manualmente para 'confirmado'/'cancelada'), não mexe em nada.
    if (state.reservas[idx].status === 'pendente') {
      state.reservas[idx] = {
        ...state.reservas[idx],
        status: 'reservado',
        pagamentoMpId: String(payment.id),
        pagamentoConfirmadoEm: new Date().toISOString(),
      };
      const { error: writeErr } = await supabase
        .from('app_state')
        .update({ data: state, updated_at: new Date().toISOString() })
        .eq('id', 'main');
      if (writeErr) console.error('[mp-webhook] Falha ao gravar status reservado:', writeErr);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[mp-webhook] erro inesperado:', err);
    res.status(200).json({ ok: false });
  }
}
