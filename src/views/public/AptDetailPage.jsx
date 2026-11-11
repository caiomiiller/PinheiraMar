import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Heart, BedDouble, Wifi, Users,
  AlertCircle, CalendarDays, Check, Waves, Star, MapPin, Home,
  MessageCircle, X, Share2, DoorOpen, Utensils, SquareParking, Flame, Snowflake,
  Sun, Clock, VolumeX, PawPrint, CigaretteOff, ShoppingBag, Minus, Plus } from 'lucide-react';
import { Faixa, BRAND } from '../../components/Brand';
import { C, F, GOOGLE_RATING, R } from '../../lib/constants';
import { whatsappUrl, msgApartamento } from '../../lib/whatsapp';
import { money, nights, ymd, today, addDays, isAvailable } from '../../lib/helpers';
import { orcamentoReserva, regraNoites } from '../../lib/precos';
import { useIdioma } from '../../lib/i18n';
import { PhotoTile, FotoInteira } from '../../components/ui';
import { AvailabilityCalendar } from '../../components/AvailabilityCalendar';
import { LinhasOrcamento } from '../../components/LinhasOrcamento';

export const HIGHLIGHTS = [
  // ícones de linha fina (Lucide, traço 1,5, marinho) — regra da marca, em vez de emojis
  { match: /wi.fi|internet/i,       Icon: Wifi, chave: 'ap_hl_wifi' },
  { match: /estacionamento|garagem/i, Icon: SquareParking, chave: 'ap_hl_estacionamento' },
  { match: /vista.*mar|mar.*vista|frente.*mar/i, Icon: Waves, chave: 'ap_hl_vista_mar' },
  { match: /churrasco/i,            Icon: Flame, chave: 'ap_hl_churrasqueira' },
  { match: /ar.condicionado/i,      Icon: Snowflake, chave: 'ap_hl_ar' },
  { match: /cozinha/i,              Icon: Utensils, chave: 'ap_hl_cozinha' },
  { match: /piscina/i,              Icon: Waves, chave: 'ap_hl_piscina' },
  { match: /varanda/i,              Icon: Sun, chave: 'ap_hl_varanda' },
];

// botões circulares flutuantes sobre a foto (voltar/compartilhar/salvar) — só no telemóvel; 44 px de alvo
const floatBtn = { width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.94)', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.ink, boxShadow: '0 2px 8px rgba(0,0,0,.18)' };

