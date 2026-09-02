import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LayoutDashboard, CalendarDays, Wallet, Building2, Tag, CreditCard,
  Users, Settings, Waves, Home, Plus, Minus, AlertCircle, Sun, ChevronDown } from 'lucide-react';
import { C, F, applyTheme } from '../../lib/constants';
import { buildScoped, mergeScopedBack } from '../../lib/multiProperty';
import { Btn } from '../../components/ui';
import { Dashboard } from './Dashboard';
import { Financeiro } from './Financeiro';
import { Reservations } from './Reservations';
import { Apartments } from './Apartments';
import { Seasons } from './Seasons';
import { TaxasView } from './Taxas';
import { CuponsView } from './Cupons';
import { IdiomasView } from './Idiomas';
import { PoliticasView } from './Politicas';
import { SettingsView } from './Settings';
import { PaymentsView } from './Payments';

export const TABS = [
  { id: 'painel', label: 'Painel', icon: LayoutDashboard },
  { id: 'reservas', label: 'Reservas', icon: CalendarDays },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'apartamentos', label: 'Apartamentos', icon: Home },
  { id: 'temporadas', label: 'Opções de preços', icon: Tag },
  { id: 'taxas', label: 'Taxas Adicionais', icon: Plus },
  { id: 'cupons', label: 'Cupons', icon: Minus },
  { id: 'politicas', label: 'Políticas', icon: AlertCircle },
  { id: 'idiomas', label: 'Idiomas', icon: Sun },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
  { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard },
];

export function Admin({ data, update, initialResidencialId }) {
  const [tab, setTab] = useState('painel');
  const [residencialId, setResidencialId] = useState(initialResidencialId || data.residenciais[0].id);
  const residencial = data.residenciais.find(r => r.id === residencialId) || data.residenciais[0];
  const [picker, setPicker] = useState(false);

  useEffect(() => { applyTheme(residencialId); }, [residencialId]);

  // `scoped` tem a mesma forma que o antigo `data` de um único imóvel
  // (settings/apartamentos/reservas já filtrados); `scopedUpdate` traduz
  // as alterações de volta para o store completo — ver src/lib/multiProperty.js
  const scoped = useMemo(() => buildScoped(data, residencialId), [data, residencialId]);
  const scopedUpdate = (arg) => update(prev => {
    const prevScoped = buildScoped(prev, residencialId);
    const nextScoped = typeof arg === 'function' ? arg(prevScoped) : { ...prevScoped, ...arg };
    return mergeScopedBack(prev, residencialId, nextScoped);
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: F.sans, color: C.ink, background: C.espuma }}>
      {/* sidebar (md+) */}
      <aside className="pm-sidebar" style={{ width: 240, background: C.ocean, color: 'rgba(255,255,255,.78)', flexShrink: 0, padding: '22px 14px', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 18px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', color: '#fff' }}><Waves size={19} /></div>
          <div><div style={{ fontFamily: F.disp, fontSize: 17, color: '#fff', lineHeight: 1 }}>Gestão</div><div style={{ fontSize: 10.5, letterSpacing: '.1em' }}>PAINEL</div></div>
        </div>

        {/* seletor de imóvel */}
        {data.residenciais.length > 1 && (
          <div style={{ position: 'relative', margin: '0 8px 18px' }}>
            <button onClick={() => setPicker(p => !p)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '9px 11px', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.16)',
              borderRadius: 10, color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, textAlign: 'left',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{residencial.nome}</span>
              <ChevronDown size={14} style={{ flexShrink: 0 }} />
            </button>
            {picker && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,.28)', zIndex: 60 }}>
                {data.residenciais.map(r => (
                  <button key={r.id} onClick={() => { setResidencialId(r.id); setPicker(false); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: r.id === residencialId ? C.espuma : '#fff', color: C.ink, cursor: 'pointer', fontSize: 13, fontWeight: r.id === residencialId ? 700 : 500 }}>
                    {r.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {TABS.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', marginBottom: 3,
              background: on ? 'rgba(255,255,255,.13)' : 'transparent', color: on ? '#fff' : 'rgba(255,255,255,.78)',
              border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: on ? 600 : 500, textAlign: 'left',
            }}><t.icon size={18} /> {t.label}</button>
          );
        })}
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* mobile tab bar */}
        <div className="pm-tabbar" style={{ display: 'none', background: C.ocean, padding: '10px', gap: 6, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: 'none', whiteSpace: 'nowrap', background: tab === t.id ? 'rgba(255,255,255,.16)' : 'transparent', color: '#fff', fontSize: 13, fontWeight: 600 }}><t.icon size={15} /> {t.label}</button>
          ))}
        </div>
        <main style={{ padding: 'clamp(18px, 3vw, 34px)', maxWidth: 1180, margin: '0 auto' }}>
          {tab === 'painel' && <Dashboard data={scoped} go={setTab} />}
          {/* Reservas é partilhado pelos dois residenciais (não usa o "recorte" do
              imóvel seleccionado) — o gestor regista/confirma reservas de qualquer
              imóvel neste mesmo ambiente, com uma etiqueta de cor a identificar a
              qual residencial cada apartamento pertence. Ver Reservations.jsx. */}
          {tab === 'reservas' && <Reservations data={data} update={update} />}
          {tab === 'financeiro' && <Financeiro data={scoped} go={setTab} />}
          {tab === 'apartamentos' && <Apartments data={scoped} update={scopedUpdate} />}
          {tab === 'temporadas' && <Seasons data={scoped} update={scopedUpdate} />}
          {tab === 'taxas' && <TaxasView data={scoped} update={scopedUpdate} />}
          {tab === 'cupons' && <CuponsView data={scoped} update={scopedUpdate} />}
          {tab === 'politicas' && <PoliticasView data={scoped} update={scopedUpdate} />}
          {tab === 'idiomas' && <IdiomasView data={scoped} update={scopedUpdate} />}
          {tab === 'configuracoes' && <SettingsView data={scoped} update={scopedUpdate} />}
          {tab === 'pagamentos' && <PaymentsView data={scoped} update={scopedUpdate} />}
        </main>
      </div>
    </div>
  );
}

