// Prévia de um apartamento ao compartilhar o link (?apto=<id>).
// O WhatsApp, o Instagram e o Facebook leem só o HTML bruto (não executam
// JavaScript), então o título e a foto da prévia precisam estar no HTML que o
// servidor devolve. Aqui o index.html é reaproveitado e só as tags de
// título/descrição/imagem são trocadas. Só dados públicos do apartamento
// entram — nada de hóspedes.
import { SITE_PADRAO } from './sitemap.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const cortar = (s, max) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
};

// Foto da prévia. Hoje: a imagem 1200×630 do grupo (as fotos dos apartamentos
// têm ~500 KB e o WhatsApp descarta imagens grandes). Quando existirem
// imagens próprias por apartamento (public/og/<id>.jpg), é só trocar aqui.
export function imagemPrevia(_apt, raiz) {
  return `${raiz}/og-image.jpg`;
}

export function apartamentoAtivo(estado, id) {
  if (!id || typeof id !== 'string') return null;
  return (estado?.apartamentos || []).find(a => a && a.id === id && a.ativo !== false) || null;
}

export function dadosPrevia(estado, apt, base = SITE_PADRAO) {
  const raiz = String(base || SITE_PADRAO).replace(/\/+$/, '');
  const res = (estado?.residenciais || []).find(r => r.id === apt.residencialId) || {};
  const nomeRes = res.nome || 'Grupo PinheiraMar';
  const regiao = res.regiaoLabel || 'na Praia da Pinheira';
  const resumo = apt.descricao ? cortar(apt.descricao, 120) : cortar(apt.tipo || apt.nome, 120);
  return {
    titulo: `${apt.nome} · ${nomeRes}`,
    descricao: `${resumo.replace(/[.\s]+$/, '')}. ${nomeRes} ${regiao}. Veja as datas livres e reserve online.`,
    url: `${raiz}/?apto=${encodeURIComponent(apt.id)}`,
    imagem: imagemPrevia(apt, raiz),
    alt: `${apt.nome} — ${nomeRes}`,
  };
}

const trocar = (html, regex, novo) => html.replace(regex, () => novo);

export function montarPrevia(html, p) {
  let h = String(html);
  h = trocar(h, /<title>[\s\S]*?<\/title>/i, `<title>${esc(p.titulo)}</title>`);
  h = trocar(h, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${esc(p.descricao)}" />`);
  h = trocar(h, /<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${esc(p.titulo)}" />`);
  h = trocar(h, /<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${esc(p.descricao)}" />`);
  h = trocar(h, /<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${esc(p.url)}" />`);
  h = trocar(h, /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${esc(p.imagem)}" />`);
  h = trocar(h, /<meta\s+property="og:image:alt"[^>]*>/i, `<meta property="og:image:alt" content="${esc(p.alt)}" />`);
  return h;
}
