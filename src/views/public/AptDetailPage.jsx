import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Heart, BedDouble, Wifi, Car, Users,
  AlertCircle, CalendarDays, Check, Info, Waves, Star, MapPin, Home, Phone,
  Mail, X } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { money, nights, ymd, today, parseYMD, addDays, fmtShort, fmtLong, WD,
  isAvailable, stayBreakdown, nightlyRate, seasonForDate } from '../../lib/helpers';
import { Btn, Badge, PhotoTile, Field } from '../../components/ui';

export const HIGHLIGHTS = [
  { match: /wi.fi|internet/i,       icon: '📶', label: 'Wi-Fi grátis' },
  { match: /estacionamento|garagem/i, icon: '🚗', label: 'Estacionamento' },
  { match: /vista.*mar|mar.*vista|frente.*mar/i, icon: '🌊', label: 'Vista para o mar' },
  { match: /churrasco/i,            icon: '🔥', label: 'Churrasqueira' },
  { match: /ar.condicionado/i,      icon: '❄️',  label: 'Ar condicionado' },
  { match: /cozinha/i,              icon: '🍳', label: 'Cozinha completa' },
  { match: /piscina/i,              icon: '🏊',  label: 'Piscina' },
  { match: /varanda/i,              icon: '🌅', label: 'Varanda' },
];

