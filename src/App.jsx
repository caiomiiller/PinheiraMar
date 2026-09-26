import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Waves, RefreshCw, FlaskConical } from 'lucide-react';
import { C, F, applyTheme, TELEFONE_CONTATO } from './lib/constants';
import { PublicSite } from './views/public/PublicSite';
import { carregarPublico, reservar, limparCopiasAntigas } from './lib/dadosPublico';
import { SEM_CONFIG, AMBIENTE_TESTE, MODO_DEMO } from './lib/config';

// O painel (e as bibliotecas que só ele usa: supabase-js, Excel) só é
// descarregado por quem abre ?gestao — o site público fica bem mais leve.
const PainelGestao = lazy(() => import('./views/admin/PainelGestao'));

// Não há botão visível para o painel no site público — o acesso é por um
// link direto (ex.: pinheiramar.com.br/?gestao), protegido por login.
function modoFromURL() {
  try { return new URLSearchParams(window.location.search).has('gestao') ? 'admin' : 'site'; }
  catch { return 'site'; }
}

// Tira o "?gestao" da barra de endereço sem recarregar a página.
function limparURLGestao() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('gestao');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch { /* sem window.history — ignora */ }
}

export function Carregando({ texto = 'Carregando…' }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: C.espuma, fontFamily: F.sans, color: C.inkSoft }}>
      <div style={{ textAlign: 'center' }}><Waves size={34} color={C.brisa} /><div style={{ marginTop: 10, fontSize: 16 }}>{texto}</div></div>
    </div>
  );
}

export function Aviso({ titulo, texto, acao, rotuloAcao = 'Tentar de novo' }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: C.espuma, fontFamily: F.sans, padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: 'center', color: C.ink }}>
        <Waves size={34} color={C.brisa} />
        <h1 style={{ fontSize: 22, fontWeight: 400, margin: '12px 0 8px' }}>{titulo}</h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: C.inkSoft }}>{texto}</p>
        {acao && (
          <button onClick={acao} style={{ marginTop: 20, minHeight: 48, padding: '0 22px', border: 'none', borderRadius: 12, background: C.ocean, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: F.sans }}>
            <RefreshCw size={18} /> {rotuloAcao}
          </button>
        )}
      </div>
    </div>
  );
}

// Faixa de aviso nos previews da Vercel (VITE_AMBIENTE=teste) e na demonstração.
function FaixaTeste() {
  return (
    <div role="status" style={{ background: '#FFF4D6', color: '#5C4400', borderBottom: '1px solid #E9D18A', fontSize: 13.5, fontWeight: 600, padding: '7px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: F.sans }}>
      <FlaskConical size={15} /> {MODO_DEMO ? 'Demonstração — dados fictícios, nada é gravado no sistema real.' : 'Ambiente de testes — não use para reservas reais.'}
    </div>
  );
}

function SitePublico() {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    setErro(false);
    try { setData(await carregarPublico()); }
    catch (e) { console.warn('[site] não foi possível carregar os dados', e); setErro(true); }
  }, []);

  useEffect(() => { limparCopiasAntigas(); applyTheme('pinheiramar'); carregar(); }, [carregar]);

  // disponibilidade fresca ao voltar ao separador (ex.: depois de ir ao WhatsApp)
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregarPublico().then(setData).catch(() => {}); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, []);

  // a reserva é feita no servidor; depois disso (ou se as datas/preço
  // mudaram entretanto) recarrega a disponibilidade
  const onReservar = useCallback(async (pedido) => {
    const r = await reservar(pedido);
    if (r.ok || r.erro === 'indisponivel' || r.erro === 'preco_mudou') carregarPublico().then(setData).catch(() => {});
    return r;
  }, []);

  if (SEM_CONFIG) return <Aviso titulo="Site em manutenção" texto={`Voltamos em instantes. Para reservar agora, fale conosco pelo WhatsApp ${TELEFONE_CONTATO}.`} />;
  if (!data && erro) return <Aviso titulo="Não foi possível carregar o site" texto={`Verifique a sua conexão e tente de novo. Se preferir, fale conosco pelo WhatsApp ${TELEFONE_CONTATO}.`} acao={carregar} />;
  if (!data) return <Carregando />;
  return <PublicSite data={data} onReservar={onReservar} />;
}

