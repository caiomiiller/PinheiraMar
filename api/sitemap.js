// GET /sitemap.xml (reescrito para aqui no vercel.json) — ver server/sitemap.js.
import { lerEstado } from '../server/estado.js';
import { montarSitemap, SITE_PADRAO } from '../server/sitemap.js';
import { migrarDados } from '../src/lib/migracoes.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
  let xml;
  try {
    const { data } = await lerEstado();
    xml = montarSitemap(migrarDados(data).data, process.env.SITE_URL || SITE_PADRAO);
  } catch (err) {
    // sem banco: devolve pelo menos a página inicial, nunca um erro ao Google
    console.error('[sitemap] falhou:', err.codigo || err);
    xml = montarSitemap({ apartamentos: [] }, process.env.SITE_URL || SITE_PADRAO);
  }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
}