export function AptDetailPage({ apt, data, ci, co, hosp, valid, setCi, setCo, setHosp, liked, setLiked, onBack, onBook, tr }) {
  const td = today();
  const [localCi, setLocalCi] = useState(ci || '');
  const [localCo, setLocalCo] = useState(co || '');
  const [localHosp, setLocalHosp] = useState(Math.min(hosp || 1, apt.capacidade));
  const [guestOpen, setGuestOpen] = useState(false);
  // reserva conjunta
  const [useApt2, setUseApt2] = useState(false);
  const [apt2Id, setApt2Id] = useState('');
  const [g1, setG1] = useState(Math.min(hosp || 1, apt.capacidade));
  const [g2, setG2] = useState(1);

  const amenidades = Array.isArray(apt.amenidades) ? apt.amenidades : [];
  const camas = Array.isArray(apt.camas) ? apt.camas : [{ tipo: 'Casal', qtd: 1 }];
  const fotos = Array.isArray(apt.fotos) && apt.fotos.length > 0 ? apt.fotos : [];
  const isAvail = isAvailable(data.reservas, apt.id, localCi || ymd(td), localCo || ymd(addDays(td, 2)));

  const localNights = localCi && localCo && nights(localCi, localCo) >= 1 ? nights(localCi, localCo) : 0;
  const bd = localNights > 0 ? stayBreakdown(apt, data.seasons, localCi, localCo) : null;
  const extrasObrig = (data.taxasAdicionais || []).filter(tx => tx.tipo === 'obrigatoria');
  const extrasTotal = extrasObrig.reduce((s, e) => s + e.preco, 0);

  // second apt computations
  const apt2 = useApt2 && apt2Id ? (data.apts || []).find(a => a.id === apt2Id) : null;
  const isAvail2 = apt2 && localCi && localCo ? isAvailable(data.reservas, apt2.id, localCi, localCo) : false;
  const bd2 = apt2 && localNights > 0 ? stayBreakdown(apt2, data.seasons, localCi, localCo) : null;
  const total2 = apt2 && bd2 ? bd2.total + extrasTotal : 0;
  const totalComExtras = bd ? bd.total + extrasTotal + (useApt2 && apt2 ? total2 : 0) : 0;
  const sinal = Math.round(totalComExtras * (data.settings.sinalPct / 100));

  // min nights for active season
  const activeSeason = localCi ? (data.seasons || []).find(s => localCi >= s.inicio && localCi <= s.fim) : null;
  const minN = activeSeason?.minNoites || 1;
  const meetsMin = localNights >= minN;

  const otherApts = (data.apts || []).filter(a => a.id !== apt.id && a.ativo !== false);

  const highlights = HIGHLIGHTS.filter(h =>
    amenidades.some(a => h.match.test(a)) ||
    (apt.vista === 'Frente Mar' && h.match.test('frente mar'))
  );

  const handleBook = () => {
    if (!localCi || !localCo || localNights < 1 || !meetsMin) return;
    setCi(localCi); setCo(localCo); setHosp(useApt2 ? g1 + g2 : localHosp);
    onBook(apt, apt2 || null, useApt2 ? g1 : localHosp, useApt2 ? g2 : null);
  };

  const PolicyItem = ({ icon, title, text }) => (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: `1px solid #f0f0f0` }}>
      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div><div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{title}</div><div style={{ fontSize: 13.5, color: '#555', lineHeight: 1.55 }}>{text}</div></div>
    </div>
  );

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: F.sans, color: '#222' }}>

      {/* sticky back bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 60, background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, height: 52 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#222', padding: '6px 0' }}>
          <ChevronLeft size={20} /> Voltar
        </button>
        <div style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{apt.nome}</div>
        <button onClick={e => { e.stopPropagation(); setLiked(l => ({ ...l, [apt.id]: !l[apt.id] })); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: liked[apt.id] ? C.coralDeep : '#555' }}>
          <Heart size={18} fill={liked[apt.id] ? C.coral : 'none'} color={liked[apt.id] ? C.coral : '#555'} /> Guardar
        </button>
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* title + badges */}
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-.01em' }}>{apt.tipo || apt.nome}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13.5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Star size={14} fill="#222" color="#222" /><b>4,9</b></span>
            <span style={{ color: '#717171' }}>·</span>
            <span style={{ color: '#717171' }}>{apt.piso}</span>
            <span style={{ color: '#717171' }}>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={13} color="#717171" /> Praia da Pinheira, Palhoça — SC</span>
            {apt.vista === 'Frente Mar' && <span style={{ background: '#E1F0EC', color: '#1C7A5B', borderRadius: 999, padding: '3px 10px', fontWeight: 700, fontSize: 12 }}>🌊 Frente Mar</span>}
          </div>
        </div>

        {/* photo gallery */}
        <div style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 28 }}>
          {fotos.length >= 3 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '240px 180px', gap: 4 }}>
              <div style={{ gridRow: '1 / 3', position: 'relative' }}>
                <img src={fotos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
              </div>
              {fotos.slice(1, 5).map((f, i) => (
                <div key={i} style={{ position: 'relative', overflow: 'hidden' }}>
                  <img src={f} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                </div>
              ))}
              {fotos.length === 0 && <PhotoTile apt={apt} h={420} radius={0} />}
            </div>
          ) : (
            <div style={{ height: 380 }}><PhotoTile apt={apt} h={380} radius={0} /></div>
          )}
        </div>

        {/* main two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 48, alignItems: 'start' }}>

          {/* LEFT column */}
          <div>

            {/* highlights */}
            {highlights.length > 0 && (
              <section style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px' }}>Pontos fortes do apartamento</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {highlights.map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#f8f8f8', borderRadius: 12 }}>
                      <span style={{ fontSize: 22 }}>{h.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{h.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* description */}
            {apt.descricao && (
              <section style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid #eee' }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px' }}>Sobre o apartamento</h2>
                <div style={{ fontSize: 15, lineHeight: 1.7, color: '#333', whiteSpace: 'pre-wrap' }}>{apt.descricao}</div>
              </section>
            )}

            {/* sleeping arrangements */}
            <section style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid #eee' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px' }}>Arranjos para dormir</h2>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {camas.map((c, i) => (
                  <div key={i} style={{ padding: '16px 20px', background: '#f8f8f8', borderRadius: 14, minWidth: 140 }}>
                    <div style={{ fontSize: 26, marginBottom: 8 }}>🛏️</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{c.qtd}× {c.tipo}</div>
                    <div style={{ fontSize: 12.5, color: '#717171', marginTop: 2 }}>cama {c.tipo.toLowerCase()}</div>
                  </div>
                ))}
                {camas.length === 0 && (
                  <div style={{ padding: '16px 20px', background: '#f8f8f8', borderRadius: 14 }}>
                    <div style={{ fontSize: 26, marginBottom: 8 }}>🛏️</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>1× Casal</div>
                  </div>
                )}
              </div>
            </section>

            {/* amenities */}
            {amenidades.length > 0 && (
              <section style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid #eee' }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px' }}>Comodidades</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px 24px' }}>
                  {amenidades.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#333' }}>
                      <Check size={16} color="#1C7A5B" style={{ flexShrink: 0 }} /> {a}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* capacity */}
            <section style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid #eee' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 14px' }}>Capacidade</h2>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: '#f8f8f8', borderRadius: 12 }}>
                  <Users size={22} color={C.ocean} /><div><div style={{ fontWeight: 700 }}>{apt.capacidade} hóspedes</div><div style={{ fontSize: 12.5, color: '#717171' }}>capacidade máxima</div></div>
                </div>
                {apt.tamanho && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: '#f8f8f8', borderRadius: 12 }}>
                    <Home size={22} color={C.ocean} /><div><div style={{ fontWeight: 700 }}>{apt.tamanho} m²</div><div style={{ fontSize: 12.5, color: '#717171' }}>área do apartamento</div></div>
                  </div>
                )}
              </div>
            </section>

            {/* house rules */}
            <section style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid #eee' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Regras do apartamento</h2>
              <PolicyItem icon="🕐" title="Check-in" text={`A partir das ${data.settings.checkInHora || '13:00'}`} />
              <PolicyItem icon="🚪" title="Check-out" text={`Até às ${data.settings.checkOutHora || '10:00'}`} />
              <PolicyItem icon="🔇" title="Lei do silêncio" text="Das 22h às 7h, excepto Réveillon e Carnaval." />
              <PolicyItem icon="🐾" title="Animais de estimação" text="Permitidos mediante taxa única de R$ 150,00 por pet (até 10 kg, máx. 2)." />
              <PolicyItem icon="🚗" title="Estacionamento" text="1 vaga gratuita incluída. Vaga adicional: R$ 50,00 (sujeito a disponibilidade)." />
              <PolicyItem icon="🚭" title="Fumar" text="Proibido em todas as áreas internas e comuns." />
            </section>

            {/* location map */}
            {apt.mostrarMapa !== false && (
              <section style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 14px' }}>Localização</h2>
                <div style={{ borderRadius: 14, overflow: 'hidden', height: 260 }}>
                  <iframe title="mapa"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent((apt.endereco || data.settings.endereco || '') + ', ' + (apt.cidade || data.settings.cidade || 'Praia da Pinheira, SC'))}&output=embed&zoom=15`}
                    width="100%" height="260" style={{ border: 0, display: 'block' }}
                    loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
                <p style={{ fontSize: 13.5, color: '#717171', marginTop: 10 }}>
                  📍 {apt.endereco || data.settings.endereco} · {apt.cidade || data.settings.cidade}
                </p>
              </section>
            )}

          </div>

          {/* RIGHT column — booking widget (sticky) */}
          <div style={{ position: 'sticky', top: 60 }}>
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, padding: 24, boxShadow: '0 8px 28px rgba(0,0,0,.12)' }}>
              <div style={{ marginBottom: 18 }}>
                <span style={{ fontSize: 22, fontWeight: 800 }}>{money(apt.preco)}</span>
                <span style={{ fontSize: 14, color: '#717171' }}> / noite</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: 13 }}>
                  <Star size={13} fill="#222" color="#222" /><b>4,9</b>
                </div>
              </div>

              {/* date inputs */}
              <div style={{ border: '1px solid #b0b0b0', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ padding: '10px 14px', borderRight: '1px solid #b0b0b0' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>Check-in</div>
                    <input type="date" value={localCi} min={ymd(td)} onChange={e => { setLocalCi(e.target.value); if (localCo && nights(e.target.value, localCo) < 1) setLocalCo(''); }}
                      style={{ border: 'none', outline: 'none', fontSize: 14, width: '100%', fontFamily: F.sans }} />
                  </div>
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>Check-out</div>
                    <input type="date" value={localCo} min={localCi ? ymd(addDays(parseYMD(localCi), 1)) : ymd(addDays(td, 1))} onChange={e => setLocalCo(e.target.value)}
                      style={{ border: 'none', outline: 'none', fontSize: 14, width: '100%', fontFamily: F.sans }} />
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderTop: '1px solid #b0b0b0' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Hóspedes <span style={{ fontWeight: 400, color: '#717171', fontSize: 11 }}>(máx. {apt.capacidade})</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => { const v = Math.max(1, localHosp-1); setLocalHosp(v); setG1(v); }} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #bbb', background: '#fff', cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center' }}>−</button>
                    <b style={{ minWidth: 20, textAlign: 'center' }}>{localHosp}</b>
                    <button onClick={() => { const v = Math.min(apt.capacidade, localHosp+1); setLocalHosp(v); setG1(v); }} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #bbb', background: '#fff', cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center' }}>+</button>
                  </div>
                </div>
              </div>

              {/* second apartment toggle */}
              <div style={{ marginBottom: 10, padding: '10px 14px', background: '#f9f9f9', borderRadius: 10, border: '1px solid #ebebeb' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
                  <input type="checkbox" checked={useApt2} onChange={e => { setUseApt2(e.target.checked); if (!e.target.checked) setApt2Id(''); }}
                    style={{ width: 16, height: 16, accentColor: C.coral, cursor: 'pointer' }} />
                  Adicionar segundo apartamento
                </label>
                <div style={{ fontSize: 11.5, color: '#717171', marginTop: 3 }}>Reserva conjunta · mesmo hóspede · um pagamento</div>
                {useApt2 && (
                  <div style={{ marginTop: 10 }}>
                    <select value={apt2Id} onChange={e => setApt2Id(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontSize: 13.5, fontFamily: F.sans, background: '#fff' }}>
                      <option value="">— Escolha o 2º apartamento —</option>
                      {otherApts.map(a => {
                        const av2 = localCi && localCo ? isAvailable(data.reservas, a.id, localCi, localCo) : true;
                        return <option key={a.id} value={a.id} disabled={!av2}>{a.nome} (máx. {a.capacidade}){!av2 ? ' — Indisponível' : ''}</option>;
                      })}
                    </select>
                    {apt2 && (
                      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 4 }}>Hósp. {apt.nome}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button onClick={() => setG1(v => Math.max(1, v-1))} style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #bbb', background: '#fff', cursor: 'pointer', fontSize: 14, display: 'grid', placeItems: 'center' }}>−</button>
                            <b style={{ minWidth: 16, textAlign: 'center' }}>{g1}</b>
                            <button onClick={() => setG1(v => Math.min(apt.capacidade, v+1))} style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #bbb', background: '#fff', cursor: 'pointer', fontSize: 14, display: 'grid', placeItems: 'center' }}>+</button>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 4 }}>Hósp. {apt2.nome}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button onClick={() => setG2(v => Math.max(1, v-1))} style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #bbb', background: '#fff', cursor: 'pointer', fontSize: 14, display: 'grid', placeItems: 'center' }}>−</button>
                            <b style={{ minWidth: 16, textAlign: 'center' }}>{g2}</b>
                            <button onClick={() => setG2(v => Math.min(apt2.capacidade, v+1))} style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #bbb', background: '#fff', cursor: 'pointer', fontSize: 14, display: 'grid', placeItems: 'center' }}>+</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* min nights warning */}
              {localNights > 0 && activeSeason && !meetsMin && (
                <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FEF3C7', fontSize: 12.5, color: '#92400E', fontWeight: 600 }}>
                  ⚠️ Mínimo de {minN} noites para {activeSeason.nome}
                </div>
              )}

              {/* availability & price breakdown */}
              {localNights > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: isAvail ? '#D1FAE5' : '#FEE2E2', fontSize: 13, fontWeight: 600, color: isAvail ? '#065F46' : '#991B1B' }}>
                    {isAvail ? <><Check size={15} /> Disponível</> : <><X size={15} /> Indisponível nestas datas</>}
                    {apt2 && isAvail && <span style={{ fontWeight: 400, fontSize: 12 }}> · {isAvail2 ? apt2.nome + ' ✓' : apt2.nome + ' indisponível'}</span>}
                  </div>
                  {isAvail && bd && (
                    <div style={{ fontSize: 13.5, color: '#333' }}>
                      {useApt2 && apt2 && <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#555', marginBottom: 4 }}>{apt.nome}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span>{money(Math.round(bd.total / localNights))} × {localNights} noite{localNights > 1 ? 's' : ''}</span>
                        <span>{money(bd.total)}</span>
                      </div>
                      {extrasObrig.map(e => (
                        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#555', fontSize: 13 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 9, fontWeight: 800, background: '#1C7A5B', color: '#fff', borderRadius: 3, padding: '1px 4px' }}>OBR</span>{e.nome}
                          </span>
                          <span>{money(e.preco)}</span>
                        </div>
                      ))}
                      {useApt2 && apt2 && bd2 && <>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#555', margin: '8px 0 4px' }}>{apt2.nome}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span>{money(Math.round(bd2.total / localNights))} × {localNights} noite{localNights > 1 ? 's' : ''}</span>
                          <span>{money(bd2.total)}</span>
                        </div>
                        {extrasObrig.map(e => (
                          <div key={e.id+'2'} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#555', fontSize: 13 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 9, fontWeight: 800, background: '#1C7A5B', color: '#fff', borderRadius: 3, padding: '1px 4px' }}>OBR</span>{e.nome}
                            </span>
                            <span>{money(e.preco)}</span>
                          </div>
                        ))}
                      </>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #eee', paddingTop: 10, marginTop: 6, fontSize: 15 }}>
                        <span>Total{useApt2 && apt2 ? ' combinado' : ''}</span><span>{money(totalComExtras)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: C.coralDeep, fontWeight: 600, fontSize: 13, marginTop: 6 }}>
                        <span>Sinal ({data.settings.sinalPct}%)</span><span>{money(sinal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(() => {
                const canBook = localNights && isAvail && meetsMin && (!useApt2 || (apt2Id && isAvail2));
                const label = !localNights ? 'Selecione as datas' : !isAvail ? 'Indisponível' : !meetsMin ? `Mínimo ${minN} noites` : useApt2 && apt2Id && !isAvail2 ? (apt2?.nome || '') + ' indisponível' : useApt2 && !apt2Id ? 'Escolha o 2º apto' : 'Reservar agora';
                return (
                  <button onClick={handleBook} disabled={!canBook}
                    style={{ width: '100%', padding: '15px 0', background: canBook ? C.coral : '#ccc', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 16, cursor: canBook ? 'pointer' : 'not-allowed', fontFamily: F.sans, transition: 'background .15s' }}
                    onMouseEnter={e => { if (canBook) e.currentTarget.style.background = C.coralDeep; }}
                    onMouseLeave={e => { if (canBook) e.currentTarget.style.background = C.coral; }}>
                    {label}
                  </button>
                );
              })()}

              <p style={{ textAlign: 'center', fontSize: 12, color: '#717171', marginTop: 10 }}>Sem cobranças até confirmar · {data.settings.sinalPct}% de sinal para reservar</p>
            </div>

            {/* need help */}
            <div style={{ marginTop: 16, padding: '14px 16px', background: '#f8f8f8', borderRadius: 12, fontSize: 13.5, color: '#555', lineHeight: 1.55 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Precisa de ajuda?</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={14} /> {data.settings.telefone}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><Mail size={14} /> {data.settings.email}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── AptCard — shared by Section rows and search results ── */