export default function App() {
  const [mode, setMode] = useState(modoFromURL);   // 'site' | 'admin'

  const css = `
    /* nunca deixar a página inteira deslocar-se na horizontal — qualquer
       elemento largo (tabelas, grelhas) deve rolar dentro do seu próprio
       contentor, nunca "puxar" o corpo da página consigo */
    html, body{overflow-x:clip;}
    .pmf:focus{border-color:${C.brisa}!important;box-shadow:0 0 0 3px rgba(45,127,157,.16)!important;}
    .pm-pop{animation:pmpop .18s ease;}
    @keyframes pmpop{from{opacity:0;transform:translateY(8px) scale(.99);}to{opacity:1;transform:none;}}
    .pm-card{transition:box-shadow .18s ease, transform .18s ease;}
    .pm-card:hover{box-shadow:0 14px 34px rgba(10,40,46,.12);transform:translateY(-2px);}
    .pm-unit-card{transition:transform .15s ease;}
    .pm-unit-card:hover{transform:translateY(-3px);}
    *::-webkit-scrollbar{height:10px;width:10px;}
    *::-webkit-scrollbar-thumb{background:#C4D3D1;border-radius:8px;}
    .pm-detail-gallery>div:nth-child(n+6){display:none;}
    .pm-detail-counter-mobile{display:none;}
    .pm-pubsite-hcats::-webkit-scrollbar{display:none;}
    @media(max-width:760px){
      .pm-sidebar{display:none!important;}
      .pm-tabbar{display:flex!important;}
      .pm-mobile-picker{display:block!important;}
      .pm-hide-sm{display:none!important;}

      /* ── painel de gestão — telemóvel ── */
      .pm-res-toolbar{flex-direction:column!important;align-items:stretch!important;}
      .pm-res-toggle{width:100%!important;}
      .pm-res-toggle button{flex:1!important;}
      .pm-res-monthpicker{margin-left:0!important;display:flex!important;justify-content:center!important;}
      .pm-res-navrow{margin-left:0!important;width:100%!important;justify-content:center!important;flex-wrap:wrap!important;row-gap:8px!important;}
      .pm-res-legend{gap:10px!important;justify-content:center!important;}
      .pm-fin-kpi-value{font-size:15px!important;}
      .pm-pay-mobile{display:block!important;}
      .pm-apt-row{flex-wrap:wrap!important;}
      .pm-apt-info{flex-basis:100%!important;order:3!important;margin-top:8px!important;}
      .pm-policy-grid{grid-template-columns:1fr!important;}
      .pm-policy-side{border-right:none!important;border-bottom:1px solid ${C.line}!important;padding:16px!important;}
      .pm-policy-main{padding:16px!important;}
      .pm-res-listcards{display:block!important;}
      .pm-taxa-row{gap:8px!important;}
      .pm-taxa-name{flex-basis:100%!important;order:-1!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;}
      .pm-taxa-price{min-width:auto!important;}
      .pm-taxa-tipo{min-width:auto!important;}
      .pm-taxa-por{min-width:auto!important;}
      .pm-pay-row{flex-wrap:wrap!important;}
      .pm-pay-icon{display:none!important;}
      .pm-pay-actions{flex-basis:100%!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;margin-top:8px!important;}
      .pm-search-grid{grid-template-columns:1fr 1fr!important;}
      .pm-book-grid{grid-template-columns:1fr!important;}
      .pm-dash-grid{grid-template-columns:1fr!important;}
      .pm-searchbar{flex-direction:column!important;border-radius:18px!important;}
      .pm-seg{border-right:none!important;border-bottom:1px solid #ddd!important;}
      .pm-search-btn{margin:10px!important;width:calc(100% - 20px)!important;justify-content:center!important;}

      /* ── site público (booking-style) — telemóvel ── */
      /* no telemóvel o cabeçalho rola com a página em vez de ficar fixo — no
         ecrã pequeno ocupava espaço desnecessário, a pedido do Caio. No
         desktop continua fixo. */
      .pm-pubsite-header{position:static!important;}
      .pm-pubsite-header-row{padding:10px 16px!important;gap:10px!important;height:auto!important;justify-content:space-between!important;position:relative!important;}
      /* sem logo no cabeçalho do telemóvel: lá ficam os filtros (só ícones,
         com rolagem para o lado) e a faixa de categorias de baixo some — a
         pedido do Caio, 2026-09. A marca continua no rodapé. */
      .pm-pubsite-brand{display:none!important;}
      .pm-pubsite-hcats{display:flex!important;}
      .pm-pubsite-catbar{display:none!important;}
      .pm-pubsite-search-desktop{display:none!important;}
      .pm-pubsite-search-inline{display:block!important;}
      /* idioma volta a aparecer no telemóvel, fixo no canto superior direito do
         cabeçalho (fora do fluxo, para não empurrar a logo centralizada) — o
         mesmo lugar em que já fica na versão desktop, a pedido do Caio,
         2026-09-23. */
      .pm-pubsite-lang{display:flex!important;position:static!important;}
      .pm-pubsite-hero{display:none!important;}
      .pm-pubsite-main{padding:32px 16px 56px!important;}
      .pm-pubsite-group-head{gap:12px!important;flex-direction:column!important;align-items:center!important;text-align:center!important;border-bottom:none!important;margin-bottom:0!important;}
      
      .pm-pubsite-group-brand{font-size:19px!important;text-align:center!important;}
      .pm-pubsite-group-info{align-items:center!important;text-align:center!important;}
      .pm-pubsite-group-region{justify-content:center!important;}
      .pm-pubsite-group-count{width:100%!important;order:3;text-align:center!important;}
      .pm-pubsite-group{margin-bottom:44px!important;}
      /* setas de navegação do carrossel somem no telemóvel — lá o gesto natural
         é arrastar o dedo sobre os cartões, a pedido do Caio, 2026-09-23. */
      .pm-row-arrows{display:none!important;}
      .pm-pubsite-combo{padding:16px!important;}
      .pm-pubsite-footer-grid{padding:32px 16px!important;gap:28px!important;}

      /* ── página de detalhe do apartamento — telemóvel ── */
      .pm-detail-grid{grid-template-columns:minmax(0,1fr)!important;gap:32px!important;}
      .pm-detail-side{position:static!important;}
      /* quadro de reserva: fora do fluxo da página; abre como folha de ecrã inteiro */
      .pm-detail-side[data-sheet="closed"]{display:none!important;}
      .pm-detail-side[data-sheet="open"]{display:block!important;position:fixed!important;inset:0!important;z-index:300!important;background:#fff!important;overflow-y:auto!important;padding:max(16px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))!important;}
      .pm-detail-sheethead{display:flex!important;}
      .pm-detail-gallery{display:flex!important;overflow-x:auto!important;gap:6px!important;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;}
      .pm-detail-gallery>div{display:block!important;grid-row:auto!important;flex:0 0 86%!important;height:240px!important;scroll-snap-align:start;border-radius:10px;}

      /* ── modais (reserva, confirmação, admin) — ecrã cheio no telemóvel ── */
      .pm-modal-overlay{padding:0!important;align-items:stretch!important;overflow:hidden!important;}
      .pm-modal-card{max-width:none!important;width:100%!important;height:100vh!important;height:100dvh!important;max-height:100vh!important;max-height:100dvh!important;border-radius:0!important;margin:0!important;display:flex!important;flex-direction:column!important;box-shadow:none!important;}
      .pm-modal-body{flex:1 1 auto!important;overflow-y:auto!important;}
      .pm-modal-header{flex-shrink:0!important;}
      .pm-modal-progress{flex-shrink:0!important;}
      .pm-modal-footer{flex-shrink:0!important;padding-bottom:max(16px, env(safe-area-inset-bottom))!important;}

      /* ── página de detalhe — fotos primeiro, ícones flutuantes, barra de preço fixa ── */
      .pm-detail-wrap{padding-bottom:96px!important;}
      .pm-detail-topbar{display:none!important;}
      .pm-detail-reorder{display:flex!important;flex-direction:column!important;}
      .pm-detail-gallery-block{order:1!important;margin-bottom:20px!important;}
      .pm-detail-title-block{order:2!important;}
      .pm-detail-maingrid{order:3!important;}
      .pm-detail-float-nav{display:flex!important;}
      .pm-detail-counter{display:block!important;}
      .pm-detail-counter-mobile{display:inline!important;}
      .pm-detail-counter-desktop{display:none!important;}
      .pm-detail-stickybar{display:flex!important;}

      /* ── cartões de apartamento — mais 'app', um por linha, carrossel a espiar o próximo ── */
      /* pm-card-title-row é agora o título sozinho (a capacidade passou para a
         linha de detalhes, ver PublicSite.jsx) — só o tamanho da fonte muda no
         telemóvel. */
      .pm-card-title-row{font-size:14px!important;}
      .pm-results-grid{grid-template-columns:1fr!important;gap:28px!important;}
      .pm-row-scroll{gap:12px!important;scroll-snap-type:x mandatory!important;-webkit-overflow-scrolling:touch;}
      .pm-row-item{flex:0 0 46%!important;min-width:0!important;scroll-snap-align:start;}

      /* ── secção Destino (A Pinheira / Atrativos / Como chegar) — telemóvel: blocos empilhados, não colunas apertadas ── */
      .pm-destino-wrap{padding:0 16px 48px!important;}
      .pm-destino-2col{grid-template-columns:1fr!important;gap:28px!important;}
      .pm-destino-cards-grid{grid-template-columns:1fr!important;}
    }
    .pm-girar{animation:pm-girar 1s linear infinite;}
    @keyframes pm-girar{to{transform:rotate(360deg);}}
    @media(prefers-reduced-motion:reduce){.pm-pop,.pm-card{animation:none!important;transition:none!important;}}
  `;

  return (
    <div style={{ fontFamily: F.sans }}>
      <style>{css}</style>
      {(AMBIENTE_TESTE || MODO_DEMO) && <FaixaTeste />}
      {mode === 'site'
        ? <SitePublico />
        : (
          <Suspense fallback={<Carregando />}>
            <PainelGestao onVerSite={() => { limparURLGestao(); setMode('site'); }} />
          </Suspense>
        )}
    </div>
  );
}
