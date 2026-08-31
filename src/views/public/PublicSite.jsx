import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Waves, MapPin, Phone, Mail, Search, CalendarDays, ChevronDown,
  Heart, ArrowRight, ChevronLeft, ChevronRight, Home, Wifi, Car, Users,
  BedDouble } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { money, ymd, today, parseYMD, addDays, isAvailable, nightlyRate,
  stayBreakdown, nights, fmtShort } from '../../lib/helpers';
import { useT } from '../../lib/translations';
import { Btn, PhotoTile, Field } from '../../components/ui';
import { buildScoped } from '../../lib/multiProperty';
import { AptDetailPage } from './AptDetailPage';
import { Section } from './Section';
import { DestinoSection } from './DestinoSection';
import { BookingModal } from '../../components/BookingModal';
import { ConfirmationModal } from '../../components/ConfirmationModal';

// Dentro de UM residencial, encontra a combinação de apartamentos disponíveis
// que acomoda `hosp` pessoas com o menor excesso de capacidade. Não faz
// sentido combinar apartamentos de dois imóveis diferentes (são edifícios
// distintos), por isso isto corre sempre dentro de um único grupo.
function findCombo(availableApts, hosp) {
  let best = null;
  for (let i = 0; i < availableApts.length; i++) {
    for (let j = i + 1; j < availableApts.length; j++) {
      const cap = availableApts[i].capacidade + availableApts[j].capacidade;
      if (cap >= hosp && (!best || cap < best.cap)) best = { pick: [availableApts[i], availableApts[j]], cap };
    }
  }
  if (!best) {
    for (let i = 0; i < availableApts.length; i++)
      for (let j = i + 1; j < availableApts.length; j++)
        for (let k = j + 1; k < availableApts.length; k++) {
          const cap = availableApts[i].capacidade + availableApts[j].capacidade + availableApts[k].capacidade;
          if (cap >= hosp && (!best || cap < best.cap)) best = { pick: [availableApts[i], availableApts[j], availableApts[k]], cap };
        }
  }
  return best ? { ...best, enough: true } : { pick: [], cap: 0, enough: false };
}

