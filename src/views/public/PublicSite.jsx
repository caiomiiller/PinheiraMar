import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Waves, MapPin, MessageCircle, CalendarDays, Heart, ChevronLeft, ChevronRight,
  Home, Users, AlertCircle, X } from 'lucide-react';
import { F, WHATSAPP_URL, fotoTopo, LOGO_RESIDENCIAL } from '../../lib/constants';
import { money, ymd, today, parseYMD, addDays, isAvailable, nights, pad } from '../../lib/helpers';
import { orcamentoApartamento } from '../../lib/precos';
import { ultimaNoiteReservavel, hojeISO } from '../../lib/reservas';
import { lerUltimaReserva } from '../../lib/dadosPublico';
import { IdiomaProvider, useIdioma } from '../../lib/i18n';
import { PhotoTile, Modal } from '../../components/ui';
import { buildScoped } from '../../lib/multiProperty';
import { AptDetailPage } from './AptDetailPage';
import { DestinoSection } from './DestinoSection';
import { AvailabilityCalendar } from '../../components/AvailabilityCalendar';
import { GroupLogo, Faixa, FAIXA_INDEX, BRAND } from '../../components/Brand';
import { BookingModal } from '../../components/BookingModal';
import { ConfirmationModal } from '../../components/ConfirmationModal';

// Logo vertical de cada residencial, usada no cabeçalho de cada grupo de
// apartamentos (substitui o ícone + nome em texto que havia antes).
// assinatura horizontal de cada residencial (símbolo + nome + "Residencial"),
// versão positiva do designer, sem o endosso do grupo: no site o grupo já
// assina o cabeçalho e o rodapé, e o endosso em tamanho de lista não se lia.
// Larguras na mesma escala, para o nome dos dois ter a mesma altura.
// (definidas em lib/constants.js — o e-mail de confirmação usa as mesmas)
const RESIDENCIAL_LOGOS = Object.fromEntries(Object.entries(LOGO_RESIDENCIAL).map(([id, l]) => [id, l.src]));
const RESIDENCIAL_LOGO_W = Object.fromEntries(Object.entries(LOGO_RESIDENCIAL).map(([id, l]) => [id, l.largura]));

// Nome do residencial escrito por extenso ao lado da logo, no mesmo espírito
// tipográfico dela (serifada, maiúsculas, mesmas cores) — a logo sozinha, em
// tamanho de cabeçalho, não é suficiente para diferenciar rapidamente os dois
// residenciais, então o nome reforça a distinção por escrito.
// Cores lidas das próprias logos: as duas partilham o azul-marinho do
// lettering e cada uma tem o seu acento em "Mar" — vermelho no PinheiraMar,
// azul-petróleo no Caminho do Mar.
const RESIDENCIAL_BRAND_TEXT = {
  pinheiramar: [{ t: 'Pinheira', c: '#1B1C46' }, { t: 'Mar', c: '#D1301B' }],
  novoimovel: [{ t: 'Caminho do ', c: '#1B1C46' }, { t: 'Mar', c: '#2D7F9D' }],
};

// Só o símbolo da marca de cada residencial — a logo completa não cabe num
// botão da barra de filtros, que trabalha com ícones de ~20px.
const RESIDENCIAL_ICONS = { pinheiramar: '/brand/pinheiramar-simbolo.png', novoimovel: '/brand/caminho-simbolo.png' };

// Nome curto (sem o prefixo "Residencial"), montado das mesmas partes que o
// cabeçalho de cada grupo usa — assim a barra e o cabeçalho nunca divergem.
const nomeCurtoResidencial = (r) => (RESIDENCIAL_BRAND_TEXT[r.id] || []).map(x => x.t).join('').trim() || r.nome;

// Chave de categoria que representa "só os apartamentos deste imóvel".
const catIsResidencial = (k) => typeof k === 'string' && k.startsWith('res:');
const catResidencialId = (k) => (catIsResidencial(k) ? k.slice(4) : null);

// "Casa 108" é uma casa, não um apartamento: a contagem de cada residencial
// separa as duas (a pedido do Caio). Casa = unidade cujo nome começa por "Casa".
const ehCasa = (apt) => /^\s*casa(?![a-zà-ú])/i.test(apt?.nome || '');

