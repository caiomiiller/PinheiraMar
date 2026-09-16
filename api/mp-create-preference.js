// Cria uma "preference" de pagamento no Mercado Pago (Checkout Pro) para o
// sinal de uma reserva, e devolve o link (init_point) para onde o navegador
// do hóspede deve ser redirecionado para pagar.
//
// Esta é uma Vercel Serverless Function — corre no servidor, nunca no
// navegador, porque precisa do MP_ACCESS_TOKEN (uma credencial secreta: se
// fosse posta no código do site, qualquer pessoa que inspecionasse a página
// conseguiria vê-la e usá-la para criar cobranças em nome da conta).
//
// Configuração necessária (ver .env.example):
//   1. Crie/entre na sua conta Mercado Pago → https://www.mercadopago.com.br/developers
//   2. Em "Suas integrações" → crie uma aplicação → copie o "Access Token"
//      (comece pelo de TESTE/sandbox para experimentar sem dinheiro real).
//   3. Adicione MP_ACCESS_TOKEN nas Environment Variables do projeto na
//      Vercel (Settings → Environment Variables) — NÃO no .env do Vite
//      (não leva o prefixo VITE_ de propósito, para nunca ir parar ao
//      navegador). Depois de configurar, faça um novo deploy.
//
// Enquanto MP_ACCESS_TOKEN não estiver definido, este endpoint responde 503
// e o site cai automaticamente no fluxo manual de sempre (BookingModal.jsx) —
// nada quebra, só não há redirecionamento para pagamento online ainda.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    res.status(503).json({ error: 'Mercado Pago não configurado (falta MP_ACCESS_TOKEN no servidor).' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { reservaId, codigo, hospede, valor, descricao, origin } = body;

    const valorNum = Number(valor);
    if (!reservaId || typeof reservaId !== 'string' || !Number.isFinite(valorNum) || valorNum <= 0) {
      res.status(400).json({ error: 'Dados incompletos ou inválidos (reservaId, valor).' });
      return;
    }

    // origin vem do próprio navegador (window.location.origin) — usamos para
    // montar as URLs de retorno/webhook sem depender de um domínio fixo no
    // código (funciona tanto no domínio definitivo como em previews da Vercel).
    const base = (typeof origin === 'string' && /^https?:\/\//.test(origin)) ? origin : `https://${req.headers.host}`;

    const preference = {
      items: [{
        title: (descricao || `Sinal da reserva ${codigo || reservaId}`).slice(0, 250),
        quantity: 1,
        currency_id: 'BRL',
        unit_price: Math.round(valorNum * 100) / 100,
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
    };

    const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(preference),
    });
    const data = await mpResp.json();

    if (!mpResp.ok) {
      console.error('[mp-create-preference] Mercado Pago recusou o pedido:', data);
      res.status(502).json({ error: 'Mercado Pago recusou o pedido.', detail: data?.message || null });
      return;
    }

    res.status(200).json({ id: data.id, init_point: data.init_point });
  } catch (err) {
    console.error('[mp-create-preference] erro inesperado:', err);
    res.status(500).json({ error: 'Erro interno ao criar a preferência de pagamento.' });
  }
}
