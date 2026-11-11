// GET /?apto=<id> (reescrito para aqui no vercel.json): devolve o index.html
// do site com título, descrição e imagem do apartamento nas tags de prévia
// (WhatsApp/Instagram/Facebook). Qualquer falha cai no index.html comum —
// o link nunca deixa de abrir.
import { lerEstado } from '../server/estado.js';
import { SITE_PADRAO } from '../server/sitemap.js';
import { apartamentoAtivo, dadosPrevia, montarPrevia } from '../server/previa.js';
import { migrarDados } from '../src/lib/migracoes.js';

const raizDoSite = () => String(process.env.SITE_URL || SITE_PADRAO).replace(/\/+$/, '');

// De onde ler o index.html estático: do mesmo endereço em que o visitante
// entrou (assim os arquivos com hash do build batem), mas só se o host for o
// do site ou da Vercel — nunca um host qualquer vindo do cabeçalho.
export function origemEstatica(host) {
  const h = String(host || '').toLowerCase();
  let siteHost = '';
  try { siteHost = new URL(raizDoSite()).host; } catch { /* usa o padrão */ }
  const permitido = /^[a-z0-9.-]+(:\d+)?$/.test(h)
    && (h === siteHost || h === `www.${siteHost}` || h.endsWith('.vercel.app'));
  return permitido ? `https://${h}` : raizDoSite();
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
  const bruto = req.query?.apto;
  const id = Array.isArray(bruto) ? bruto[0] : bruto;
  let html;
  try {
    const r = await fetch(`${origemEstatica(req.headers.host)}/index.html`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`index.html ${r.status}`);
    html = await r.text();
  } catch (err) {
    console.error('[previa] sem index.html:', err.message || err);
    // /index.html não passa pela reescrita: o site abre normalmente e o
    // React lê o ?apto= da própria URL.
    return res.redirect(302, `/index.html?apto=${encodeURIComponent(String(id || ''))}`);
  }
  let saida = html;
  try {
    const { data } = await lerEstado();
    const estado = migrarDados(data).data;
    const apt = apartamentoAtivo(estado, id);
    if (apt) saida = montarPrevia(html, dadosPrevia(estado, apt, raizDoSite()));
  } catch (err) {
    console.error('[previa] sem dados, prévia genérica:', err.codigo || err);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // O WhatsApp guarda a prévia por muito tempo; aqui o servidor só mantém
  // 10 min para refletir mudanças de nome/descrição logo.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600');
  return res.status(200).send(req.method === 'HEAD' ? '' : saida);
}
