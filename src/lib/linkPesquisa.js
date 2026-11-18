// Link de pesquisa compartilhável do site público — a pedido do Caio
// (2026-11-18): quem pergunta pela disponibilidade recebe um link que abre o
// site já com as datas e o nº de pessoas preenchidos.
//
//   /?entrada=2026-12-20&saida=2026-12-27&pessoas=4            → resultados
//   /?apto=a207&entrada=2026-12-20&saida=2026-12-27&pessoas=4  → apartamento
//   (&lang=es|en opcional; português é o padrão e não vai no link)
//
// Só datas, números e o id do apartamento: nenhum dado pessoal. Qualquer
// parte inválida é ignorada em silêncio — o site abre normalmente.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOITES = 90;
const MAX_PESSOAS = 30;
export const PARAMS_PESQUISA = ['entrada', 'saida', 'pessoas', 'lang'];

const dataValida = (s) => {
  if (!ISO.test(s || '')) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const noites = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

// `search` = window.location.search; `hoje` = 'AAAA-MM-DD' (fuso do Brasil)
export function lerPesquisaDaUrl(search, { hoje, idiomas = ['pt', 'es', 'en'] } = {}) {
  let p;
  try { p = new URLSearchParams(search || ''); } catch { return {}; }
  const out = {};
  const ci = p.get('entrada'), co = p.get('saida');
  if (dataValida(ci) && dataValida(co) && (!hoje || ci >= hoje)) {
    const n = noites(ci, co);
    if (n >= 1 && n <= MAX_NOITES) { out.ci = ci; out.co = co; }
  }
  const pessoas = Number(p.get('pessoas'));
  if (Number.isInteger(pessoas) && pessoas >= 1 && pessoas <= MAX_PESSOAS) out.hosp = pessoas;
  const lang = p.get('lang');
  if (lang && idiomas.includes(lang)) out.lang = lang;
  return out;
}

// Monta o link a partir da pesquisa atual. `base` = origem + caminho do site.
export function montarLinkPesquisa(base, { ci, co, hosp, apto, lang } = {}) {
  const p = new URLSearchParams();
  if (apto) p.set('apto', apto);
  if (dataValida(ci) && dataValida(co) && noites(ci, co) >= 1) { p.set('entrada', ci); p.set('saida', co); }
  if (Number.isInteger(hosp) && hosp >= 1 && hosp <= MAX_PESSOAS) p.set('pessoas', String(hosp));
  if (lang && lang !== 'pt') p.set('lang', lang);
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}

// Tira do endereço os parâmetros da pesquisa depois de lidos (o resto, como
// ?apto=, fica) — assim o endereço não fica a mostrar uma pesquisa antiga
// depois de o visitante mudar as datas.
export function semParametrosPesquisa(href) {
  try {
    const u = new URL(href);
    PARAMS_PESQUISA.forEach(k => u.searchParams.delete(k));
    return u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : '') + u.hash;
  } catch { return null; }
}

// No celular/tablet usa a janela de compartilhar do aparelho (WhatsApp etc.);
// no computador copia o link (a janela do Windows não ajuda aqui).
export async function compartilharLink({ url, titulo, texto }) {
  const toque = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  if (toque && navigator.share) {
    try { await navigator.share({ title: titulo, text: texto, url }); return 'partilhado'; }
    catch { return 'cancelado'; }
  }
  try { await navigator.clipboard.writeText(url); return 'copiado'; }
  catch {
    // navegadores sem a API de área de transferência
    const t = document.createElement('textarea');
    t.value = url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    let ok;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(t);
    return ok ? 'copiado' : 'falhou';
  }
}