export function PublicSite({ data, onCreate }) {
  const td = today();

  /* ── language (partilhado entre imóveis) ── */
  const idiomasAtivos = (data.residenciais[0]?.idiomas || []).filter(i => i.ativo);
  const [lang, setLang] = useState(() => {
    const browser = navigator.language?.slice(0, 2);
    const match = idiomasAtivos.find(i => i.codigo === browser);
    return match ? match.codigo : 'pt';
  });
  const tr = useT(lang);

  /* ── state ── */
  const [ci, setCi] = useState('');
  const [co, setCo] = useState('');
  const [hosp, setHosp] = useState(0);
  const [booking, setBooking] = useState(null);
  const [done, setDone] = useState(null);
  const [liked, setLiked] = useState({});
  const [detail, setDetail] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [guestOpen, setGuestOpen] = useState(false);
  const resultsRef = useRef(null);
  const headerRef = useRef(null);
  const groupRefs = useRef({});

  const valid = ci && co && nights(ci, co) >= 1;

  // ── agrupa apartamentos, disponibilidade e sugestão de combinação por imóvel ──
  const groups = useMemo(() => data.residenciais.map(r => {
    const active = data.apartamentos.filter(a => a.ativo && a.residencialId === r.id);
    const maxCap = active.length ? Math.max(...active.map(a => a.capacidade)) : 0;
    const withInfo = active.map(a => ({
      apt: a,
      available: valid ? isAvailable(data.reservas, a.id, ci, co) : true,
      fits: !hosp || a.capacidade >= hosp,
      bd: valid ? stayBreakdown(a, data.seasons, ci, co) : null,
    })).sort((x, y) =>
      (Number(y.available) - Number(x.available)) ||
      (Number(y.fits) - Number(x.fits)) ||
      (x.apt.preco - y.apt.preco));
    const availableApts = withInfo.filter(w => w.available).map(w => w.apt);
    const needsCombo = valid && hosp > 0 && hosp > maxCap;
    const combo = needsCombo ? findCombo(availableApts, hosp) : null;
    return { residencial: r, active, withInfo, maxCap, availableApts, needsCombo, combo };
  }), [data, ci, co, hosp, valid]);

  const hasFrenteMar = data.apartamentos.some(a => a.ativo && a.vista === 'Frente Mar');

  const catFilter = (apt) => {
    if (!activeCategory) return true;
    const am = Array.isArray(apt.amenidades) ? apt.amenidades.join(' ').toLowerCase() : '';
    if (activeCategory === 'frente_mar') return apt.vista === 'Frente Mar';
    if (activeCategory === 'wifi') return am.includes('wi-fi') || am.includes('wifi');
    if (activeCategory === 'estacion') return am.includes('estacion');
    if (activeCategory === 'familia') return apt.capacidade >= 4;
    if (activeCategory === 'praia') return true;
    return true;
  };

  // ?imovel=<id> na URL: assim que os grupos existem, desliza até essa secção
  useEffect(() => {
    let id;
    try { id = new URLSearchParams(window.location.search).get('imovel'); } catch { id = null; }
    if (id && groupRefs.current[id]) {
      setTimeout(() => groupRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, []); // eslint-disable-line

  const openDetail = (apt) => { setDetail(apt); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  /* ── tokens ── */
  const BLACK  = '#0D0D0D';
  const GREY   = '#6B6B6B';
  const LIGHT  = '#F5F4F0';
  const BORDER = '#E2E0DB';
  const ACCENT = '#C8A96E'; // dourado — marca partilhada dos dois residenciais
  const WHITE  = '#FFFFFF';

  /* ── search pill segments ── */
  const Seg = ({ label, children, last }) => (
    <div style={{ flex: 1, padding: '0 20px', borderRight: last ? 'none' : `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: GREY }}>{label}</div>
      {children}
    </div>
  );
  const segInput = { border: 'none', outline: 'none', background: 'transparent', fontFamily: F.sans, fontSize: 14.5, color: BLACK, width: '100%' };

  /* ── reusable card ── */
  const PCard = ({ apt, available = true, fits = true, bd = null }) => {
    const rate = valid && bd ? Math.round(bd.total / bd.n) : apt.preco;
    return (
      <div onClick={() => available && openDetail(apt)}
        style={{ cursor: available ? 'pointer' : 'default', display: 'flex', flexDirection: 'column' }}
        className="pm-unit-card">
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 4, aspectRatio: '4/3', background: LIGHT }}>
          <PhotoTile apt={apt} h={240} radius={0} />
          <button onClick={e => { e.stopPropagation(); setLiked(l => ({ ...l, [apt.id]: !l[apt.id] })); }}
            style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,.82)', border: 'none', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)' }}>
            <Heart size={15} fill={liked[apt.id] ? '#c0392b' : 'none'} color={liked[apt.id] ? '#c0392b' : GREY} strokeWidth={1.8} />
          </button>
          {!available && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.55)', display: 'grid', placeItems: 'center' }}>
              <span style={{ background: WHITE, padding: '6px 14px', fontSize: 12, fontWeight: 600, letterSpacing: '.06em', color: GREY, border: `1px solid ${BORDER}` }}>INDISPONÍVEL</span>
            </div>
          )}
          {apt.vista === 'Frente Mar' && (
            <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(10,30,40,.72)', color: WHITE, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', padding: '4px 10px' }}>
              FRENTE MAR
            </div>
          )}
        </div>
        <div style={{ paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: BLACK }}>{apt.nome}</div>
            <div style={{ fontSize: 13, color: GREY }}>até {apt.capacidade} hóspedes</div>
          </div>
          <div style={{ fontSize: 13, color: GREY, marginTop: 3 }}>{apt.piso} · {apt.vista}</div>
          {valid && !fits && <div style={{ fontSize: 12, color: ACCENT, fontWeight: 600, marginTop: 5, letterSpacing: '.02em' }}>Combinar com outro apartamento</div>}
          {valid && bd && <div style={{ fontSize: 12.5, color: GREY, marginTop: 4 }}>Total {money(bd.total)} · {bd.n} noites</div>}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: BLACK }}>{money(rate)}</span>
            <span style={{ fontSize: 12.5, color: GREY }}>/noite</span>
          </div>
        </div>
      </div>
    );
  };

  /* ── scrollable row ── */
  const Row = ({ items, scrollable }) => {
    const ref = useRef(null);
    const shift = (d) => ref.current?.scrollBy({ left: d * 280, behavior: 'smooth' });
    if (!items.length) return null;
    return scrollable ? (
      <div style={{ position: 'relative' }}>
        <div ref={ref} style={{ display: 'flex', gap: 24, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
          {items.map(({ apt, available, fits, bd }) => (
            <div key={apt.id} style={{ minWidth: 260, flex: '0 0 260px' }}>
              <PCard apt={apt} available={available} fits={fits} bd={bd} />
            </div>
          ))}
        </div>
        {items.length > 4 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => shift(-1)} style={{ width: 36, height: 36, border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', color: GREY }}><ChevronLeft size={16} /></button>
            <button onClick={() => shift(1)}  style={{ width: 36, height: 36, border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', color: GREY }}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: '40px 28px' }}>
        {items.map(({ apt, available, fits, bd }) => (
          <PCard key={apt.id} apt={apt} available={available} fits={fits} bd={bd} />
        ))}
      </div>
    );
  };

  /* ── bloco de um imóvel (à la Booking: banner do imóvel + as suas unidades) ── */
  const PropertyGroup = ({ g }) => {
    const { residencial: r, withInfo, availableApts, needsCombo, combo } = g;
    const filtered = withInfo.filter(w => catFilter(w.apt));
    const list = valid ? filtered : filtered.map(w => ({ ...w, available: true }));
    if (!list.length) return null;
    const countLabel = valid
      ? `${availableApts.length} de ${withInfo.length} apartamento${withInfo.length > 1 ? 's' : ''} disponível${availableApts.length !== 1 ? 'eis' : ''}`
      : `${withInfo.length} apartamento${withInfo.length > 1 ? 's' : ''} ${r.regiaoLabel}`;

    return (
      <div ref={el => { groupRefs.current[r.id] = el; }} style={{ marginBottom: 72, scrollMarginTop: 140 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 20, borderBottom: `1px solid ${BORDER}`, marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={{ width: 96, height: 72, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: LIGHT }}>
            <img src={r.heroImage} alt={r.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: BLACK }}>{r.nome}</div>
            <div style={{ fontSize: 13.5, color: GREY, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={13} /> {r.regiaoLabel}</div>
          </div>
          <div style={{ fontSize: 12.5, color: GREY, letterSpacing: '.04em', textTransform: 'uppercase', flexShrink: 0 }}>{countLabel}</div>
        </div>

        {valid && needsCombo && combo && (
          <div style={{ border: `1px solid ${BORDER}`, padding: '20px 24px', marginBottom: 28, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <Users size={18} color={GREY} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 14, color: BLACK, lineHeight: 1.65 }}>
              <b>Para {hosp} hóspedes em {r.nome} é necessário combinar apartamentos.</b>
              {combo.enough
                ? <> Sugestão: <b>{combo.pick.map(a => `${a.nome} (${a.capacidade} pax)`).join(' + ')}</b> — capacidade total de {combo.cap} pessoas.</>
                : <> Não há unidades disponíveis suficientes neste imóvel para estas datas.</>}
              {combo.enough && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {combo.pick.map(a => (
                    <button key={a.id} onClick={() => openDetail(a)}
                      style={{ background: BLACK, color: WHITE, border: 'none', padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', letterSpacing: '.04em' }}>
                      VER {a.nome.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <Row items={list} scrollable={!valid && list.length > 4} />
      </div>
    );
  };

  if (detail) {
    const scoped = buildScoped(data, detail.residencialId);
    const bookingScoped = booking ? buildScoped(data, booking.apt.residencialId) : null;
    const doneScoped = done ? buildScoped(data, done.apt.residencialId) : null;
    return (
      <>
        <AptDetailPage apt={detail} data={scoped} ci={ci} co={co} hosp={hosp} valid={valid}
          setCi={setCi} setCo={setCo} setHosp={setHosp}
          liked={liked} setLiked={setLiked}
          onBack={() => setDetail(null)} onBook={(apt, apt2, g1, g2) => setBooking({ apt, apt2, g1, g2 })} tr={tr} />
        {booking && <BookingModal sel={booking} ci={ci || ymd(td)} co={co || ymd(addDays(td, 2))} hosp={hosp || 2} data={bookingScoped}
          onClose={() => setBooking(null)}
          onConfirm={r => { onCreate(r); setDone(d => d || { reserva: r, apt: booking.apt }); }} />}
        {done && <ConfirmationModal info={done} settings={doneScoped.settings} onClose={() => { setDone(null); setBooking(null); }} />}
      </>
    );
  }

  const r0 = data.residenciais[0] || {};

  return (
    <div style={{ background: WHITE, minHeight: '100vh', fontFamily: F.sans, color: BLACK }}>

      {/* ══ HEADER ══ */}
      <header ref={headerRef} style={{ borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 50, background: WHITE }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', gap: 32 }}>

          {/* wordmark — marca de destino partilhada pelos dois residenciais.
              Ajusta aqui quando decidires o nome definitivo da plataforma. */}
          <a href="#" style={{ textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.04em', color: BLACK }}>PINHEIRA</span>
            <span style={{ fontSize: 19, fontWeight: 300, letterSpacing: '.06em', color: ACCENT }}>HOSPEDAGENS</span>
          </a>

          {/* centred search */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'stretch', height: 44, border: `1px solid ${BORDER}`, background: WHITE, maxWidth: 680, width: '100%' }}>
              <Seg label={tr('search_checkin')}>
                <input type="date" value={ci} min={ymd(td)} style={segInput}
                  onChange={e => { setCi(e.target.value); if (co && nights(e.target.value, co) < 1) setCo(''); }} />
              </Seg>
              <Seg label={tr('search_checkout')}>
                <input type="date" value={co} min={ci ? ymd(addDays(parseYMD(ci), 1)) : ymd(addDays(td,1))} style={segInput}
                  onChange={e => setCo(e.target.value)} />
              </Seg>
              <Seg label={tr('search_who')} last>
                <div style={{ ...segInput, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={() => setGuestOpen(o => !o)}>
                  <span style={{ color: hosp ? BLACK : '#AAA' }}>{hosp ? `${hosp} hóspede${hosp > 1 ? 's' : ''}` : tr('search_add_guests')}</span>
                </div>
                {guestOpen && (
                  <div style={{ position: 'absolute', top: 70, background: WHITE, border: `1px solid ${BORDER}`, padding: 20, zIndex: 100, minWidth: 220, boxShadow: '0 8px 32px rgba(0,0,0,.10)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Hóspedes</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <button onClick={() => setHosp(h => Math.max(0,h-1))} style={{ width: 28, height: 28, border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 16 }}>−</button>
                        <span style={{ fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{hosp || '—'}</span>
                        <button onClick={() => setHosp(h => h+1)} style={{ width: 28, height: 28, border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 16 }}>+</button>
                      </div>
                    </div>
                    <button onClick={() => setGuestOpen(false)} style={{ width: '100%', padding: '10px 0', background: BLACK, color: WHITE, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, letterSpacing: '.05em' }}>Confirmar</button>
                  </div>
                )}
              </Seg>
              <button onClick={() => { setGuestOpen(false); resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                style={{ padding: '0 24px', background: BLACK, color: WHITE, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {tr('search_btn').toUpperCase()}
              </button>
            </div>
          </div>

          {/* right side */}
          {idiomasAtivos.length > 1 && (
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              {idiomasAtivos.map(id => (
                <button key={id.codigo} onClick={() => setLang(id.codigo)} title={id.nativo}
                  style={{ width: 30, height: 30, border: lang === id.codigo ? `1px solid ${BLACK}` : `1px solid transparent`, background: 'transparent', cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center' }}>
                  {id.bandeira}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ══ HERO ══ */}
      <section style={{ position: 'relative', height: 'clamp(480px,68vh,720px)', overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
        <img
          src={r0.heroImage}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.10) 0%, rgba(0,0,0,.20) 40%, rgba(0,0,0,.72) 100%)' }} />
        <div style={{ position: 'relative', maxWidth: 1280, width: '100%', margin: '0 auto', padding: '0 32px 56px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)', marginBottom: 16 }}>
            Praia da Pinheira · Palhoça · Santa Catarina
          </div>
          <h1 style={{ fontSize: 'clamp(32px,4.2vw,56px)', fontWeight: 800, lineHeight: 1.05, margin: '0 0 18px', letterSpacing: '-.03em', color: '#fff', maxWidth: 700 }}>
            Apartamentos à beira-mar<br />
            <span style={{ color: ACCENT, fontWeight: 300, fontStyle: 'italic' }}>ou a poucos passos dele.</span>
          </h1>
          <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,.85)', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 480 }}>
            {data.residenciais.length} residenciais, um só motor de reservas — escolha as datas e o número de hóspedes e veja tudo o que está disponível.
          </p>
          <button onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            style={{ padding: '14px 32px', background: '#fff', color: BLACK, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Ver Apartamentos
          </button>
        </div>
      </section>

      {/* ══ CATEGORY FILTER STRIP ══ */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, background: WHITE, position: 'sticky', top: 64, zIndex: 40 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[
            { key: null,         icon: <Home size={16} />,       label: tr('cat2') },
            { key: 'frente_mar', icon: <Waves size={16} />,      label: tr('cat1') },
            { key: 'wifi',       icon: <Wifi size={16} />,       label: tr('cat4') },
            { key: 'estacion',   icon: <Car size={16} />,        label: tr('cat3') },
            { key: 'familia',    icon: <Users size={16} />,      label: tr('cat5') },
            { key: 'praia',      icon: <BedDouble size={16} />,  label: tr('cat7') },
          ].filter(cat => cat.key !== 'frente_mar' || hasFrenteMar).map(cat => {
            const on = activeCategory === cat.key;
            return (
              <button key={String(cat.key)} onClick={() => setActiveCategory(on ? null : cat.key)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0, fontSize: 12, fontWeight: 600, color: on ? BLACK : GREY, borderBottom: on ? `2px solid ${BLACK}` : '2px solid transparent', transition: 'all .15s' }}>
                <span style={{ color: on ? BLACK : GREY }}>{cat.icon}</span>
                {cat.label}
              </button>
            );
          })}
          {activeCategory && (
            <button onClick={() => setActiveCategory(null)} style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12, padding: '5px 12px', border: `1px solid ${BORDER}`, borderRadius: 20, background: WHITE, cursor: 'pointer', color: GREY, flexShrink: 0 }}>
              ✕ Limpar filtro
            </button>
          )}
        </div>
      </div>

      {/* ══ RESULTADOS — um bloco por imóvel, como um motor de reservas de hotel ══ */}
      <main ref={resultsRef} style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 32px 80px', scrollMarginTop: 80 }}>
        {valid && (
          <div style={{ marginBottom: 44 }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>
              {fmtShort(ci)} — {fmtShort(co)} · {nights(ci, co)} noite{nights(ci,co) > 1 ? 's' : ''}{hosp ? ` · ${hosp} hóspede${hosp > 1 ? 's' : ''}` : ''}
            </div>
            <div style={{ fontSize: 14, color: GREY, marginTop: 4 }}>Disponibilidade nos dois residenciais para estas datas.</div>
          </div>
        )}
        {groups.map(g => <PropertyGroup key={g.residencial.id} g={g} />)}
      </main>

      {/* ══ DESTINATION (partilhado — mesma zona/praia para os dois imóveis) ══ */}
      <DestinoSection />

      {/* ══ FOOTER ══ */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, background: LIGHT }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 40 }}>
          {data.residenciais.map(r => (
            <div key={r.id}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', color: BLACK, marginBottom: 10 }}>{r.nome}</div>
              <div style={{ fontSize: 13, color: GREY, lineHeight: 1.9 }}>
                <div>{r.endereco}</div>
                <div>{r.cidade}</div>
                <div style={{ marginTop: 6 }}>{r.telefone}</div>
                <div>{r.email}</div>
              </div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: GREY, marginBottom: 14 }}>Horários</div>
            <div style={{ fontSize: 13, color: GREY, lineHeight: 1.9 }}>
              <div>Check-in — a partir das {r0.checkInHora || '13:00'}</div>
              <div>Check-out — até às {r0.checkOutHora || '10:00'}</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: GREY, marginBottom: 14 }}>Como chegar</div>
            <div style={{ fontSize: 13, color: GREY, lineHeight: 1.9 }}>
              <div>35 km de Florianópolis</div>
              <div>48 km do Aeroporto</div>
              <div>BR-101 → Palhoça → Pinheira</div>
            </div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 32px', textAlign: 'center', fontSize: 12, color: GREY, letterSpacing: '.04em' }}>
          © {new Date().getFullYear()} PINHEIRA HOSPEDAGENS — TODOS OS DIREITOS RESERVADOS
        </div>
      </footer>
    </div>
  );
}