export const ADMIN_PIN = '1234'; // altere aqui o PIN de acesso ao painel

export function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);
  const inputRef = useRef(null);

  const attempt = () => {
    if (pin === ADMIN_PIN) { setError(false); onLogin(); }
    else { setError(true); setPin(''); setTimeout(() => setError(false), 1800); inputRef.current?.focus(); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.oceanDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.sans, padding: 24 }}>
      <div className="pm-pop" style={{ background: '#fff', borderRadius: 24, padding: '40px 36px', width: '100%', maxWidth: 380, boxShadow: '0 32px 80px rgba(0,0,0,.36)' }}>
        {/* logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <img src="/icons/icon-192.png" alt="Pinheira" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', marginBottom: 14, boxShadow: '0 2px 10px rgba(0,0,0,.12)' }} />
          <div style={{ fontFamily: F.disp, fontSize: 22, fontWeight: 600, color: C.ink }}>Gestão de Residenciais</div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2, letterSpacing: '.06em', textTransform: 'uppercase' }}>Acesso ao painel</div>
        </div>

        {/* PIN field */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft, display: 'block', marginBottom: 6 }}>PIN de acesso</label>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              type={show ? 'text' : 'password'}
              inputMode="numeric"
              value={pin}
              autoFocus
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={e => e.key === 'Enter' && attempt()}
              placeholder="••••"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '13px 44px 13px 16px',
                fontSize: 22, letterSpacing: '0.3em', fontFamily: 'monospace',
                border: `2px solid ${error ? '#E53935' : C.line}`,
                borderRadius: 12, outline: 'none', background: error ? '#FFF5F5' : '#fff',
                transition: 'border-color .2s, background .2s',
              }} />
            <button onClick={() => setShow(s => !s)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.inkSoft, fontSize: 18, lineHeight: 1, padding: 4 }}>
              {show ? '🙈' : '👁'}
            </button>
          </div>
          {error && <div style={{ color: '#E53935', fontSize: 12.5, marginTop: 6, fontWeight: 600 }}>PIN incorreto. Tente novamente.</div>}
        </div>

        <button onClick={attempt}
          style={{ width: '100%', padding: '14px 0', background: C.ocean, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15.5, cursor: 'pointer', fontFamily: F.sans, letterSpacing: '.01em', transition: 'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = C.oceanDeep}
          onMouseLeave={e => e.currentTarget.style.background = C.ocean}>
          Entrar no painel
        </button>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: C.inkSoft }}>
          PIN padrão: <code style={{ background: C.espuma, padding: '2px 6px', borderRadius: 5, fontWeight: 700 }}>1234</code>
          <span style={{ margin: '0 6px' }}>·</span>
          Altere em <code style={{ background: C.espuma, padding: '2px 6px', borderRadius: 5 }}>ADMIN_PIN</code> no código
        </div>
      </div>
    </div>
  );
}

