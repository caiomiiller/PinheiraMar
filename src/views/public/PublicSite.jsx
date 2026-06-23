import React, { useState, useMemo } from 'react';
import { Waves, MapPin, Phone, Mail, Search, CalendarDays, ChevronDown,
  Heart, ArrowRight } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { money, ymd, today, parseYMD, addDays, isAvailable, nightlyRate,
  stayBreakdown, nights } from '../../lib/helpers';
import { useT } from '../../lib/translations';
import { Btn, PhotoTile, Field } from '../../components/ui';
import { AptDetailPage } from './AptDetailPage';
import { AptCard } from './AptCard';
import { Section } from './Section';
import { DestinoSection } from './DestinoSection';

export function PublicSite({ data, onCreate }) {
  const td = today();

  /* ── language ── */
  const idiomasAtivos = (data.settings.idiomas || []).filter(i => i.ativo);
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

  const valid = ci && co && nights(ci, co) >= 1;
  const active = data.apartamentos.filter(a => a.ativo);
  const maxCap = active.length ? Math.max(...active.map(a => a.capacidade)) : 0;

  const withInfo = useMemo(() => {
    const arr = active.map(a => ({
      apt: a,
      available: valid ? isAvailable(data.reservas, a.id, ci, co) : true,
      fits: !hosp || a.capacidade >= hosp,
      bd: valid ? stayBreakdown(a, data.seasons, ci, co) : null,
    }));
    arr.sort((x, y) =>
      (Number(y.available) - Number(x.available)) ||
      (Number(y.fits) - Number(x.fits)) ||
      (x.apt.preco - y.apt.preco));
    return arr;
  }, [data, ci, co, hosp, valid]); // eslint-disable-line

  const catFilter = (apt) => {
    if (!activeCategory) return true;
    const am = Array.isArray(apt.amenidades) ? apt.amenidades.join(' ').toLowerCase() : '';
    if (activeCategory === 'frente_mar') return apt.vista === 'Frente Mar';
    if (activeCategory === 'wifi') return am.includes('wi-fi') || am.includes('wifi');
    if (activeCategory === 'estacion') return am.includes('estacion');
    if (activeCategory === 'familia') return apt.capacidade >= 4;
    if (activeCategory === 'praia') return true; // all beach apts
    return true;
  };
  const withInfoFiltered = withInfo.filter(w => catFilter(w.apt));
  const availableApts = withInfo.filter(w => w.available).map(w => w.apt);
  const needsCombo = valid && hosp > maxCap;
  const combo = useMemo(() => {
    if (!needsCombo) return null;
    // min-excess: find pair with smallest total capacity >= hosp
    let best = null;
    for (let i = 0; i < availableApts.length; i++) {
      for (let j = i + 1; j < availableApts.length; j++) {
        const cap = availableApts[i].capacidade + availableApts[j].capacidade;
        if (cap >= hosp && (!best || cap < best.cap))
          best = { pick: [availableApts[i], availableApts[j]], cap };
      }
    }
    if (!best) {
      for (let i = 0; i < availableApts.length; i++)
        for (let j = i+1; j < availableApts.length; j++)
          for (let k = j+1; k < availableApts.length; k++) {
            const cap = availableApts[i].capacidade + availableApts[j].capacidade + availableApts[k].capacidade;
            if (cap >= hosp && (!best || cap < best.cap))
              best = { pick: [availableApts[i], availableApts[j], availableApts[k]], cap };
          }
    }
    return best ? { ...best, enough: true } : { pick: [], cap: 0, enough: false };
  }, [needsCombo, availableApts, hosp]); // eslint-disable-line

  const openDetail = (apt) => { setDetail(apt); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openBooking = (apt) => {
    if (!valid) { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    setBooking({ apt });
  };

  /* ── tokens ── */
  const BLACK  = '#0D0D0D';
  const GREY   = '#6B6B6B';
  const LIGHT  = '#F5F4F0';
  const BORDER = '#E2E0DB';
  const ACCENT = '#C8A96E'; // warm gold accent — refined, not coral
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

  /* ── row section ── */
  const Row = ({ title, sub, items, scrollable }) => {
    const ref = useRef(null);
    const shift = (d) => ref.current?.scrollBy({ left: d * 280, behavior: 'smooth' });
    if (!items.length) return null;
    return (
      <div style={{ marginBottom: 64 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: BLACK }}>{title}</div>
            {sub && <div style={{ fontSize: 14, color: GREY, marginTop: 4 }}>{sub}</div>}
          </div>
          {scrollable && items.length > 3 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => shift(-1)} style={{ width: 36, height: 36, border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', color: GREY }}><ChevronLeft size={16} /></button>
              <button onClick={() => shift(1)}  style={{ width: 36, height: 36, border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', color: GREY }}><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
        {scrollable ? (
          <div ref={ref} style={{ display: 'flex', gap: 24, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {items.map(({ apt, available, fits, bd }) => (
              <div key={apt.id} style={{ minWidth: 260, flex: '0 0 260px' }}>
                <PCard apt={apt} available={available} fits={fits} bd={bd} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: '40px 28px' }}>
            {items.map(({ apt, available, fits, bd }) => (
              <PCard key={apt.id} apt={apt} available={available} fits={fits} bd={bd} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (detail) return (
    <>
      <AptDetailPage apt={detail} data={data} ci={ci} co={co} hosp={hosp} valid={valid}
        setCi={setCi} setCo={setCo} setHosp={setHosp}
        liked={liked} setLiked={setLiked}
        onBack={() => setDetail(null)} onBook={(apt, apt2, g1, g2) => setBooking({ apt, apt2, g1, g2 })} tr={tr} />
      {booking && <BookingModal sel={booking} ci={ci || ymd(td)} co={co || ymd(addDays(td, 2))} hosp={hosp || 2} data={data}
        onClose={() => setBooking(null)}
        onConfirm={r => { onCreate(r); setDone(d => d || { reserva: r, apt: booking.apt }); }} />}
      {done && <ConfirmationModal info={done} settings={data.settings} onClose={() => { setDone(null); setBooking(null); }} />}
    </>
  );

  return (
    <div style={{ background: WHITE, minHeight: '100vh', fontFamily: F.sans, color: BLACK }}>

      {/* ══ HEADER ══ */}
      <header ref={headerRef} style={{ borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 50, background: WHITE }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', gap: 32 }}>

          {/* wordmark */}
          <a href="#" style={{ textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.04em', color: BLACK }}>PINHEIRA</span>
            <span style={{ fontSize: 19, fontWeight: 300, letterSpacing: '.06em', color: ACCENT }}>MAR</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
            {idiomasAtivos.length > 1 && (
              <div style={{ display: 'flex', gap: 2 }}>
                {idiomasAtivos.map(id => (
                  <button key={id.codigo} onClick={() => setLang(id.codigo)} title={id.nativo}
                    style={{ width: 30, height: 30, border: lang === id.codigo ? `1px solid ${BLACK}` : `1px solid transparent`, background: 'transparent', cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center' }}>
                    {id.bandeira}
                  </button>
                ))}
              </div>
            )}
            <div className="pm-hide-sm" style={{ fontSize: 13, color: GREY }}>{data.settings.telefone}</div>
          </div>
        </div>
      </header>

      {/* ══ HERO ══ */}
      <section style={{ position: 'relative', height: 'clamp(520px,75vh,800px)', overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
        {/* full-bleed beach photo */}
        <img
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1800&q=85&auto=format&fit=crop"
          alt="Praia da Pinheira"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
        {/* The user's uploaded aerial beach image — use as data URI via the upload path */}
        <img
          src="/mnt/user-data/uploads/1781559242420_image.png"
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
        />
        {/* dark gradient overlay — heavier at bottom for text legibility */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.08) 0%, rgba(0,0,0,.18) 40%, rgba(0,0,0,.72) 100%)' }} />
        {/* hero content */}
        <div style={{ position: 'relative', maxWidth: 1280, width: '100%', margin: '0 auto', padding: '0 32px 56px', display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'flex-end', gap: 40 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)', marginBottom: 16 }}>
              Praia da Pinheira · Palhoça · Santa Catarina
            </div>
            <h1 style={{ fontSize: 'clamp(36px,4.5vw,62px)', fontWeight: 800, lineHeight: 1.02, margin: '0 0 20px', letterSpacing: '-.03em', color: '#fff' }}>
              Apartamentos<br />à beira-mar,<br />
              <span style={{ color: ACCENT, fontWeight: 300, fontStyle: 'italic' }}>do jeito certo.</span>
            </h1>
            <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,.82)', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 420 }}>
              Apartamentos residenciais completos frente ao mar.
            </p>
            <button onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              style={{ padding: '14px 32px', background: '#fff', color: BLACK, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Ver Apartamentos
            </button>
          </div>
          <div />
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
          ].map(cat => {
            const active = activeCategory === cat.key;
            return (
              <button key={String(cat.key)} onClick={() => setActiveCategory(active ? null : cat.key)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0, fontSize: 12, fontWeight: 600, color: active ? BLACK : GREY, borderBottom: active ? `2px solid ${BLACK}` : '2px solid transparent', transition: 'all .15s' }}>
                <span style={{ color: active ? BLACK : GREY }}>{cat.icon}</span>
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

      {/* ══ RESULTS / SECTIONS ══ */}
      <main ref={resultsRef} style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 32px 80px', scrollMarginTop: 80 }}>

        {valid ? (<>
          {/* search results mode */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em' }}>
              {availableApts.length > 0 ? `${availableApts.length} apartamento${availableApts.length > 1 ? 's' : ''} disponível${availableApts.length > 1 ? 'veis' : ''}` : 'Sem disponibilidade'}
            </div>
            <div style={{ fontSize: 14, color: GREY, marginTop: 4 }}>{fmtShort(ci)} — {fmtShort(co)}{hosp ? ` · ${hosp} hóspede${hosp > 1 ? 's' : ''}` : ''} · {nights(ci,co)} noite{nights(ci,co) > 1 ? 's' : ''}</div>
          </div>

          {needsCombo && combo && (
            <div style={{ border: `1px solid ${BORDER}`, padding: '20px 24px', marginBottom: 36, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
              <Users size={18} color={GREY} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 14, color: BLACK, lineHeight: 1.65 }}>
                <b>Para {hosp} hóspedes é necessário combinar apartamentos.</b> Temos unidades que acomodam 2, 4, 6 e até 8 pessoas.
                {combo.enough && <> Sugestão: <b>{combo.pick.map(a => `${a.nome} (${a.capacidade} pax)`).join(' + ')}</b> — capacidade total de {combo.cap} pessoas.</>}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: '48px 28px' }}>
            {withInfoFiltered.map(({ apt, available, fits, bd }) => (
              <PCard key={apt.id} apt={apt} available={available} fits={fits} bd={bd} />
            ))}
          </div>
        </>) : (<>

          {/* editorial home mode */}

          {/* Frente Mar — featured editorial */}
          {(() => {
            const fm = active.filter(a => a.vista === 'Frente Mar');
            if (!fm.length) return null;
            return (
              <div style={{ marginBottom: 80 }}>
                <div style={{ paddingBottom: 16, borderBottom: `1px solid ${BORDER}`, marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>Frente Mar</div>
                    <div style={{ fontSize: 14, color: GREY, marginTop: 4 }}>Vista privilegiada directamente para o mar</div>
                  </div>
                  <div style={{ fontSize: 12, color: GREY, letterSpacing: '.08em', textTransform: 'uppercase' }}>{fm.length} unidades</div>
                </div>
                {fm.length >= 2 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gridTemplateRows: 'auto auto', gap: 6 }}>
                    {/* big */}
                    <div onClick={() => openDetail(fm[0])} style={{ cursor: 'pointer', overflow: 'hidden', gridRow: '1 / 3', background: LIGHT, position: 'relative' }}>
                      <PhotoTile apt={fm[0]} h={520} radius={0} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '48px 24px 22px', background: 'linear-gradient(transparent,rgba(0,0,0,.62))', color: WHITE }}>
                        <div style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .8, marginBottom: 6 }}>Destaque</div>
                        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.01em' }}>{fm[0].nome}</div>
                        <div style={{ fontSize: 14, opacity: .82, marginTop: 4 }}>{fm[0].piso} · até {fm[0].capacidade} pessoas · {money(fm[0].preco)}/noite</div>
                      </div>
                    </div>
                    {/* smaller right */}
                    {fm.slice(1, 3).map(apt => (
                      <div key={apt.id} onClick={() => openDetail(apt)} style={{ cursor: 'pointer', overflow: 'hidden', background: LIGHT, position: 'relative', height: 256 }}>
                        <PhotoTile apt={apt} h={256} radius={0} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '28px 18px 14px', background: 'linear-gradient(transparent,rgba(0,0,0,.58))', color: WHITE }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{apt.nome}</div>
                          <div style={{ fontSize: 12.5, opacity: .82 }}>{apt.piso} · {money(apt.preco)}/noite</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '40px 28px' }}>
                    {fm.map(apt => <PCard key={apt.id} apt={apt} />)}
                  </div>
                )}
                {/* extra Frente Mar if > 3 */}
                {fm.length > 3 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '40px 28px', marginTop: 28 }}>
                    {fm.slice(3).map(apt => <PCard key={apt.id} apt={apt} />)}
                  </div>
                )}
              </div>
            );
          })()}

          {/* By capacity */}
          {[2, 4, 6, 8].map(cap => {
            const grupo = active.filter(a => a.capacidade === cap);
            if (!grupo.length) return null;
            const labels = { 2: 'Para dois — casais e escapadinhas', 4: 'Para famílias — até 4 pessoas', 6: 'Grupos — até 6 pessoas', 8: 'Grandes grupos — até 8 pessoas' };
            return (
              <Row key={cap} title={`Até ${cap} pessoas`} sub={labels[cap]}
                items={grupo.map(apt => ({ apt, available: true, fits: true, bd: null }))}
                scrollable={grupo.length > 4} />
            );
          })}

          {/* Churrasqueira */}
          {(() => {
            const ch = active.filter(a => Array.isArray(a.amenidades) && a.amenidades.some(am => /churrasco/i.test(am)));
            if (!ch.length) return null;
            return <Row title="Com churrasqueira exclusiva" sub="Área de churrasco privativa, sem partilha"
              items={ch.map(apt => ({ apt, available: true, fits: true, bd: null }))} scrollable={false} />;
          })()}

          {/* All */}
          <Row title="Todos os apartamentos"
            sub={`${active.length} unidades na Praia da Pinheira`}
            items={active.map(apt => ({ apt, available: true, fits: true, bd: null }))}
            scrollable={false} />

        </>)}
      </main>

      {/* ══ DESTINATION ══ */}
      <DestinoSection />

      {/* ══ FOOTER ══ */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, background: LIGHT }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 40 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.04em', color: BLACK }}>PINHEIRA</span>
              <span style={{ fontSize: 16, fontWeight: 300, letterSpacing: '.06em', color: ACCENT }}>MAR</span>
            </div>
            <div style={{ fontSize: 13, color: GREY, lineHeight: 1.8 }}>{data.settings.endereco}<br />{data.settings.cidade}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: GREY, marginBottom: 14 }}>Contacto</div>
            <div style={{ fontSize: 13, color: GREY, lineHeight: 1.9 }}>
              <div>{data.settings.telefone}</div>
              <div>{data.settings.email}</div>
              <div>www.pinheiramar.com.br</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: GREY, marginBottom: 14 }}>Horários</div>
            <div style={{ fontSize: 13, color: GREY, lineHeight: 1.9 }}>
              <div>Check-in — a partir das {data.settings.checkInHora || '13:00'}</div>
              <div>Check-out — até às {data.settings.checkOutHora || '10:00'}</div>
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
          © {new Date().getFullYear()} RESIDENCIAL PINHEIRAMAR — TODOS OS DIREITOS RESERVADOS
        </div>
      </footer>

      {booking && <BookingModal sel={booking} ci={ci || ymd(td)} co={co || ymd(addDays(td,2))} hosp={hosp || 2} data={data}
        onClose={() => setBooking(null)}
        onConfirm={r => { onCreate(r); setBooking(null); setDone({ reserva: r, apt: booking.apt }); }} />}
      {done && <ConfirmationModal info={done} settings={data.settings} onClose={() => setDone(null)} />}
    </div>
  );
}

