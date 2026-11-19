// Prévia do link de um apartamento (/?apto=<id>) no WhatsApp, Facebook,
// Instagram, Google etc.
//
// A regra de "rewrites" do vercel.json não chegava a correr: a Vercel entrega
// o index.html estático da raiz antes de olhar para as reescritas. Este
// middleware corre ANTES dos arquivos estáticos e, só para os robôs que montam
// prévias ou indexam o site, manda o pedido para /api/previa (que devolve o
// mesmo index.html com título, descrição e imagem do apartamento).
// Visitantes normais seguem direto para o site estático, sem atraso nenhum.
// Não lê nem grava dados — só decide para onde o pedido vai.

export const config = { matcher: '/' };

const ROBOS = /whatsapp|facebookexternalhit|facebookcatalog|meta-externalagent|twitterbot|telegrambot|slackbot|linkedinbot|discordbot|skypeuripreview|pinterest|redditbot|embedly|iframely|vkshare|viber|googlebot|google-inspectiontool|bingbot|applebot|duckduckbot|yandex/i;

export const ehRoboDePrevia = (ua) => ROBOS.test(String(ua || ''));

// Devolve o endereço de /api/previa para onde reescrever, ou null para seguir normal.
export function destinoPrevia(urlPedido, userAgent) {
  let url;
  try { url = new URL(urlPedido); } catch { return null; }
  if (url.pathname !== '/') return null;
  const apto = url.searchParams.get('apto');
  if (!apto || !ehRoboDePrevia(userAgent)) return null;
  const destino = new URL('/api/previa', url.origin);
  destino.searchParams.set('apto', apto.slice(0, 40));
  return destino.toString();
}

export default function middleware(request) {
  const destino = destinoPrevia(request.url, request.headers.get('user-agent'));
  if (!destino) return; // sem resposta = o pedido segue normalmente
  return new Response(null, { headers: { 'x-middleware-rewrite': destino } });
}