// Extrai {dia, mês, dia da semana} de uma data 'yyyy-mm-dd' para o cartão de
// data grande da busca mobile — no idioma escolhido pelo visitante.
const maiuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
function bigDateParts(s, locale = 'pt-BR') {
  if (!s) return null;
  const d = parseYMD(s);
  return {
    day: pad(d.getDate()),
    month: maiuscula(d.toLocaleDateString(locale, { month: 'long' })),
    wd: maiuscula(d.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')),
  };
}

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

// O idioma escolhido fica num contexto (lib/i18n.jsx) para valer em TODAS as
// telas do hóspede — detalhe, reserva, confirmação, calendário e destino.
export function PublicSite(props) {
  const idiomasAtivos = (props.data.residenciais[0]?.idiomas || []).filter(i => i.ativo);
  const [lang, setLang] = useState(() => {
    const browser = navigator.language?.slice(0, 2);
    const match = idiomasAtivos.find(i => i.codigo === browser);
    return match ? match.codigo : 'pt';
  });
  useEffect(() => { try { document.documentElement.lang = { pt: 'pt-BR', es: 'es', en: 'en' }[lang] || 'pt-BR'; } catch { /* ignora */ } }, [lang]);
  return (
    <IdiomaProvider lang={lang}>
      <PublicSiteConteudo {...props} lang={lang} setLang={setLang} idiomasAtivos={idiomasAtivos} />
    </IdiomaProvider>
  );
}

function PublicSiteConteudo({ data, onReservar, lang, setLang, idiomasAtivos }) {
  const td = today();
  const { tr, fmtCurta, locale, dado } = useIdioma();
  const hojeBR = hojeISO();
  // última noite com temporada cadastrada — o calendário não deixa passar daí
  const ultimaNoite = useMemo(() => ultimaNoiteReservavel(data.seasons, hojeBR), [data.seasons, hojeBR]);

  /* ── state ── */
  const [ci, setCi] = useState('');
  const [co, setCo] = useState('');
  const [hosp, setHosp] = useState(0);
  const [booking, setBooking] = useState(null);
  const [done, setDone] = useState(null);
  // favoritos persistem no browser do visitante (localStorage) para não se
  // perderem ao atualizar a página ou voltar mais tarde — antes eram só
  // estado em memória.
  const [liked, setLiked] = useState(() => {
    try {
      const raw = localStorage.getItem('pm_liked');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem('pm_liked', JSON.stringify(liked)); } catch { /* ignora (privado/bloqueado) */ }
  }, [liked]);
  const [detail, setDetail] = useState(null);

  // Retorno do Mercado Pago (?mp=success|pending|failure&reserva=ID — ver
  // server/mercadopago.js). O site público já não tem os dados das reservas
  // (eram de todos os hóspedes!): a confirmação usa o que ficou guardado
  // neste separador antes de ir pagar. Noutro aparelho/separador, mostra uma
  // confirmação genérica — o e-mail leva os detalhes.
  useEffect(() => {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch { return; }
    const status = params.get('mp');
    const reservaId = params.get('reserva');
    if (!status || !reservaId) return;
    try { window.history.replaceState({}, '', window.location.pathname); } catch { /* ignora */ }
    const info = lerUltimaReserva(reservaId);
    const apt = info ? data.apartamentos.find(a => a.id === info.aptos?.[0]?.id) : null;
    if (apt) setDetail(apt);
    setDone({ info: info || { reservas: [] }, paymentStatus: status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [activeCategory, setActiveCategory] = useState(null);
  const [sortMode, setSortMode] = useState('default'); // 'default' | 'price_asc' | 'price_desc'
  const [guestOpen, setGuestOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  // apartamento cujo calendário de disponibilidade está aberto num popover —
  // mostrado quando o cartão está "indisponível" para as datas pesquisadas,
  // para o visitante ver logo ali quais os dias livres desse apartamento.
  const [calApt, setCalApt] = useState(null);
  const [calCi, setCalCi] = useState('');
  const [calCo, setCalCo] = useState('');
  const resultsRef = useRef(null);
  const searchInlineRef = useRef(null);
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
      orc: valid ? orcamentoApartamento({ apt: a, seasons: data.seasons, taxas: data.taxasAdicionais, checkIn: ci, checkOut: co, hospedes: hosp || undefined }) : null,
    })).sort((x, y) => {
      const priceDiff = sortMode === 'price_desc' ? (y.apt.preco - x.apt.preco) : (x.apt.preco - y.apt.preco);
      return (Number(y.available) - Number(x.available)) ||
        (Number(y.fits) - Number(x.fits)) ||
        // sem ordenação explícita nem filtro de categoria, os apartamentos Frente Mar aparecem primeiro
        (sortMode === 'default' && (!activeCategory || catIsResidencial(activeCategory)) ? (Number(y.apt.vista === 'Frente Mar') - Number(x.apt.vista === 'Frente Mar')) : 0) ||
        priceDiff;
    });
    const availableApts = withInfo.filter(w => w.available).map(w => w.apt);
    const needsCombo = valid && hosp > 0 && hosp > maxCap;
    const combo = needsCombo ? findCombo(availableApts, hosp) : null;
    return { residencial: r, active, withInfo, maxCap, availableApts, needsCombo, combo };
  }), [data, ci, co, hosp, valid, activeCategory, sortMode]);

  const hasFrenteMar = data.apartamentos.some(a => a.ativo && a.vista === 'Frente Mar');

  // Filtrar por imóvel só faz sentido havendo mais do que um: com um só,
  // "Apartamentos" já mostra exactamente o mesmo conjunto.
  const residenciaisComApt = data.residenciais.filter(r => data.apartamentos.some(a => a.ativo && a.residencialId === r.id));
  const mostrarFiltroResidencial = residenciaisComApt.length > 1;
  const residencialAtivo = data.residenciais.find(r => r.id === catResidencialId(activeCategory)) || null;
  const subtituloDisponibilidade = residencialAtivo
    ? tr('ps_disp_no', residencialAtivo.nome)
    : mostrarFiltroResidencial ? tr('ps_disp_nos', residenciaisComApt.length) : tr('ps_disp');

  // "17 apartamentos e 1 casa" / "6 apartamentos" / "1 casa"
  const contagemUnidades = (apts) => {
    const casas = apts.filter(ehCasa).length;
    const aptos = apts.length - casas;
    if (!casas) return tr('ps_n_apartamentos', aptos);
    if (!aptos) return tr('ps_n_casas', casas);
    return tr('ps_n_aptos_casas', aptos, casas);
  };

  const catFilter = (apt) => {
    if (!activeCategory) return true;
    if (catIsResidencial(activeCategory)) return apt.residencialId === catResidencialId(activeCategory);
    if (activeCategory === 'frente_mar') return apt.vista === 'Frente Mar';
    if (activeCategory === 'cap2') return apt.capacidade === 2;
    if (activeCategory === 'cap4') return apt.capacidade === 4;
    if (activeCategory === 'cap6') return apt.capacidade === 6;
    if (activeCategory === 'cap8') return apt.capacidade >= 8;
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

  // Abrir um apartamento põe ?apto=<id> na URL — antes o endereço não mudava
  // e o botão "Compartilhar" enviava a página inicial.
  const openDetail = (apt) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('apto', apt.id);
      window.history.pushState({ pmView: 'detail' }, '', url.pathname + url.search + url.hash);
    } catch { /* ignora */ }
    setDetail(apt);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // link recebido com ?apto=<id>: abre logo esse apartamento
  useEffect(() => {
    let id = null;
    try { id = new URLSearchParams(window.location.search).get('apto'); } catch { /* ignora */ }
    const apt = id && data.apartamentos.find(a => a.id === id && a.ativo !== false);
    if (apt) setDetail(apt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Botão "Voltar" do navegador: fecha o que estiver aberto por cima da
  // pesquisa (detalhe do apartamento, reserva, confirmação) e devolve o
  // visitante à página principal, em vez de sair do site — consome a
  // entrada de histórico criada em openDetail() acima.
  useEffect(() => {
    const handlePopState = () => {
      let id = null;
      try { id = new URLSearchParams(window.location.search).get('apto'); } catch { /* ignora */ }
      setDone(null); setBooking(null);
      setDetail(id ? (data.apartamentos.find(a => a.id === id) || null) : null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [data.apartamentos]);

  /* ── tokens ── */
  // paleta do Grupo PinheiraMar: marinho (texto e ações), pedra (apoio)
  const BLACK  = BRAND.marinho;
  const GREY   = BRAND.pedra;
  const LIGHT  = '#F6F4F0';
  const BORDER = '#E2E0DB';
  const ACCENT = BRAND.marinho;
  const WHITE  = '#FFFFFF';

  /* ── search pill segments ── */
  const Seg = ({ label, children, last }) => (
    <div style={{ flex: 1, padding: '0 20px', borderRight: last ? 'none' : `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, minWidth: 0 }}>
      {/* 11.5px e tracking mais solto que antes (10px/.12em): versalete
          condensada nesse tamanho é o pior caso de legibilidade para
          presbiopia — público 40+ */}
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: GREY }}>{label}</div>
      {children}
    </div>
  );
  const segInput = { border: 'none', outline: 'none', background: 'transparent', fontFamily: F.sans, fontSize: 14, color: BLACK, width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  /* ── cartão de data grande (busca mobile em ecrã cheio) — abre o calendário de disponibilidade visual ── */
  const DateCard = ({ label, value, onClick, compact, placeholder }) => {
    const parts = bigDateParts(value, locale);
    return (
      <div>
        {/* rótulo legível (sem maiúsculas miúdas) — público 50+ */}
        <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 8 }}>{label}</div>
        <button onClick={onClick} style={{ width: '100%', minHeight: 60, textAlign: 'left', position: 'relative', border: `1.5px solid ${value ? BLACK : '#C9C6BF'}`, borderRadius: 14, padding: compact ? '12px' : '14px 16px', background: WHITE, cursor: 'pointer', fontFamily: F.sans }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            {parts ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: compact ? 8 : 12 }}>
                <span style={{ fontSize: compact ? 26 : 34, fontWeight: 800, color: BLACK, lineHeight: 1 }}>{parts.day}</span>
                <div>
                  <div style={{ fontSize: compact ? 14 : 15, fontWeight: 700, color: BLACK }}>{parts.month}</div>
                  <div style={{ fontSize: compact ? 12.5 : 13, color: GREY }}>{parts.wd}</div>
                </div>
              </div>
            ) : (
              <span style={{ fontSize: 15, color: '#555' }}>{placeholder || tr('m_pick_date')}</span>
            )}
            <CalendarDays size={compact ? 18 : 20} color={GREY} style={{ flexShrink: 0 }} />
          </div>
        </button>
      </div>
    );
  };

  /* ── reusable card ── */
  const PCard = ({ apt, available = true, fits = true, orc = null, needsCombo = false }) => {
    return (
      <div onClick={() => available && openDetail(apt)}
        style={{ cursor: available ? 'pointer' : 'default', display: 'flex', flexDirection: 'column' }}
        className="pm-unit-card">
        <div className="pm-card-photo" style={{ position: 'relative', overflow: 'hidden', borderRadius: 14, aspectRatio: '4/3', background: LIGHT }}>
          {/* uma só etiqueta de vista, em cima e traduzida — a de baixo
              ("FRENTE MAR") repetia a mesma informação (a pedido do Caio) */}
          {/* altura 100%: a foto preenche a moldura 4:3 em qualquer largura —
              com 240 fixos sobrava uma faixa cinzenta por baixo nos cartões
              largos (lista de resultados no celular) */}
          <PhotoTile apt={apt} h="100%" radius={0} rotulo={dado(apt.vista)} />
          <button onClick={e => { e.stopPropagation(); setLiked(l => ({ ...l, [apt.id]: !l[apt.id] })); }}
            aria-label={liked[apt.id] ? tr('ps_desfavoritar', apt.nome) : tr('ps_favoritar', apt.nome)} aria-pressed={!!liked[apt.id]}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,.86)', border: 'none', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)' }}>
            <Heart size={18} fill={liked[apt.id] ? BRAND.vermelho : 'none'} color={liked[apt.id] ? BRAND.vermelho : GREY} strokeWidth={1.8} />
          </button>
          {!available && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.55)', display: 'grid', placeItems: 'center' }}>
              <button onClick={e => { e.stopPropagation(); setCalCi(''); setCalCo(''); setCalApt(apt); }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: WHITE, padding: '8px 16px', border: `1px solid ${BORDER}`, borderRadius: 12, cursor: 'pointer', fontFamily: F.sans }}>
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.06em', color: GREY, textTransform: 'uppercase' }}>{tr('ps_indisponivel')}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{tr('ps_ver_datas_livres')}</span>
              </button>
            </div>
          )}
        </div>
        <div style={{ paddingTop: 14 }}>
          {/* Título sozinho numa linha própria (em vez de dividir a linha com a
              capacidade, que descentrava o alinhamento entre cartões de nomes
              diferentes) — capacidade passa a fazer parte da linha de detalhes,
              junto com piso/vista, ecoando o exemplo (título / detalhes / preço),
              a pedido do Caio, 2026-09-23. */}
          <div className="pm-card-title-row" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: BLACK, lineHeight: 1.3 }}>{apt.nome}</div>
          <div style={{ fontSize: 14, color: GREY, marginTop: 3 }}>{dado(apt.piso)} · {dado(apt.vista)} · {tr('ps_ate_pessoas', apt.capacidade)}</div>
          {valid && !fits && (
            needsCombo
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13.5, color: '#B42318', fontWeight: 700, marginTop: 6 }}>
                  <AlertCircle size={14} /> {tr('ps_combinar_obrigatorio', hosp)}
                </div>
              : <div style={{ fontSize: 13.5, color: ACCENT, fontWeight: 600, marginTop: 5 }}>{tr('ps_combinar')}</div>
          )}
          {/* com datas: o TOTAL da estadia, já com as taxas obrigatórias — o
              mesmo valor da página do apartamento e do servidor (sem a
              "média por noite", que não batia com a conta quando o fim de
              semana custa mais). Sem datas o cartão não mostra valor nenhum:
              a diária muda muito com a temporada e o "a partir de" enganava;
              uma frase só, acima da lista, pede as datas (a pedido do Caio,
              2026-09). */}
          {valid && orc && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 19, fontWeight: 700, color: BLACK }}>{money(orc.total)}</span>
                <span style={{ fontSize: 14, color: GREY }}>{tr('ps_total')}</span>
              </div>
              <div style={{ fontSize: 14, color: GREY, marginTop: 2 }}>{tr('noites', orc.noites)}{orc.taxasTotal > 0 ? ` · ${tr('ps_taxas_incluidas')}` : ''}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ── scrollable row ── */
  const Row = ({ items, scrollable, needsCombo = false }) => {
    const ref = useRef(null);
    const shift = (d) => ref.current?.scrollBy({ left: d * 280, behavior: 'smooth' });
    if (!items.length) return null;
    return scrollable ? (
      <div style={{ position: 'relative' }}>
        <div ref={ref} className="pm-row-scroll" style={{ display: 'flex', gap: 24, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
          {items.map(({ apt, available, fits, orc }) => (
            <div key={apt.id} className="pm-row-item" style={{ minWidth: 260, flex: '0 0 260px' }}>
              <PCard apt={apt} available={available} fits={fits} orc={orc} needsCombo={needsCombo} />
            </div>
          ))}
        </div>
        {items.length > 4 && (
          <div className="pm-row-arrows" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => shift(-1)} style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', color: GREY }}><ChevronLeft size={16} /></button>
            <button onClick={() => shift(1)}  style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', color: GREY }}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>
    ) : (
      <div className="pm-results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: '40px 28px' }}>
        {items.map(({ apt, available, fits, orc }) => (
          <PCard key={apt.id} apt={apt} available={available} fits={fits} orc={orc} needsCombo={needsCombo} />
        ))}
      </div>
    );
  };

  /* ── bloco de um imóvel (à la Booking: banner do imóvel + as suas unidades) ── */
  const PropertyGroup = ({ g }) => {
    const { residencial: r, withInfo, needsCombo, combo } = g;
    const filtered = withInfo.filter(w => catFilter(w.apt));
    const list = valid ? filtered : filtered.map(w => ({ ...w, available: true }));
    if (!list.length) return null;
    // A contagem é a do que está à vista (com um filtro ativo dizia "17
    // apartamentos" com só 2 no ecrã) e já não repete a localização, que
    // está na etiqueta logo acima (a pedido do Caio). A casa conta à parte:
    // "17 apartamentos e 1 casa"; com datas, "12 de 18 disponíveis".
    const disponiveis = filtered.filter(w => w.available).length;
    const temCasa = filtered.some(w => ehCasa(w.apt));
    const countLabel = valid
      ? (temCasa ? tr('ps_n_de_m_disponiveis_curto', disponiveis, filtered.length) : tr('ps_n_de_m_disponiveis', disponiveis, filtered.length))
      : contagemUnidades(filtered.map(w => w.apt));

    return (
      <div ref={el => { groupRefs.current[r.id] = el; }} className="pm-pubsite-group" style={{ marginBottom: 72, scrollMarginTop: 140 }}>
        <div className="pm-pubsite-group-head" style={{ display: 'flex', alignItems: 'center', gap: 24, paddingBottom: 18, marginBottom: 6, flexWrap: 'wrap' }}>
          <img src={RESIDENCIAL_LOGOS[r.id] || r.heroImage} alt={r.nome} className="pm-pubsite-group-logo"
            style={{ width: RESIDENCIAL_LOGO_W[r.id] || 220, height: 'auto', maxWidth: '100%', flexShrink: 0, display: 'block' }}
            onError={e => { e.target.style.display = 'none'; }} />
          <div className="pm-pubsite-group-info" style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="pm-pubsite-group-region" style={{ fontSize: 14.5, color: GREY, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={15} strokeWidth={1.5} /> {dado(r.regiaoLabel)}</div>
          </div>
          <div className="pm-pubsite-group-count" style={{ fontSize: 12.5, color: GREY, letterSpacing: '.12em', textTransform: 'uppercase', flexShrink: 0 }}>{countLabel}</div>
        </div>
        {/* indicador de residencial: o segmento deste residencial aceso, os outros a 15% */}
        <Faixa height={3} lit={FAIXA_INDEX[r.id] ?? null} style={{ marginBottom: 28 }} />

        {valid && needsCombo && combo && (
          <div className="pm-pubsite-combo" style={{ border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 24px', marginBottom: 28, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <Users size={18} color={GREY} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 14, color: BLACK, lineHeight: 1.65 }}>
              <b>{tr('ps_combo_titulo', hosp, r.nome)}</b>
              {combo.enough
                ? <> {tr('ps_combo_sugestao')} <b>{combo.pick.map(a => `${a.nome} (${tr('pessoas', a.capacidade)})`).join(' + ')}</b> — {tr('ps_combo_capacidade', combo.cap)}{combo.pick.length > 2 ? ` ${tr('ps_combo_tres')}` : ''}</>
                : <> {tr('ps_combo_sem')}</>}
              {combo.enough && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {combo.pick.map(a => (
                    <button key={a.id} onClick={() => openDetail(a)}
                      style={{ background: BLACK, color: WHITE, border: 'none', borderRadius: 12, minHeight: 44, padding: '0 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                      {tr('ps_ver_apto', a.nome)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Padrão de exibição consistente entre os dois residenciais: o modo
            (carrossel horizontal em modo "navegar" vs. grade em modo "resultados
            de busca") depende só de haver uma pesquisa de datas ativa (`valid`),
            nunca da quantidade de apartamentos que sobra depois de um filtro —
            senão um residencial com poucas unidades filtradas vira grade enquanto
            o outro continua carrossel, a pedido do Caio, 2026-09-23. */}
        <Row items={list} scrollable={!valid} needsCombo={needsCombo} />
      </div>
    );
  };

  if (detail) {
    const scoped = buildScoped(data, detail.residencialId);
    const bookingScoped = booking ? buildScoped(data, booking.apt.residencialId) : null;
    return (
      <>
        <AptDetailPage apt={detail} data={scoped} ci={ci} co={co} hosp={hosp} valid={valid}
          setCi={setCi} setCo={setCo} setHosp={setHosp}
          liked={liked} setLiked={setLiked}
          onBack={() => window.history.back()} onBook={(apt, apt2, g1, g2) => setBooking({ apt, apt2, g1, g2 })} ultimaNoite={ultimaNoite} />
        {booking && <BookingModal sel={booking} ci={ci || ymd(td)} co={co || ymd(addDays(td, 2))} data={bookingScoped}
          onClose={() => setBooking(null)}
          onReservar={onReservar}
          onConfirmed={info => { setBooking(null); setDone(d => d || { info }); }} />}
        {done && <ConfirmationModal info={done.info} paymentStatus={done.paymentStatus} onClose={() => { setDone(null); setBooking(null); setDetail(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
      </>
    );
  }

  const r0 = data.residenciais[0] || {};

  // Filtros de categoria — os mesmos no desktop (faixa por baixo do topo, com
  // o nome) e no telemóvel (no cabeçalho, só o ícone). `icone(tamanho)`: no
  // telemóvel, sem o texto ao lado, os ícones vão maiores.
  const simbolo = (r) => (s) => (RESIDENCIAL_ICONS[r.id]
    ? <img src={RESIDENCIAL_ICONS[r.id]} alt="" style={{ width: s + 6, height: s + 6, objectFit: 'contain', display: 'block' }}
        onError={e => { e.target.style.display = 'none'; }} />
    : <Home size={s} />);
  const categorias = [
    { key: null, icone: (s) => <Home size={s} />, label: tr('cat2') },
    // um botão por residencial, com a sua logo — mostra só os
    // apartamentos daquele imóvel (ficam antes dos filtros de vista
    // e de lotação por serem o corte mais largo)
    ...(mostrarFiltroResidencial ? [
      ...residenciaisComApt.map(r => ({ key: `res:${r.id}`, icone: simbolo(r), label: nomeCurtoResidencial(r) })),
      // separa "que imóvel" de "que tipo de apartamento": são dois
      // cortes diferentes, e sem isto a marca do Caminho do Mar (ondas)
      // fica colada ao ícone de "Frente Mar" (também ondas)
      { sep: true },
    ] : []),
    ...(hasFrenteMar ? [{ key: 'frente_mar', icone: (s) => <Waves size={s} />, label: tr('cat1') }] : []),
    // no telemóvel (só ícone) a lotação leva o número ao lado do ícone
    { key: 'cap2', n: 2, icone: (s) => <Users size={s} />, label: tr('cat_cap2') },
    { key: 'cap4', n: 4, icone: (s) => <Users size={s} />, label: tr('cat_cap4') },
    { key: 'cap6', n: 6, icone: (s) => <Users size={s} />, label: tr('cat_cap6') },
    { key: 'cap8', n: 8, icone: (s) => <Users size={s} />, label: tr('cat_cap8') },
  ].map(c => (c.sep ? c : { ...c, nomeCompleto: c.n ? tr('ps_ate_pessoas', c.n) : c.label }));

  // "Escolha as datas": abre o calendário da busca. No desktop ele abre no
  // topo fixo; no telemóvel a busca fica acima da lista, então sobe até ela.
  const abrirCalendario = () => {
    setGuestOpen(false);
    setCalOpen(true);
    const el = searchInlineRef.current;
    if (el && getComputedStyle(el).display !== 'none') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // No telemóvel os filtros ficam no topo e a lista bem mais abaixo (depois
  // da busca): ao escolher um, a página desce até aos apartamentos para se
  // ver logo o efeito — senão o toque parecia não fazer nada.
  const escolherCategoriaTopo = (key) => {
    setActiveCategory(key);
    setTimeout(() => {
      const el = resultsRef.current;
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.5) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <div style={{ background: WHITE, minHeight: '100vh', fontFamily: F.sans, color: BLACK }}>

      {/* ══ HEADER ══ */}
      <header ref={headerRef} className="pm-pubsite-header" style={{ borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 50, background: WHITE }}>
        <div className="pm-pubsite-header-row" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', height: 72, display: 'flex', alignItems: 'center', gap: 32 }}>

          {/* assinatura horizontal do Grupo PinheiraMar (2b, cabeçalho do site) — só
              no desktop: no telemóvel o cabeçalho leva os filtros (e o idioma),
              sem logo, a pedido do Caio, 2026-09 (ver App.jsx); a marca
              continua no rodapé */}
          <a href="/" className="pm-pubsite-brand" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', height: '100%' }}>
            <span style={{ display: 'block' }}><GroupLogo variant="horizontal" size={24} /></span>
          </a>

          {/* centred search (desktop) */}
          <div className="pm-pubsite-search-desktop" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
            {/* barra em pílula, com o PROCURAR arredondado por dentro (caixas e
                botões arredondados, a pedido do Caio). Sem overflow:hidden: o
                calendário e o seletor de pessoas abrem por baixo dela. */}
            <div style={{ display: 'flex', alignItems: 'stretch', height: 50, padding: 4, boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: 999, background: WHITE, boxShadow: '0 2px 10px rgba(27,28,70,.06)', maxWidth: 680, width: '100%', position: 'relative' }}>
              <Seg label={tr('search_checkin')}>
                <div style={{ ...segInput, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={() => { setGuestOpen(false); setCalOpen(o => !o); }}>
                  <span style={{ color: ci ? BLACK : '#6F6B64' }}>{ci ? fmtCurta(ci) : tr('ps_selecionar_entrada')}</span>
                </div>
              </Seg>
              <Seg label={tr('search_checkout')}>
                <div style={{ ...segInput, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={() => { setGuestOpen(false); setCalOpen(o => !o); }}>
                  <span style={{ color: co ? BLACK : '#6F6B64' }}>{co ? fmtCurta(co) : tr('ps_selecionar_saida')}</span>
                </div>
              </Seg>
              {calOpen && (
                <>
                  <div onClick={() => setCalOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 100, width: 460, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
                    <AvailabilityCalendar ci={ci} co={co} ate={ultimaNoite}
                      onChange={(newCi, newCo) => {
                        setCi(newCi);
                        if (newCo && nights(newCi, newCo) < 1) setCo(''); else setCo(newCo);
                        if (newCi && newCo) setCalOpen(false);
                      }} />
                  </div>
                </>
              )}
              <Seg label={tr('search_who')} last>
                <div style={{ ...segInput, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={() => setGuestOpen(o => !o)}>
                  <span style={{ color: hosp ? BLACK : '#6F6B64' }}>{hosp ? tr('search_guests_label', hosp) : tr('search_add_guests')}</span>
                </div>
                {guestOpen && (
                  <div style={{ position: 'absolute', top: '100%', marginTop: 8, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, zIndex: 100, minWidth: 240, boxShadow: '0 8px 32px rgba(0,0,0,.10)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{tr('search_guests')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <button aria-label={tr('m_menos_pessoa')} onClick={() => setHosp(h => Math.max(0,h-1))} style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 16 }}>−</button>
                        <span style={{ fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{hosp || '—'}</span>
                        <button aria-label={tr('m_mais_pessoa')} onClick={() => setHosp(h => h+1)} style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 16 }}>+</button>
                      </div>
                    </div>
                    <button onClick={() => setGuestOpen(false)} style={{ width: '100%', padding: '11px 0', background: BLACK, color: WHITE, border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, letterSpacing: '.05em' }}>{tr('search_confirm')}</button>
                  </div>
                )}
              </Seg>
              <button onClick={() => { setGuestOpen(false); setCalOpen(false); resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                style={{ padding: '0 24px', background: BLACK, color: WHITE, border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {tr('search_btn').toUpperCase()}
              </button>
            </div>

            {/* botão "Limpar consulta" ao lado do PROCURAR — mais visível do
                que o X pequeno que ficava espremido dentro da barra, a
                pedido do Caio, 2026-09. */}
            {!!(ci || co || hosp) && (
              <button onClick={() => { setCi(''); setCo(''); setHosp(0); setGuestOpen(false); setCalOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 20, cursor: 'pointer', color: GREY, fontSize: 12.5, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
                <X size={13} /> {tr('ps_limpar_consulta')}
              </button>
            )}
          </div>

          {/* telemóvel: os filtros sobem para o cabeçalho, só com ícones (o nome
              vai no aria-label/title) e com rolagem para o lado quando não
              cabem — a pedido do Caio, 2026-09. No desktop ficam na faixa de
              baixo, com o nome. Exceção: o filtro por residencial leva o nome
              visível também no telemóvel — o ícone sozinho ("ondas") é ambíguo
              com o de Frente Mar, e o title/aria-label não aparece em toque
              (público 40+, 2026-09-26). */}
          <nav className="pm-pubsite-hcats" aria-label={tr('ps_filtros')}
            style={{ display: 'none', flex: 1, minWidth: 0, alignItems: 'center', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 0' }}>
            {categorias.map((cat, i) => {
              if (cat.sep) return <div key={`sep${i}`} aria-hidden style={{ alignSelf: 'center', width: 1, height: 24, background: BORDER, flexShrink: 0 }} />;
              const on = activeCategory === cat.key;
              const comTexto = catIsResidencial(cat.key);
              return (
                <button key={String(cat.key)} type="button" onClick={() => escolherCategoriaTopo(on ? null : cat.key)}
                  aria-label={cat.nomeCompleto} title={cat.nomeCompleto} aria-pressed={on}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, minWidth: 48, padding: cat.n ? '0 14px 0 12px' : (comTexto ? '0 14px' : '0 12px'), flexShrink: 0, borderRadius: 999, border: `1px solid ${on ? 'rgba(27,28,70,.45)' : BORDER}`, background: on ? 'rgba(27,28,70,.08)' : WHITE, color: on ? BLACK : GREY, cursor: 'pointer', fontFamily: F.sans, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {cat.icone(20)}{cat.n ? <span aria-hidden>{cat.n}</span> : null}{comTexto ? <span aria-hidden>{cat.label}</span> : null}
                </button>
              );
            })}
          </nav>

          {/* idioma — à direita da busca no desktop e dos filtros no telemóvel */}
          {idiomasAtivos.length > 1 && (
            <div className="pm-pubsite-lang" style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              {idiomasAtivos.map(id => (
                <button key={id.codigo} onClick={() => setLang(id.codigo)} title={id.nativo} aria-label={id.nativo} aria-pressed={lang === id.codigo}
                  style={{ width: 40, height: 40, borderRadius: '50%', border: lang === id.codigo ? `1px solid ${BLACK}` : `1px solid transparent`, background: 'transparent', cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center' }}>
                  {id.bandeira}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ══ BUSCA — sempre visível no telemóvel, sem esconder atrás de um botão. Público-alvo 50+:
             mais direto ver os campos logo de cara do que ter de descobrir onde tocar. ══ */}
      <div ref={searchInlineRef} className="pm-pubsite-search-inline" style={{ display: 'none', padding: '18px 16px 22px', borderBottom: `1px solid ${BORDER}`, background: WHITE }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{tr('m_search_title')}</div>
          {!!(ci || co || hosp) && (
            <button onClick={() => { setCi(''); setCo(''); setHosp(0); setCalOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 40, fontSize: 14, fontWeight: 700, color: '#333', background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 999, cursor: 'pointer', padding: '0 14px' }}>
              <X size={15} /> {tr('m_clear')}
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <DateCard label={tr('m_arrival')} value={ci} compact onClick={() => setCalOpen(o => !o)} />
            <DateCard label={tr('m_departure')} value={co} compact onClick={() => setCalOpen(o => !o)} />
          </div>
          {calOpen && (
            <AvailabilityCalendar ci={ci} co={co} ate={ultimaNoite}
              onChange={(newCi, newCo) => {
                setCi(newCi);
                if (newCo && nights(newCi, newCo) < 1) setCo(''); else setCo(newCo);
                if (newCi && newCo) setCalOpen(false);
              }} />
          )}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 8 }}>{tr('m_people')}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64, padding: '8px 12px 8px 16px', border: `1.5px solid ${hosp ? BLACK : '#C9C6BF'}`, borderRadius: 14 }}>
              <span style={{ fontSize: 16, fontWeight: hosp ? 700 : 400, color: hosp ? BLACK : '#555' }}>{hosp ? tr('m_people_n', hosp) : tr('m_people_none')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button aria-label={tr('m_menos_pessoa')} disabled={!hosp} onClick={() => setHosp(h => Math.max(0, h - 1))} style={{ width: 46, height: 46, borderRadius: '50%', border: `1.5px solid ${hosp ? '#999' : BORDER}`, background: WHITE, color: hosp ? BLACK : '#BBB', cursor: hosp ? 'pointer' : 'default', fontSize: 22, display: 'grid', placeItems: 'center' }}>−</button>
                <span style={{ fontWeight: 800, fontSize: 18, minWidth: 20, textAlign: 'center', visibility: hosp ? 'visible' : 'hidden' }}>{hosp || 0}</span>
                <button aria-label={tr('m_mais_pessoa')} onClick={() => setHosp(h => h + 1)} style={{ width: 46, height: 46, borderRadius: '50%', border: '1.5px solid #999', background: WHITE, color: BLACK, cursor: 'pointer', fontSize: 22, display: 'grid', placeItems: 'center' }}>+</button>
              </div>
            </div>
          </div>
          <button onClick={() => { setCalOpen(false); resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            style={{ width: '100%', minHeight: 56, background: BLACK, color: WHITE, border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>
            {tr('m_see_available')}
          </button>
        </div>
      </div>

      {/* ══ HERO — escondido no telemóvel (ver App.jsx), onde ocupava a tela
             toda antes do hóspede ver a busca/resultados; fica só no desktop ══ */}
      <section className="pm-pubsite-hero" style={{ position: 'relative', height: 'clamp(480px,68vh,720px)', overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
        {/* foto do topo sem object-fit: cover — a pedido do Caio (10/09 e de novo 26/09): a foto aparece inteira na moldura, sem o "zoom" que a cortava */}
        <img
          src={fotoTopo(r0.heroImage)}
          alt=""
          fetchpriority="high"
          decoding="async"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.10) 0%, rgba(0,0,0,.20) 40%, rgba(0,0,0,.72) 100%)' }} />
        <div className="pm-pubsite-hero-inner" style={{ position: 'relative', maxWidth: 1280, width: '100%', margin: '0 auto', padding: '0 32px 56px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)', marginBottom: 16 }}>
            {tr('ps_hero_local')}
          </div>
          <h1 style={{ fontSize: 'clamp(34px,4.6vw,62px)', fontWeight: 200, lineHeight: 1.08, margin: '0 0 16px', letterSpacing: '-.005em', color: '#fff', maxWidth: 760 }}>
            {tr('ps_hero_titulo_1')}<br />{tr('ps_hero_titulo_2')}
          </h1>
          <Faixa height={4} width={220} tone="negativo" style={{ marginBottom: 22 }} />
          <p style={{ fontSize: 16.5, color: 'rgba(255,255,255,.9)', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 520 }}>
            {tr('ps_hero_texto', data.residenciais.length)}
          </p>
          <button onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            style={{ padding: '14px 32px', background: '#fff', color: BLACK, border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {tr('ps_ver_apartamentos')}
          </button>
        </div>
      </section>

      {/* ══ CATEGORY FILTER STRIP ══ */}
      <div className="pm-pubsite-catbar" style={{ borderBottom: `1px solid ${BORDER}`, background: WHITE, position: 'sticky', top: 64, zIndex: 40 }}>
        <div className="pm-pubsite-catstrip" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {categorias.map((cat, i) => {
            if (cat.sep) return <div key={`sep${i}`} aria-hidden style={{ alignSelf: 'center', width: 1, height: 26, background: BORDER, margin: '0 10px', flexShrink: 0 }} />;
            const on = activeCategory === cat.key;
            return (
              <button key={String(cat.key)} className="pm-cat-btn" data-active={on ? 'true' : 'false'} onClick={() => setActiveCategory(on ? null : cat.key)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0, fontSize: 12, fontWeight: 600, color: on ? BLACK : GREY, borderBottom: on ? `2px solid ${BLACK}` : '2px solid transparent', transition: 'all .15s' }}>
                <span style={{ color: on ? BLACK : GREY }}>{cat.icone(16)}</span>
                {cat.label}
              </button>
            );
          })}
          {activeCategory && (
            <button onClick={() => setActiveCategory(null)} style={{ marginLeft: 'auto', alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 12px', border: `1px solid ${BORDER}`, borderRadius: 20, background: WHITE, cursor: 'pointer', color: GREY, flexShrink: 0 }}>
              <X size={14} aria-hidden="true" /> {tr('ps_limpar_filtro')}
            </button>
          )}
        </div>
      </div>

      {/* ══ RESULTADOS — um bloco por imóvel, como um motor de reservas de hotel ══ */}
      <main ref={resultsRef} className="pm-pubsite-main" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 32px 80px', scrollMarginTop: 80 }}>
        {/* sem datas: uma frase só, em vez de um preço "a partir de" em cada
            cartão — e um toque nela abre logo o calendário */}
        {!valid && (
          <div style={{ marginBottom: 40 }}>
            <button type="button" onClick={abrirCalendario}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10, maxWidth: '100%', minHeight: 48, padding: '12px 18px', background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 14, cursor: 'pointer', fontFamily: F.sans, color: BLACK, textAlign: 'left' }}>
              <CalendarDays size={19} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{tr('ps_datas_para_preco')}</span>
              <ChevronRight size={17} style={{ flexShrink: 0 }} />
            </button>
          </div>
        )}
        {valid && (
          <div style={{ marginBottom: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {fmtCurta(ci)} — {fmtCurta(co)} · {tr('noites', nights(ci, co))}{hosp ? ` · ${tr('pessoas', hosp)}` : ''}
                <button onClick={() => { setCi(''); setCo(''); setHosp(0); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: GREY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 20, padding: '5px 12px', cursor: 'pointer' }}>
                  <X size={12} /> {tr('ps_limpar_consulta')}
                </button>
              </div>
              <div style={{ fontSize: 14, color: GREY, marginTop: 4 }}>{subtituloDisponibilidade}</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: GREY, flexShrink: 0 }}>
              {tr('ps_ordenar')}
              <select value={sortMode} onChange={e => setSortMode(e.target.value)}
                style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: '7px 10px', fontSize: 13, fontFamily: F.sans, color: BLACK, background: WHITE, cursor: 'pointer' }}>
                <option value="default">{tr('ps_ordem_recomendados')}</option>
                <option value="price_asc">{tr('ps_ordem_menor')}</option>
                <option value="price_desc">{tr('ps_ordem_maior')}</option>
              </select>
            </label>
          </div>
        )}
        {groups.map(g => <PropertyGroup key={g.residencial.id} g={g} />)}
      </main>

      {/* ══ DESTINATION (partilhado — mesma zona/praia para os dois imóveis) ══ */}
      <DestinoSection residenciais={data.residenciais} />

      {/* ══ FOOTER — assinatura do grupo, residenciais e faixa como remate ══ */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, background: LIGHT }}>
        <div className="pm-pubsite-footer-grid" style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 40 }}>
          <div>
            <GroupLogo variant="principal" size={26} />
            <div style={{ fontSize: 15, color: GREY, marginTop: 18, lineHeight: 1.6 }}>{tr('ps_essencia')}</div>
          </div>
          {data.residenciais.map(r => (
            <div key={r.id}>
              <div style={{ fontSize: 15, fontWeight: 500, color: BLACK, marginBottom: 10 }}>{r.nome}</div>
              <div style={{ fontSize: 14, color: GREY, lineHeight: 1.9 }}>
                <div>{r.endereco}</div>
                <div>{r.cidade}</div>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, color: '#1E8E4E', fontWeight: 600, textDecoration: 'none' }}>
                  <MessageCircle size={15} strokeWidth={1.5} /> WhatsApp
                </a>
              </div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 13, fontWeight: 400, letterSpacing: '.2em', textTransform: 'uppercase', color: GREY, marginBottom: 14 }}>{tr('ps_horarios')}</div>
            <div style={{ fontSize: 15, color: GREY, lineHeight: 1.9 }}>
              {data.residenciais.map(r => (
                <div key={r.id} style={{ marginBottom: data.residenciais.length > 1 ? 6 : 0 }}>
                  {data.residenciais.length > 1 && <div style={{ color: BLACK }}>{nomeCurtoResidencial(r)}</div>}
                  <div>{tr('ps_checkin_a_partir', r.checkInHora || '13:00')}</div>
                  <div>{tr('ps_checkout_ate', r.checkOutHora || '10:00')}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 400, letterSpacing: '.2em', textTransform: 'uppercase', color: GREY, marginBottom: 14 }}>{tr('ps_como_chegar')}</div>
            <div style={{ fontSize: 15, color: GREY, lineHeight: 1.9 }}>
              <div>{tr('ps_km_floripa')}</div>
              <div>{tr('ps_km_aeroporto')}</div>
              <div>BR-101 → Palhoça → Pinheira</div>
            </div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 32px', textAlign: 'center', fontSize: 13, color: GREY, letterSpacing: '.12em', textTransform: 'uppercase' }}>
          © {new Date().getFullYear()} Grupo PinheiraMar
        </div>
        <Faixa height={6} />
      </footer>
      {done && <ConfirmationModal info={done.info} paymentStatus={done.paymentStatus} onClose={() => setDone(null)} />}
      {calApt && (
        <Modal title={tr('ps_datas_livres', calApt.nome)}
          subtitle={tr('ps_datas_livres_sub')} rotuloFechar={tr('ap_fechar')}
          onClose={() => setCalApt(null)}>
          <AvailabilityCalendar apt={calApt} reservas={data.reservas} ci={calCi} co={calCo} initialMonth={ci} ate={ultimaNoite}
            onChange={(nci, nco) => {
              setCalCi(nci); setCalCo(nco);
              if (nci && nco) { setCi(nci); setCo(nco); setCalApt(null); }
            }} />
        </Modal>
      )}
    </div>
  );
}
