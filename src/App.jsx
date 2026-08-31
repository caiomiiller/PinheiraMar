import React, { useState, useEffect, useMemo } from 'react';
import { Home, Settings, Waves, ArrowRight, MapPin } from 'lucide-react';
import { C, F, applyTheme } from './lib/constants';
import { loadData, saveData, STORE_KEY, seedData } from './lib/seed';
import { buildScoped } from './lib/multiProperty';
import { PublicSite } from './views/public/PublicSite';
import { Admin } from './views/admin/Admin';
import { LoginScreen } from './views/admin/Admin';

// Lê ?imovel=<id> da URL, para se poder divulgar um link directo a cada
// residencial (ex.: pinheiramar.com.br/?imovel=novoimovel) sem passar pela
// página de escolha.
function residencialFromURL() {
  try { return new URLSearchParams(window.location.search).get('imovel'); }
  catch { return null; }
}

export default function App() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('landing');   // 'landing' | 'site' | 'admin'
  const [residencialId, setResidencialId] = useState(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let d = await loadData();
      if (!d) { d = seedData(); await saveData(d); }
      if (alive) {
        setData(d);
        const fromURL = residencialFromURL();
        if (fromURL && d.residenciais.some(r => r.id === fromURL)) {
          setResidencialId(fromURL);
          setMode('site');
        } else if (d.residenciais.length === 1) {
          setResidencialId(d.residenciais[0].id);
          setMode('site');
        }
      }
    })();
    return () => { alive = false; };
  }, []);

  // aplica a paleta de cores do imóvel seleccionado (C é mutado in-place —
  // ver src/lib/constants.js — por isso todos os componentes que já
  // importaram { C } vêem a mudança no próximo render)
  useEffect(() => { if (residencialId) applyTheme(residencialId); }, [residencialId]);

  // update data (globalmente) e persiste
  const update = (arg) => setData(prev => { const next = typeof arg === 'function' ? arg(prev) : { ...prev, ...arg }; saveData(next); return next; });
  const createReservation = (r) => update(prev => ({ ...prev, reservas: [...prev.reservas, r] }));

  const scopedData = useMemo(() => (data && residencialId ? buildScoped(data, residencialId) : null), [data, residencialId]);

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
      <div style={{ textAlign: 'center' }}><Waves size={34} color={C.brisa} /><div style={{ marginTop: 10 }}>A carregar…</div></div>
    </div>
  );

  /* ── página inicial: escolher o imóvel ── */
  if (mode === 'landing') {
    return (
      <>
        <style>{css}</style>
        <LandingPicker
          residenciais={data.residenciais}
          onPick={(id) => { setResidencialId(id); setMode('site'); }}
          onAdmin={() => { setResidencialId(data.residenciais[0].id); setMode('admin'); }}
        />
      </>
    );
  }

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
            <button onClick={() => setMode('landing')} style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 7, color: 'rgba(255,255,255,.85)', padding: '5px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Home size={13} /> Ver site
            </button>
            <button onClick={() => { setAuthed(false); setMode('landing'); }} style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 7, color: 'rgba(255,255,255,.85)', padding: '5px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
              Sair
            </button>
          </div>
        </div>
      )}

      {/* site: botão discreto para trocar de imóvel / aceder ao painel */}
      {mode === 'site' && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          {data.residenciais.length > 1 && (
            <button onClick={() => setMode('landing')}
              title="Ver o outro imóvel"
              style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', border: `1px solid ${C.line}`, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.18)' }}>
              <Home size={18} color={C.ink} />
            </button>
          )}
          <button onClick={() => setMode('admin')}
            title="Acesso ao painel de gestão"
            style={{ width: 44, height: 44, borderRadius: '50%', background: C.oceanDeep, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.28)', opacity: .72, transition: 'opacity .2s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '.72'}>
            <Settings size={20} color="#fff" />
          </button>
        </div>
      )}

      {mode === 'site' && scopedData
        ? <PublicSite data={scopedData} onCreate={createReservation} />
        : mode === 'admin'
          ? <Admin data={data} update={update} initialResidencialId={residencialId} />
          : null}
    </div>
  );
}

/* ── Página inicial: escolher entre os residenciais ── */
function LandingPicker({ residenciais, onPick, onAdmin }) {
  return (
    <div style={{ minHeight: '100vh', background: '#15302E', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: F.sans, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', marginBottom: 8 }}>
        <Waves size={22} />
        <span style={{ fontFamily: F.disp, fontSize: 22 }}>Os nossos residenciais</span>
      </div>
      <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 14, marginBottom: 36, textAlign: 'center', maxWidth: 460 }}>
        Escolha o imóvel para ver os apartamentos, disponibilidade e reservar.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(residenciais.length, 2)}, minmax(260px, 340px))`, gap: 24 }}>
        {residenciais.map(r => (
          <button key={r.id} onClick={() => onPick(r.id)}
            className="pm-card"
            style={{ textAlign: 'left', cursor: 'pointer', border: 'none', borderRadius: 18, overflow: 'hidden', background: '#fff', padding: 0 }}>
            <div style={{ height: 120, backgroundImage: `url(${r.heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div style={{ padding: '18px 20px' }}>
              <div style={{ fontFamily: F.disp, fontSize: 19, marginBottom: 6, color: '#15302E' }}>{r.nome}</div>
              <div style={{ fontSize: 13, color: '#666', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <MapPin size={13} /> {r.regiaoLabel}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#0E4A58' }}>
                Ver apartamentos <ArrowRight size={14} />
              </div>
            </div>
          </button>
        ))}
      </div>
      <button onClick={onAdmin} style={{ marginTop: 44, background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Settings size={13} /> Acesso ao painel de gestão
      </button>
    </div>
  );
}
