// sitemap.xml gerado a partir dos apartamentos ativos (o Google descobre a
// página de cada apartamento, ?apto=<id>, sem depender de alguém a partilhar).
// Só lê nomes/ids de apartamentos — nenhum dado de hóspede entra aqui.

export const SITE_PADRAO = 'https://www.pinheiramar.com.br';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function montarSitemap(estado, base = SITE_PADRAO) {
  const raiz = String(base || SITE_PADRAO).replace(/\/+$/, '');
  const ativos = (estado?.apartamentos || []).filter(a => a && a.id && a.ativo !== false);
  const urls = [
    { loc: `${raiz}/`, prioridade: '1.0' },
    ...ativos.map(a => ({ loc: `${raiz}/?apto=${encodeURIComponent(a.id)}`, prioridade: '0.8' })),
    { loc: `${raiz}/?politicas`, prioridade: '0.3' },
  ];
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => `  <url><loc>${esc(u.loc)}</loc><priority>${u.prioridade}</priority></url>`).join('\n')
    + '\n</urlset>\n';
}
