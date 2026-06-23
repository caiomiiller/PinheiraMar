import React, { useState, useEffect, useCallback } from 'react';
import { Home, Settings, Waves } from 'lucide-react';
import { C, F } from './lib/constants';
import { loadData, saveData, STORE_KEY } from './lib/seed';
import { PublicSite } from './views/public/PublicSite';
import { Admin } from './views/admin/Admin';
import { LoginScreen } from './views/admin/Admin';

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
 
  // update data and persist to localStorage
  const update = (arg) => setData(prev => { const next = typeof arg === 'function' ? arg(prev) : { ...prev, ...arg }; saveData(next); return next; });
  const createReservation = (r) => update(prev => ({ ...prev, reservas: [...prev.reservas, r] }));

  const css = `
    .pmf:focus{border-color:${C.brisa}!important;box-shadow:0 0 0 3px rgba(46,126,140,.16)!important;}
    .pm-pop{animation:pmpop .18s ease;}
    @keyframes pmpop{from{opacity:0;transform:translateY(8px) scale(.99);}to{opacity:1;transform:none;}}
    .pm-card{transition:box-shadow .18s ease, transform .18s ease;}
    .pm-card:hover{box-shadow:0 14px 34px rgba(10,40,46,.12);transform:translateY(-2px);}
    .pm-unit-card{transition:transform .15s ease;}
    .pm-unit-card:hover{transform:translateY(-3px);}
    *::-webkit-scrollbar{height:10px;width:10px;}
    *::-webkit-scrollbar-thumb{background:#C4D3D1;border-radius:8px;}
    @media(max-width:760px){
      .pm-sidebar{display:none!important;}
      .pm-tabbar{display:flex!important;}
      .pm-hide-sm{display:none!important;}
      .pm-search-grid{grid-template-columns:1fr 1fr!important;}
      .pm-book-grid{grid-template-columns:1fr!important;}
      .pm-dash-grid{grid-template-columns:1fr!important;}
      .pm-searchbar{flex-direction:column!important;border-radius:18px!important;}
      .pm-seg{border-right:none!important;border-bottom:1px solid #ddd!important;}
      .pm-search-btn{margin:10px!important;width:calc(100% - 20px)!important;justify-content:center!important;}
    }
    @media(prefers-reduced-motion:reduce){.pm-pop,.pm-card{animation:none!important;transition:none!important;}}
  `;

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: C.espuma, fontFamily: F.sans, color: C.inkSoft }}>
      <div style={{ textAlign: 'center' }}><Waves size={34} color={C.brisa} /><div style={{ marginTop: 10 }}>A carregar o PinheiraMar…</div></div>
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
            <span style={{ opacity: .6 }}>· PinheiraMar</span>
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

      {/* site bottom-right admin access button (discreet) */}
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