// −/+ de 44 px (alvo de toque confortável — público 50+). Antes tinham 24–26 px.
function Contador({ valor, min = 1, max, onChange, rotuloMenos, rotuloMais }) {
  const b = (tipo, desativado, onClick, rotulo) => (
    <button type="button" aria-label={rotulo} onClick={onClick} disabled={desativado}
      style={{ width: 44, height: 44, borderRadius: '50%', border: `1.5px solid ${desativado ? C.line : C.bordaForte}`, background: C.white, color: desativado ? C.inativo : C.ink, cursor: desativado ? 'default' : 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      {tipo === 'menos' ? <Minus size={18} /> : <Plus size={18} />}
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {b('menos', valor <= min, () => onChange(Math.max(min, valor - 1)), rotuloMenos)}
      <b style={{ minWidth: 20, textAlign: 'center', fontSize: 18 }} aria-live="polite">{valor}</b>
      {b('mais', valor >= max, () => onChange(Math.min(max, valor + 1)), rotuloMais)}
    </div>
  );
}

// Regras da casa: os preços vêm das Taxas do painel (antes estavam escritos
// no código e não mudavam quando a taxa mudava). A vaga obrigatória fica sem
// preço na frase, como pedido pelo Caio.
function regrasDaCasa(data, tr) {
  const taxas = data.taxasAdicionais || [];
  const achar = (re, tipo) => taxas.find(t => re.test(String(t.nome || '')) && (!tipo || t.tipo === tipo));
  const pet = achar(/pet|animal/i);
  const vagaExtra = achar(/vaga adicional|estacionamento adicional/i) || achar(/estacion|vaga|garagem/i, 'opcional');
  const vagaObrig = achar(/estacion|vaga|garagem/i, 'obrigatoria');
  const estacionamento = [vagaObrig ? tr('ap_regra_vaga_obrig') : tr('ap_regra_vaga'), vagaExtra ? tr('ap_regra_vaga_extra', money(vagaExtra.preco)) : null].filter(Boolean).join(' ');
  return [
    { icon: Clock, titulo: tr('ap_regra_checkin'), texto: tr('ap_regra_checkin_txt', data.settings.checkInHora || '13:00') },
    { icon: DoorOpen, titulo: tr('ap_regra_checkout'), texto: tr('ap_regra_checkout_txt', data.settings.checkOutHora || '10:00') },
    { icon: VolumeX, titulo: tr('ap_regra_silencio'), texto: tr('ap_regra_silencio_txt') },
    { icon: PawPrint, titulo: tr('ap_regra_pets'), texto: pet ? tr('ap_regra_pets_txt', money(pet.preco)) : tr('ap_regra_pets_consulte') },
    { icon: SquareParking, titulo: tr('ap_regra_estacionamento'), texto: estacionamento },
    { icon: CigaretteOff, titulo: tr('ap_regra_fumar'), texto: tr('ap_regra_fumar_txt') },
  ];
}

export function AptDetailPage({ apt, data, ci, co, hosp, setCi, setCo, setHosp, liked, setLiked, onBack, onBook, ultimaNoite }) {
  const td = today();
  const { tr, fmtCurta, dado, lang } = useIdioma();
  const [localCi, setLocalCi] = useState(ci || '');
  const [localCo, setLocalCo] = useState(co || '');
  const [localHosp, setLocalHosp] = useState(Math.min(hosp || 1, apt.capacidade));
  const [calOpen, setCalOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  // telemóvel: o quadro de reserva abre como folha de ecrã inteiro a partir
  // da barra fixa do rodapé, em vez de ficar no fim de uma página longa
  // Esc fecha o calendário de datas
  useEffect(() => {
    if (!calOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setCalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [calOpen]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = (withCal) => { if (withCal) setCalOpen(true); setSheetOpen(true); };
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [sheetOpen]);
  // reserva conjunta
  const [useApt2, setUseApt2] = useState(false);
  const [apt2Id, setApt2Id] = useState('');
  const [g1, setG1] = useState(Math.min(hosp || 1, apt.capacidade));
  const [g2, setG2] = useState(1);

  // título da aba (e do histórico/favoritos) = apartamento + residencial;
  // volta ao título anterior ao sair. A prévia do WhatsApp vem do servidor
  // (api/previa.js) — o navegador só cuida da aba.
  useEffect(() => {
    const anterior = document.title;
    document.title = [apt.nome, data.settings?.nome].filter(Boolean).join(' · ') || anterior;
    return () => { document.title = anterior; };
  }, [apt.nome, data.settings?.nome]); // eslint-disable-line react-hooks/exhaustive-deps

  const amenidades = Array.isArray(apt.amenidades) ? apt.amenidades : [];
  const camas = Array.isArray(apt.camas) ? apt.camas : [{ tipo: 'Casal', qtd: 1 }];
  const fotos = Array.isArray(apt.fotos) && apt.fotos.length > 0 ? apt.fotos : [];
  const isAvail = isAvailable(data.reservas, apt.id, localCi || ymd(td), localCo || ymd(addDays(td, 2)));

  // ── galeria (telemóvel): índice da foto visível, para o contador '1/N' ──
  const galleryRef = useRef(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const onGalleryScroll = () => {
    const el = galleryRef.current;
    if (!el || !el.firstElementChild) return;
    const w = el.firstElementChild.getBoundingClientRect().width + 6;
    if (!w) return;
    setPhotoIdx(Math.max(0, Math.min(fotos.length - 1, Math.round(el.scrollLeft / w))));
  };

  // ── lightbox: visualizador de fotos em ecrã inteiro (todas as fotos, não só as 5 da grelha) ──
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const openLightbox = (i) => setLightboxIdx(i);
  const closeLightbox = () => setLightboxIdx(null);
  const lightboxPrev = () => setLightboxIdx(i => (i - 1 + fotos.length) % fotos.length);
  const lightboxNext = () => setLightboxIdx(i => (i + 1) % fotos.length);
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') lightboxPrev();
      else if (e.key === 'ArrowRight') lightboxNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, fotos.length]);

  const localNights = localCi && localCo && nights(localCi, localCo) >= 1 ? nights(localCi, localCo) : 0;

  // segundo apartamento (reserva conjunta)
  const apt2 = useApt2 && apt2Id ? (data.apartamentos || []).find(a => a.id === apt2Id) : null;
  const isAvail2 = apt2 && localCi && localCo ? isAvailable(data.reservas, apt2.id, localCi, localCo) : false;

  // preço: a MESMA função que o servidor usa para cobrar (lib/precos.js)
  const orc = localNights > 0 ? orcamentoReserva({
    itens: [{ apt, hospedes: useApt2 && apt2 ? g1 : localHosp }, useApt2 && apt2 ? { apt: apt2, hospedes: g2 } : null].filter(Boolean),
    seasons: data.seasons, taxas: data.taxasAdicionais, checkIn: localCi, checkOut: localCo, sinalPct: data.settings.sinalPct,
  }) : null;
  const o1 = orc?.partes[0]?.orcamento || null;
  const o2 = orc?.partes[1]?.orcamento || null;
  const totalComExtras = orc?.total || 0;
  const sinal = orc?.sinal || 0;

  // A pesquisa (hosp) veio da página de busca e pode exceder a capacidade
  // deste apartamento sozinho — nesse caso o cliente TEM de combinar com um
  // segundo apartamento para o número de hóspedes pesquisado ser respeitado.
  const precisaSegundoApto = hosp > 0 && hosp > apt.capacidade;
  const capacidadeCombinada = apt.capacidade + (apt2 ? apt2.capacidade : 0);
  const comboAtendeReq = !precisaSegundoApto || (useApt2 && apt2Id && isAvail2 && capacidadeCombinada >= hosp);

  // mínimo/máximo de noites da temporada REAL do dia de check-in (ignora
  // temporadas inativas e tarifas rápidas — ver precos.js/regraNoites)
  const regra = regraNoites(data.seasons, localCi);
  const minN = regra.min;
  const maxN = regra.max;
  const abaixoMin = localNights > 0 && localNights < minN;
  const acimaMax = localNights > 0 && !!maxN && localNights > maxN;
  const meetsMin = !abaixoMin && !acimaMax;

  const otherApts = (data.apartamentos || []).filter(a => a.id !== apt.id && a.ativo !== false);

  const highlights = HIGHLIGHTS.filter(h =>
    amenidades.some(a => h.match.test(a)) ||
    (apt.vista === 'Frente Mar' && h.match.test('frente mar'))
  );

  const canBookNow = !!(localNights && isAvail && meetsMin && (!useApt2 || (apt2Id && isAvail2)) && comboAtendeReq);
  const nQuartos = apt.quartos || 1;
  const nCamas = camas.reduce((n, c) => n + (Number(c.qtd) || 0), 0) || 1;

  const handleBook = () => {
    if (!localCi || !localCo || localNights < 1 || !meetsMin || !comboAtendeReq) return;
    setSheetOpen(false);
    setCi(localCi); setCo(localCo); setHosp(useApt2 ? g1 + g2 : localHosp);
    onBook(apt, apt2 || null, useApt2 ? g1 : localHosp, useApt2 ? g2 : null);
  };

  const compartilhar = () => {
    const url = window.location.href;
    if (navigator.share) { navigator.share({ title: apt.nome, url }).catch(() => {}); return; }
    navigator.clipboard?.writeText(url); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000);
  };
  const alternarFavorito = (e) => { e?.stopPropagation?.(); setLiked(l => ({ ...l, [apt.id]: !l[apt.id] })); };

  const PolicyItem = ({ icon, title, text }) => (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.line}` }}>
      <span style={{ flexShrink: 0, marginTop: 1, display: 'grid', placeItems: 'center' }}>{React.createElement(icon, { size: 21, strokeWidth: 1.5, color: BRAND.marinho })}</span>
      <div><div style={{ fontWeight: 500, fontSize: 16, marginBottom: 2 }}>{title}</div><div style={{ fontSize: 15, color: C.inkSoft, lineHeight: 1.55 }}>{text}</div></div>
    </div>
  );

  return (
    <div style={{ background: C.white, minHeight: '100vh', fontFamily: F.sans, color: C.ink }}>

      {/* sticky back bar (desktop) — no telemóvel dá lugar aos ícones flutuantes sobre a foto */}
      <div className="pm-detail-topbar" style={{ position: 'sticky', top: 0, zIndex: 60, background: C.white, borderBottom: `1px solid ${C.line}`, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, height: 52 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 15, color: C.ink, minHeight: 44, padding: '0 4px' }}>
          <ChevronLeft size={20} /> {tr('ap_voltar')}
        </button>
        <div style={{ fontWeight: 700, fontSize: 16, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apt.nome}</div>

        <button onClick={compartilhar} aria-live="polite"
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: C.inkSoft, minHeight: 44 }}>
          <Share2 size={17} /> {shareCopied ? tr('ap_link_copiado') : tr('ap_compartilhar')}
        </button>
        <button onClick={alternarFavorito} aria-pressed={!!liked[apt.id]}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: C.inkSoft, minHeight: 44 }}>
          <Heart size={18} fill={liked[apt.id] ? BRAND.vermelho : 'none'} color={liked[apt.id] ? BRAND.vermelho : C.inkSoft} /> {liked[apt.id] ? tr('ap_salvo') : tr('ap_salvar')}
        </button>
      </div>

      <div className="pm-detail-wrap pm-detail-reorder" style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* title + badges */}
        <div className="pm-detail-title-block" style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 30, fontWeight: 300, margin: '0 0 8px', letterSpacing: 0, lineHeight: 1.2 }}>{lang === 'pt' ? (apt.tipo || apt.nome) : [apt.nome, dado(apt.piso), dado(apt.vista)].filter(Boolean).join(' · ')}</h1>
          {/* resumo rápido, como no Airbnb: o que o cliente quer saber primeiro */}
          <div className="pm-detail-facts" style={{ fontSize: 15.5, color: C.ink, margin: '0 0 8px' }}>
            {tr('ap_resumo', apt.capacidade, nQuartos, nCamas)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 15 }}>
            <a href={GOOGLE_RATING.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
              style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'inherit', textDecoration: 'none' }}
              title={tr('ap_ver_avaliacoes')}>
              <Star size={15} fill={C.ink} color={C.ink} /><b>{GOOGLE_RATING.value}</b>
              <span style={{ color: C.inkSoft, textDecoration: 'underline' }}>({tr('ap_avaliacoes_google', GOOGLE_RATING.count)})</span>
            </a>
            <span style={{ color: C.inkSoft }}>·</span>
            <span style={{ color: C.inkSoft }}>{dado(apt.piso)}</span>
            <span style={{ color: C.inkSoft }}>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={13} color={C.inkSoft} /> {apt.cidade || data.settings.cidade}</span>
            {apt.vista === 'Frente Mar' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${BRAND.marinho}`, color: BRAND.marinho, borderRadius: R.pilula, padding: '3px 10px', fontWeight: 500, fontSize: 14 }}><Waves size={15} strokeWidth={1.5} /> {tr('ap_frente_mar')}</span>}
          </div>
        </div>

        {/* photo gallery */}
        <div className="pm-detail-gallery-block" style={{ borderRadius: R.modal, overflow: 'hidden', marginBottom: 28, position: 'relative' }}>
          {/* ícones flutuantes sobre a foto — só no telemóvel (ver CSS); no desktop usa-se a barra sticky acima */}
          <div className="pm-detail-float-nav" style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 5, display: 'none', justifyContent: 'space-between', pointerEvents: 'none' }}>
            <button onClick={onBack} aria-label={tr('ap_voltar')} style={{ ...floatBtn, pointerEvents: 'auto' }}><ChevronLeft size={21} /></button>
            <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
              <button onClick={compartilhar} aria-label={shareCopied ? tr('ap_link_copiado') : tr('ap_compartilhar')} style={floatBtn}><Share2 size={18} /></button>
              <button onClick={alternarFavorito} aria-label={liked[apt.id] ? tr('ap_salvo') : tr('ap_salvar')} aria-pressed={!!liked[apt.id]} style={floatBtn}><Heart size={18} fill={liked[apt.id] ? BRAND.vermelho : 'none'} color={liked[apt.id] ? BRAND.vermelho : C.ink} /></button>
            </div>
          </div>
          {/* fotos inteiras, sem cortar nem deformar (ver FotoInteira em ui.jsx) */}
          {fotos.length >= 3 ? (
            <div ref={galleryRef} onScroll={onGalleryScroll} className="pm-detail-gallery" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '240px 180px', gap: 4 }}>
              <div style={{ gridRow: '1 / 3', position: 'relative', overflow: 'hidden', cursor: 'pointer' }} onClick={() => openLightbox(0)}>
                <FotoInteira src={fotos[0]} alt={tr('ap_foto_n', 1, apt.nome)} fetchPriority="high" />
              </div>
              {fotos.slice(1).map((f, i) => (
                <div key={i} style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }} onClick={() => openLightbox(i + 1)}>
                  <FotoInteira src={f} alt={tr('ap_foto_n', i + 2, apt.nome)} loading="lazy" />
                </div>
              ))}
              {fotos.length === 0 && <PhotoTile apt={apt} h={420} radius={0} rotulo={dado(apt.vista)} />}
            </div>
          ) : (
            <div style={{ height: 380 }}><PhotoTile apt={apt} h={380} radius={0} rotulo={dado(apt.vista)} /></div>
          )}
          {fotos.length >= 3 && (
            <button onClick={() => openLightbox(photoIdx)} className="pm-detail-counter" style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,.65)', color: C.white, fontSize: 14, fontWeight: 700, minHeight: 36, padding: '6px 14px', borderRadius: R.pilula, zIndex: 4, border: 'none', cursor: 'pointer' }}>
              <span className="pm-detail-counter-mobile">{photoIdx + 1}/{fotos.length}</span>
              <span className="pm-detail-counter-desktop">{tr('ap_ver_todas_fotos', fotos.length)}</span>
            </button>
          )}
        </div>

        {/* lightbox — visualizador de ecrã inteiro com todas as fotos do apartamento */}
        {lightboxIdx !== null && fotos.length > 0 && (
          <div onClick={closeLightbox} style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,16,.94)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={closeLightbox} aria-label={tr('ap_fechar')} style={{ position: 'absolute', top: 16, right: 16, ...floatBtn, zIndex: 202 }}><X size={20} /></button>
            <span style={{ position: 'absolute', top: 20, left: 20, color: C.white, fontSize: 13.5, fontWeight: 700, background: 'rgba(255,255,255,.14)', padding: '5px 12px', borderRadius: R.pilula, zIndex: 202 }}>
              {lightboxIdx + 1}/{fotos.length}
            </span>
            {fotos.length > 1 && (
              <button onClick={e => { e.stopPropagation(); lightboxPrev(); }} aria-label={tr('ap_foto_anterior')} style={{ position: 'absolute', left: 16, ...floatBtn, width: 44, height: 44, zIndex: 202 }}><ChevronLeft size={24} /></button>
            )}
            <img src={fotos[lightboxIdx]} alt={tr('ap_foto_n', lightboxIdx + 1, apt.nome)} onClick={e => e.stopPropagation()}
              style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: R.campo }} />
            {fotos.length > 1 && (
              <button onClick={e => { e.stopPropagation(); lightboxNext(); }} aria-label={tr('ap_proxima_foto')} style={{ position: 'absolute', right: 16, ...floatBtn, width: 44, height: 44, zIndex: 202 }}><ChevronRight size={24} /></button>
            )}
          </div>
        )}

        {/* main two-column layout */}
        <div className="pm-detail-grid pm-detail-maingrid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 48, alignItems: 'start' }}>

          {/* LEFT column */}
          <div>

            {/* highlights */}
            {highlights.length > 0 && (
              <section style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 22, fontWeight: 400, margin: '0 0 8px' }}>{tr('ap_pontos_fortes')}</h2>
                <Faixa height={2} width={44} style={{ marginBottom: 16 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {highlights.map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: C.fundoSuave, borderRadius: R.cartao }}>
                      <h.Icon size={22} strokeWidth={1.5} color={BRAND.marinho} />
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{tr(h.chave)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* description */}
            {apt.descricao && (
              <section style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${C.line}` }}>
                <h2 style={{ fontSize: 22, fontWeight: 400, margin: '0 0 8px' }}>{tr('ap_sobre')}</h2>
                <Faixa height={2} width={44} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 15, lineHeight: 1.7, color: C.ink, whiteSpace: 'pre-wrap' }}>{apt.descricao}</div>
              </section>
            )}

            {/* sleeping arrangements */}
            <section style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${C.line}` }}>
              <h2 style={{ fontSize: 22, fontWeight: 400, margin: '0 0 8px' }}>{tr('ap_acomodacoes')}</h2>
              <Faixa height={2} width={44} style={{ marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {camas.map((c, i) => (
                  <div key={i} style={{ padding: '16px 20px', background: C.fundoSuave, borderRadius: R.cartao, minWidth: 140 }}>
                    <BedDouble size={26} strokeWidth={1.5} color={BRAND.marinho} style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.qtd}× {dado(c.tipo)}</div>
                  </div>
                ))}
                {camas.length === 0 && (
                  <div style={{ padding: '16px 20px', background: C.fundoSuave, borderRadius: R.cartao }}>
                    <BedDouble size={26} strokeWidth={1.5} color={BRAND.marinho} style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 700, fontSize: 15 }}>1× {dado('Casal')}</div>
                  </div>
                )}
              </div>
            </section>

            {/* amenities */}
            {amenidades.length > 0 && (
              <section style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${C.line}` }}>
                <h2 style={{ fontSize: 22, fontWeight: 400, margin: '0 0 8px' }}>{tr('ap_comodidades')}</h2>
                <Faixa height={2} width={44} style={{ marginBottom: 16 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px 24px' }}>
                  {amenidades.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: C.ink }}>
                      <Check size={17} strokeWidth={1.5} color={BRAND.marinho} style={{ flexShrink: 0 }} /> {dado(a)}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* capacity */}
            <section style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${C.line}` }}>
              <h2 style={{ fontSize: 22, fontWeight: 400, margin: '0 0 8px' }}>{tr('ap_capacidade')}</h2>
              <Faixa height={2} width={44} style={{ marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: C.fundoSuave, borderRadius: R.cartao }}>
                  <Users size={22} color={C.ocean} /><div><div style={{ fontWeight: 700 }}>{tr('pessoas', apt.capacidade)}</div><div style={{ fontSize: 14, color: C.inkSoft }}>{tr('ap_capacidade_maxima')}</div></div>
                </div>
                {(() => { const nQuartos = apt.quartos || 1; return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: C.fundoSuave, borderRadius: R.cartao }}>
                    <DoorOpen size={22} color={C.ocean} /><div><div style={{ fontWeight: 700 }}>{tr('ap_quartos', nQuartos)}</div><div style={{ fontSize: 14, color: C.inkSoft }}>{tr('ap_para_dormir')}</div></div>
                  </div>
                ); })()}
                {apt.tamanho && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: C.fundoSuave, borderRadius: R.cartao }}>
                    <Home size={22} color={C.ocean} /><div><div style={{ fontWeight: 700 }}>{apt.tamanho} m²</div><div style={{ fontSize: 14, color: C.inkSoft }}>{tr('ap_area')}</div></div>
                  </div>
                )}
              </div>
            </section>

            {/* house rules */}
            <section style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${C.line}` }}>
              <h2 style={{ fontSize: 22, fontWeight: 400, margin: '0 0 8px' }}>{tr('ap_regras')}</h2>
              <Faixa height={2} width={44} style={{ marginBottom: 12 }} />
              {regrasDaCasa(data, tr).map((r, i) => <PolicyItem key={i} icon={r.icon} title={r.titulo} text={r.texto} />)}
            </section>

            {/* location map */}
            {apt.mostrarMapa !== false && (
              <section style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 22, fontWeight: 400, margin: '0 0 8px' }}>{tr('ap_localizacao')}</h2>
                <Faixa height={2} width={44} style={{ marginBottom: 14 }} />
                <div style={{ borderRadius: R.cartao, overflow: 'hidden', height: 260 }}>
                  <iframe title={tr('ap_mapa')}
                    src={`https://maps.google.com/maps?q=${encodeURIComponent((apt.endereco || data.settings.endereco || '') + ', ' + (apt.cidade || data.settings.cidade || 'Praia da Pinheira, SC'))}&output=embed&zoom=15`}
                    width="100%" height="260" style={{ border: 0, display: 'block' }}
                    loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
                <p style={{ fontSize: 15, color: C.inkSoft, marginTop: 10 }}>
                  <MapPin size={14} strokeWidth={1.5} style={{ verticalAlign: '-2px' }} /> {apt.endereco || data.settings.endereco} · {apt.cidade || data.settings.cidade}
                </p>
                {apt.residencialId === 'pinheiramar' && (
                  <p style={{ fontSize: 15, color: C.inkSoft, marginTop: 6 }}>
                    <ShoppingBag size={15} strokeWidth={1.5} style={{ verticalAlign: '-2px' }} /> {tr('ap_comercio')}
                  </p>
                )}
              </section>
            )}

          </div>

          {/* RIGHT column — booking widget (sticky no desktop, em fluxo normal no telemóvel) */}
          <div className="pm-detail-side" id="booking-widget" data-sheet={sheetOpen ? 'open' : 'closed'} style={{ position: 'sticky', top: 60 }}>

            {/* cabeçalho da folha — só aparece no telemóvel (ver App.jsx) */}
            <div className="pm-detail-sheethead" style={{ display: 'none', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 19, fontWeight: 700 }}>{tr('ap_datas_e_reserva')}</div>
              <button onClick={() => setSheetOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 16px', border: `1px solid ${C.inativo}`, borderRadius: R.pilula, background: C.white, fontSize: 15, fontWeight: 700, color: C.ink, cursor: 'pointer', fontFamily: F.sans }}>
                <X size={17} /> {tr('ap_fechar')}
              </button>
            </div>

            {/* pesquisa REAL do cliente (a que veio da página principal) — pode
                limpar aqui mesmo, sem voltar à página principal. A pedido do Caio. */}
            {!!(ci || co || hosp) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, padding: '8px 8px 8px 14px', border: `1px solid ${C.line}`, borderRadius: R.modal, background: C.white, fontSize: 15, fontWeight: 600, color: C.ink }}>
                <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 8px', minWidth: 0 }}>
                  <CalendarDays size={15} color={C.inkSoft} style={{ flexShrink: 0 }} />
                  {ci && co ? <>{fmtCurta(ci)} → {fmtCurta(co)}</> : <span style={{ color: C.inkSoft }}>{tr('ap_sem_datas')}</span>}
                  {hosp > 0 && <> · {tr('pessoas', hosp)}</>}
                </span>
                <button onClick={() => { setCi(''); setCo(''); setHosp(0); setLocalCi(''); setLocalCo(''); const v = Math.min(1, apt.capacidade); setLocalHosp(v); setG1(v); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, minHeight: 40, padding: '0 12px', border: `1px solid ${C.line}`, borderRadius: R.pilula, background: C.white, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: C.inkSoft, fontFamily: F.sans }}>
                  <X size={14} /> {tr('ap_limpar_pesquisa')}
                </button>
              </div>
            )}

            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: R.modal, padding: 24, boxShadow: '0 8px 28px rgba(0,0,0,.12)' }}>
              <div style={{ marginBottom: 18 }}>
                {/* sem datas não mostra valor nenhum (nem "a partir de"): a tarifa
                    muda muito com a temporada e o número enganava — o preço
                    real, já com as taxas, aparece ao escolher as datas. A
                    pedido do Caio, 2026-09. */}
                {!orc && <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.3, color: C.ink, textWrap: 'balance' }}>{tr('ap_adicione_datas_preco')}</div>}
                <a href={GOOGLE_RATING.url} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: 14.5, color: 'inherit', textDecoration: 'none' }}
                  title={tr('ap_ver_avaliacoes')}>
                  <Star size={14} fill={C.ink} color={C.ink} /><b>{GOOGLE_RATING.value}</b>
                  <span style={{ color: C.inkSoft }}>· {tr('ap_n_avaliacoes', GOOGLE_RATING.count)}</span>
                </a>
              </div>

              {/* seletor de datas — abre o calendário de disponibilidade.
                  Envolvido num wrapper "position: relative" para o calendário
                  poder abrir como um popover mais largo (460px, como o da
                  página inicial) por cima do resto do cartão, em vez de ficar
                  espremido nos ~300px da coluna lateral — a pedido do Caio,
                  2026-09-27 (calendário "mal dimensionado" nesta página). */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <div style={{ border: `1px solid ${C.bordaForte}`, borderRadius: R.cartao, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <button onClick={() => setCalOpen(o => !o)} aria-expanded={calOpen} style={{ minHeight: 60, padding: '10px 14px', border: 'none', borderRight: `1px solid ${C.bordaForte}`, background: calOpen ? C.fundoSuave : C.white, cursor: 'pointer', textAlign: 'left', fontFamily: F.sans }}>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3, color: C.ink }}>{tr('ap_checkin')}</div>
                      <div style={{ fontSize: 16, color: localCi ? C.ink : C.inkSoft }}>{localCi ? fmtCurta(localCi) : tr('ap_adicionar_data')}</div>
                    </button>
                    <button onClick={() => setCalOpen(o => !o)} aria-expanded={calOpen} style={{ minHeight: 60, padding: '10px 14px', border: 'none', background: calOpen ? C.fundoSuave : C.white, cursor: 'pointer', textAlign: 'left', fontFamily: F.sans }}>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3, color: C.ink }}>{tr('ap_checkout')}</div>
                      <div style={{ fontSize: 16, color: localCo ? C.ink : C.inkSoft }}>{localCo ? fmtCurta(localCo) : tr('ap_adicionar_data')}</div>
                    </button>
                  </div>
                  <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.bordaForte}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>{tr('ap_hospedes')}</div>
                      <div style={{ fontSize: 14, color: C.inkSoft }}>{tr('bk_maximo', apt.capacidade)}</div>
                    </div>
                    <Contador valor={localHosp} max={apt.capacidade} onChange={v => { setLocalHosp(v); setG1(v); }}
                      rotuloMenos={tr('bk_menos_pessoa')} rotuloMais={tr('bk_mais_pessoa')} />
                  </div>
                </div>

                {/* Calendário: no computador abre como uma janela centrada no ecrã,
                    com rolagem própria — antes era um popover preso ao quadro
                    lateral (sticky) e a parte de baixo ficava fora do ecrã sem
                    como rolar até lá (pedido do Caio, 2026-11-08). No telemóvel
                    (ver .pm-cal-dialog em App.jsx) fica no fluxo da folha de
                    reserva, que rola normalmente. */}
                {calOpen && (
                  <>
                    <div className="pm-cal-backdrop" onClick={() => setCalOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(10,20,30,.28)' }} />
                    <div className="pm-cal-dialog" role="dialog" aria-modal="true" aria-label={tr('ap_checkin') + ' / ' + tr('ap_checkout')}
                      style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100, width: 680, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', borderRadius: R.modal, boxShadow: '0 24px 60px rgba(10,20,30,.28)' }}
                      onClick={e => e.stopPropagation()}>
                      <AvailabilityCalendar apt={apt} reservas={data.reservas} ci={localCi} co={localCo} ate={ultimaNoite}
                        onChange={(newCi, newCo) => {
                          setLocalCi(newCi); setLocalCo(newCo);
                          if (newCi && newCo) setCalOpen(false);
                        }} />
                    </div>
                  </>
                )}
              </div>

              {/* aviso: a pesquisa exige mais pessoas do que este apartamento leva sozinho */}
              {precisaSegundoApto && (
                <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, padding: '10px 14px', borderRadius: R.cartao, background: C.erroBg, border: `1px solid ${C.erroBorda}` }}>
                  <AlertCircle size={17} color={C.erro} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 14.5, color: C.erro, fontWeight: 600, lineHeight: 1.5 }}>{tr('ap_precisa_segundo', hosp, apt.capacidade)}</div>
                </div>
              )}

              {/* segundo apartamento (reserva conjunta) */}
              <div style={{ marginBottom: 10, padding: '12px 14px', background: precisaSegundoApto && !useApt2 ? C.erroBg : C.fundoSuave, borderRadius: R.cartao, border: precisaSegundoApto && !useApt2 ? `1px solid ${C.erroBorda}` : `1px solid ${C.line}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 15.5, fontWeight: 600, minHeight: 32 }}>
                  <input type="checkbox" checked={useApt2} onChange={e => { setUseApt2(e.target.checked); if (!e.target.checked) setApt2Id(''); }}
                    style={{ width: 20, height: 20, accentColor: C.ocean, cursor: 'pointer' }} />
                  {tr('ap_segundo_apto')}
                </label>
                <div style={{ fontSize: 14, color: C.inkSoft, marginTop: 3 }}>{tr('ap_segundo_apto_sub')}</div>
                {useApt2 && (
                  <div style={{ marginTop: 10 }}>
                    <select value={apt2Id} onChange={e => setApt2Id(e.target.value)} aria-label={tr('ap_escolha_segundo')}
                      style={{ width: '100%', minHeight: 44, padding: '8px 10px', border: `1px solid ${C.bordaForte}`, borderRadius: R.cartao, fontSize: 16, fontFamily: F.sans, background: C.white }}>
                      <option value="">{tr('ap_escolha_segundo')}</option>
                      {otherApts.map(a => {
                        const av2 = localCi && localCo ? isAvailable(data.reservas, a.id, localCi, localCo) : true;
                        return <option key={a.id} value={a.id} disabled={!av2}>{a.nome} ({tr('bk_maximo', a.capacidade)}){!av2 ? ` — ${tr('ap_indisponivel_curto')}` : ''}</option>;
                      })}
                    </select>
                    {apt2 && (
                      <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                        {[[apt, g1, setG1], [apt2, g2, setG2]].map(([a, val, set]) => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{tr('ap_pessoas_em', a.nome)}</div>
                            <Contador valor={val} max={a.capacidade} onChange={set} rotuloMenos={tr('bk_menos_pessoa_em', a.nome)} rotuloMais={tr('bk_mais_pessoa_em', a.nome)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* mínimo / máximo de noites */}
              {(abaixoMin || acimaMax) && (
                <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10, padding: '10px 12px', borderRadius: R.cartao, background: C.avisoBg, fontSize: 14.5, color: C.aviso, fontWeight: 600 }}>
                  <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
                  {abaixoMin ? tr('ap_minimo_noites', minN, regra.temporada?.nome) : tr('ap_maximo_noites', maxN, regra.temporada?.nome)}
                </div>
              )}

              {/* disponibilidade e detalhe do preço */}
              {localNights > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10, padding: '8px 12px', borderRadius: R.cartao, background: isAvail ? C.sucessoBg : C.erroBg, fontSize: 15, fontWeight: 600, color: isAvail ? C.sucesso : C.erro }}>
                    {isAvail ? <><Check size={16} /> {tr('ap_disponivel')}</> : <><X size={16} /> {tr('ap_indisponivel_datas')}</>}
                    {apt2 && isAvail && <span style={{ fontWeight: 400, fontSize: 14 }}>· {apt2.nome}: {isAvail2 ? tr('ap_disponivel') : tr('ap_indisponivel_curto')}</span>}
                  </div>
                  {isAvail && orc && (
                    <div style={{ fontSize: 15, color: C.ink, display: 'grid', gap: 10 }}>
                      <LinhasOrcamento o={o1} titulo={useApt2 && apt2 ? apt.nome : null} />
                      {o2 && <LinhasOrcamento o={o2} titulo={apt2.nome} />}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: `1px solid ${C.line}`, paddingTop: 10, fontSize: 16.5 }}>
                        <span>{useApt2 && apt2 ? tr('bk_total_combinado') : tr('bk_total')}</span><span>{money(totalComExtras)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: C.acaoEscura, fontWeight: 600, fontSize: 15 }}>
                        <span>{tr('ap_sinal', data.settings.sinalPct)}</span><span>{money(sinal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(() => {
                const canBook = canBookNow;
                const label = !localNights ? tr('ap_btn_selecione_datas')
                  : !isAvail ? tr('ap_btn_indisponivel')
                  : abaixoMin ? tr('ap_btn_minimo', minN)
                  : acimaMax ? tr('ap_btn_maximo', maxN)
                  : precisaSegundoApto && !useApt2 ? tr('ap_btn_adicione_segundo')
                  : useApt2 && !apt2Id ? tr('ap_btn_escolha_segundo')
                  : useApt2 && apt2Id && !isAvail2 ? tr('ap_btn_segundo_indisponivel', apt2?.nome || '')
                  : precisaSegundoApto && !comboAtendeReq ? tr('ap_btn_capacidade', hosp)
                  : tr('ap_btn_reservar');
                return (
                  <button onClick={handleBook} disabled={!canBook}
                    style={{ width: '100%', minHeight: 54, padding: '0 12px', background: canBook ? C.acao : C.inativo, color: canBook ? C.white : C.inkSoft, border: 'none', borderRadius: R.cartao, fontWeight: 700, fontSize: 17, cursor: canBook ? 'pointer' : 'not-allowed', fontFamily: F.sans, transition: 'background .15s' }}
                    onMouseEnter={e => { if (canBook) e.currentTarget.style.background = C.acaoEscura; }}
                    onMouseLeave={e => { if (canBook) e.currentTarget.style.background = C.acao; }}>
                    {label}
                  </button>
                );
              })()}

              <p style={{ textAlign: 'center', fontSize: 14, color: C.inkSoft, marginTop: 10 }}>{tr('ap_sem_cobrancas', data.settings.sinalPct)}</p>
            </div>

            {/* precisa de ajuda */}
            <div style={{ marginTop: 16, padding: '14px 16px', background: C.fundoSuave, borderRadius: R.cartao, fontSize: 15, color: C.ink, lineHeight: 1.55 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{tr('ap_precisa_ajuda')}</div>
              <a href={whatsappUrl(msgApartamento({ aptos: [apt.nome, apt2?.nome], residencial: (data.residenciais || []).find(r => r.id === apt.residencialId)?.nome, ci: localCi, co: localCo, hospedes: localNights ? (useApt2 && apt2 ? g1 + g2 : localHosp) : 0 }))} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, color: BRAND.marinho, fontWeight: 700, textDecoration: 'none' }}>
                <MessageCircle size={17} strokeWidth={1.5} /> {tr('ap_fale_whatsapp')}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* barra fixa do rodapé — só no telemóvel (ver CSS). É o botão principal
          da página: sem datas pede para escolher; com datas mostra o total e
          reserva direto; nos outros casos abre a folha com o quadro de reserva. */}
      <div className="pm-detail-stickybar" style={{ display: 'none', position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 70, background: C.white, borderTop: `1px solid ${C.line}`, padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: '0 -6px 20px rgba(0,0,0,.08)' }}>
        {(() => {
          const btn = (label, onClick) => (
            <button onClick={onClick}
              style={{ minHeight: 52, padding: '0 22px', background: C.acao, color: C.white, border: 'none', borderRadius: R.cartao, fontWeight: 700, fontSize: 17, cursor: 'pointer', fontFamily: F.sans, flexShrink: 0 }}>
              {label}
            </button>
          );
          if (canBookNow && orc) return (
            <>
              <button onClick={() => openSheet(false)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: F.sans, color: C.ink, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: C.inkSoft }}>{fmtCurta(localCi)} – {fmtCurta(localCo)} · {tr('noites', localNights)}</div>
                <div style={{ fontSize: 19, fontWeight: 700 }}>{money(totalComExtras)} <span style={{ fontSize: 14, fontWeight: 500, color: C.inkSoft }}>{tr('ps_total')}</span></div>
                <div style={{ fontSize: 14, color: C.inkSoft, textDecoration: 'underline' }}>{tr('ap_ver_detalhes_preco')}</div>
              </button>
              {btn(tr('ap_reservar_curto'), handleBook)}
            </>
          );
          if (localNights > 0 && !isAvail) return (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.erro }}>{tr('ap_ocupado_datas')}</div>
              {btn(tr('ap_mudar_datas'), () => openSheet(true))}
            </>
          );
          if (localNights > 0) return (
            <>
              <div style={{ fontSize: 15.5, color: C.ink, lineHeight: 1.35 }}>{tr('ap_falta_detalhe')}</div>
              {btn(tr('bk_continuar'), () => openSheet(false))}
            </>
          );
          return (
            <>
              {/* só a frase (sem a nota do Google, que já está logo abaixo das
                  fotos): com o texto mais longo a barra ficava alta demais */}
              <div style={{ minWidth: 0, fontSize: 16, fontWeight: 700, color: C.ink, lineHeight: 1.3, textWrap: 'balance' }}>{tr('ap_adicione_datas_preco')}</div>
              {btn(tr('ap_escolher_datas'), () => openSheet(true))}
            </>
          );
        })()}
      </div>
    </div>
  );
}

