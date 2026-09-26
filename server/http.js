// Pequenos utilitários das funções da Vercel.

export function corpoJSON(req) {
  const b = req.body;
  if (b == null || b === '') return {};
  if (typeof b === 'string') { try { return JSON.parse(b); } catch { return null; } }
  if (Buffer.isBuffer?.(b)) { try { return JSON.parse(b.toString('utf8')); } catch { return null; } }
  return b;
}

export function responder(res, status, obj) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(obj);
}

// Domínio para as URLs de retorno/aviso do Mercado Pago. Nunca vem do corpo
// do pedido (antes vinha: qualquer pessoa podia mandar o retorno e o aviso
// de pagamento para outro domínio). Usa SITE_URL quando definido; senão o
// próprio domínio onde a função está a correr (produção ou preview).
export function baseDoSite(req) {
  const fixo = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  const host = String(req.headers?.host || '').toLowerCase();
  const hostOk = /^[a-z0-9.-]+(:\d+)?$/.test(host);
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const preview = /\.vercel\.app$/.test(host.replace(/:\d+$/, ''));
  if (hostOk && (local || preview)) return `${local ? 'http' : 'https'}://${host}`;
  if (/^https?:\/\//.test(fixo)) return fixo;
  if (hostOk && host) return `https://${host}`;
  return null;
}

export function ipDoPedido(req) {
  return String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
}
