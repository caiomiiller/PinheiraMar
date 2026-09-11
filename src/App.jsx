import React, { useState, useEffect } from 'react';
import { Home, Settings, Waves } from 'lucide-react';
import { C, F, applyTheme } from './lib/constants';
import { loadData, saveData, STORE_KEY, seedData } from './lib/seed';
import { supabase, supabaseConfigured, APP_STATE_TABLE, APP_STATE_ROW_ID } from './lib/supabaseClient';
import { PublicSite } from './views/public/PublicSite';
import { Admin } from './views/admin/Admin';
import { LoginScreen } from './views/admin/Admin';

// Lê ?imovel=<id> da URL — o site já mostra sempre os dois residenciais
// juntos, mas isto permite um link directo que leva logo à secção de um
// imóvel específico (ex.: pinheiramar.com.br/?imovel=novoimovel), útil
// para divulgar cada imóvel separadamente nas redes sociais.
export function residencialFromURL() {
  try { return new URLSearchParams(window.location.search).get('imovel'); }
  catch { return null; }
}

export default function App() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('site');   // 'site' | 'admin'
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let d = await loadData();
      if (!d) { d = seedData(); await saveData(d); }
      if (alive) setData(d);
    })();
    return () => { alive = false; };
  }, []);

  // Sincronização entre dispositivos: quando o Supabase está configurado
  // (ver supabaseClient.js), este dispositivo escuta alterações gravadas
  // por qualquer outro (outro computador, outro telemóvel) e atualiza-se
  // sozinho, sem precisar de recarregar a página. Sem o Supabase
  // configurado isto não faz nada — comportamento igual a antes.
  useEffect(() => {
    if (!supabaseConfigured) return;
    const channel = supabase
      .channel('app_state_sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: APP_STATE_TABLE, filter: `id=eq.${APP_STATE_ROW_ID}` },
        (payload) => { if (payload.new?.data) setData(payload.new.data); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // o site público mostra sempre os dois residenciais lado a lado, por
  // isso usa sempre a paleta "de base" — só o admin troca de tema
  // consoante o imóvel que estiver a gerir (ver Admin.jsx).
  useEffect(() => { if (mode === 'site') applyTheme('pinheiramar'); }, [mode]);

  // update data (globalmente) e persiste
  const update = (arg) => setData(prev => { const next = typeof arg === 'function' ? arg(prev) : { ...prev, ...arg }; saveData(next); return next; });
  const createReservation = (r) => update(prev => ({ ...prev, reservas: [...prev.reservas, r] }));

  const css = `
    /* nunca deixar a página inteira deslocar-se na horizontal — qualquer
       elemento largo (tabelas, grelhas) deve rolar dentro do seu próprio
       contentor, nunca "puxar" o corpo da página consigo */
    html, body{overflow-x:hidden;}
    .pmf:focus{border-color:${C.brisa}!important;box-shadow:0 0 0 3px rgba(46,126,140,.16)!important;}
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
      .pm-pubsite-header-row{padding:10px 16px!important;gap:12px!important;height:auto!important;justify-content:center!important;}
      .pm-pubsite-brand-desktop{display:none!important;}
      .pm-pubsite-brand-mobile{display:block!important;height:96px!important;width:auto!important;}
      .pm-pubsite-search-desktop{display:none!important;}
      .pm-pubsite-search-inline{display:block!important;}
      .pm-pubsite-lang{display:none!important;}
      .pm-pubsite-hero{display:none!important;}
      .pm-pubsite-catstrip{padding:12px 16px!important;gap:8px!important;}
      .pm-cat-btn{flex-direction:row!important;gap:7px!important;padding:10px 16px!important;font-size:14px!important;border:1px solid #E2E0DB!important;border-radius:999px!important;background:#FFF!important;}
      .pm-cat-btn[data-active="true"]{background:#0D0D0D!important;border-color:#0D0D0D!important;color:#FFF!important;}
      .pm-cat-btn[data-active="true"] span{color:#FFF!important;}
      .pm-pubsite-main{padding:32px 16px 56px!important;}
      .pm-pubsite-group-head{gap:12px!important;}
      .pm-pubsite-group-logo{height:60px!important;}
      .pm-pubsite-group-count{width:100%!important;order:3;}
      .pm-pubsite-combo{padding:16px!important;}
      .pm-pubsite-footer-grid{padding:32px 16px!important;gap:28px!important;}

      /* ── página de detalhe do apartamento — telemóvel ── */
      .pm-detail-grid{grid-template-columns:minmax(0,1fr)!important;gap:32px!important;}
      .pm-detail-side{position:static!important;}
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
      .pm-card-photo{border-radius:14px!important;}
      .pm-card-title-row{flex-wrap:wrap!important;}
      .pm-card-title-row div:first-child{font-size:14px!important;}
      .pm-card-title-row div:last-child{font-size:11.5px!important;}
      .pm-card-tag{top:12px!important;left:12px!important;bottom:auto!important;right:auto!important;border-radius:999px!important;}
      .pm-results-grid{grid-template-columns:1fr!important;gap:28px!important;}
      .pm-row-scroll{gap:12px!important;scroll-snap-type:x mandatory!important;-webkit-overflow-scrolling:touch;}
      .pm-row-item{flex:0 0 46%!important;min-width:0!important;scroll-snap-align:start;}

      /* ── secção Destino (A Pinheira / Atrativos / Como chegar) — telemóvel: blocos empilhados, não colunas apertadas ── */
      .pm-destino-wrap{padding:0 16px 48px!important;}
      .pm-destino-2col{grid-template-columns:1fr!important;gap:28px!important;}
      .pm-destino-cards-grid{grid-template-columns:1fr!important;}
    }
    @media(prefers-reduced-motion:reduce){.pm-pop,.pm-card{animation:none!important;transition:none!important;}}
  `;

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: C.espuma, fontFamily: F.sans, color: C.inkSoft }}>
      <div style={{ textAlign: 'center' }}><Waves size={34} color={C.brisa} /><div style={{ marginTop: 10 }}>A carregar…</div></div>
    </div>
  );

  /* ── admin mode: login gate ── */
  if (mode === 'admin' && !authed) {
    return (
      <>
        <style>{css}</style>
        <LoginScreen onLogin={() => setAuthed(true)} />
      </>
    );
  }

  return (
    <div style={{ fontFamily: F.sans }}>
      <style>{css}</style>

      {/* admin top bar (only visible when in admin mode) */}
      {mode === 'admin' && (
        <div style={{ background: C.oceanDeep, color: 'rgba(255,255,255,.85)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 16px', fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Waves size={15} color={C.brisa} />
            <span style={{ fontWeight: 600, color: '#fff' }}>Painel de Gestão</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setMode('site')} style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 7, color: 'rgba(255,255,255,.85)', padding: '5px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Home size={13} /> Ver site
            </button>
            <button onClick={() => { setAuthed(false); setMode('site'); }} style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 7, color: 'rgba(255,255,255,.85)', padding: '5px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
              Sair
            </button>
          </div>
        </div>
      )}

      {/* site: botão discreto para aceder ao painel */}
      {mode === 'site' && (
        <button onClick={() => setMode('admin')}
          title="Acesso ao painel de gestão"
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 999, width: 44, height: 44, borderRadius: '50%', background: C.oceanDeep, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.28)', opacity: .72, transition: 'opacity .2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '.72'}>
          <Settings size={20} color="#fff" />
        </button>
      )}

      {mode === 'site'
        ? <PublicSite data={data} onCreate={createReservation} />
        : <Admin data={data} update={update} />}
    </div>
  );
}
