import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Waves, MapPin, MessageCircle, CalendarDays, Heart, ChevronLeft, ChevronRight,
  Home, Users, X, Share2 } from 'lucide-react';
import { F, fotoTopo, heroVersoes, LOGO_RESIDENCIAL, SIMBOLO_RESIDENCIAL, C, R } from '../../lib/constants';
import { whatsappUrl, msgGeral, msgBrecha, msgCombinacao } from '../../lib/whatsapp';
import { money, ymd, today, parseYMD, addDays, isAvailable, nights, pad } from '../../lib/helpers';
import { orcamentoApartamento, regraNoites } from '../../lib/precos';
import { ultimaNoiteReservavel, hojeISO } from '../../lib/reservas';
import { lerUltimaReserva } from '../../lib/dadosPublico';
import { lerPesquisaDaUrl, montarLinkPesquisa, semParametrosPesquisa, compartilharLink } from '../../lib/linkPesquisa';
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
  pinheiramar: [{ t: 'Pinheira', c: C.ink }, { t: 'Mar', c: '#D1301B' }],
  novoimovel: [{ t: 'Caminho do ', c: C.ink }, { t: 'Mar', c: C.brisa }],
};

// Só o símbolo da marca de cada residencial — a logo completa não cabe num
// botão da barra de filtros, que trabalha com ícones de ~20px.
const RESIDENCIAL_ICONS = SIMBOLO_RESIDENCIAL;

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
// Botão fixo de WhatsApp (canto inferior direito, em todas as telas do site
// público) — só o ícone, a pedido do Caio, 2026-11-22. `sobe`: na página do
// apartamento, no telemóvel, fica acima da barra fixa de reserva (ver App.jsx).
function BotaoWhatsApp({ rotulo, sobe }) {
  return (
    <a href={whatsappUrl(msgGeral())} target="_blank" rel="noopener noreferrer" aria-label={rotulo} title={rotulo}
      className={`pm-wa-flutuante${sobe ? ' pm-wa-sobe' : ''}`}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        <path d="M9.5 9.2c.2 1.6 2.6 4.1 4.3 4.5l1.2-1.1 1.6.9c-.3 1.1-1.2 1.6-2.2 1.5-2.6-.4-5.5-3.3-5.9-5.9-.1-1 .4-1.9 1.5-2.2l.9 1.6Z" fill="currentColor" stroke="none" />
      </svg>
    </a>
  );
}

export function PublicSite(props) {
  const idiomasAtivos = (props.data.residenciais[0]?.idiomas || []).filter(i => i.ativo);
  const [lang, setLang] = useState(() => {
    // link compartilhado com &lang=es|en abre já nesse idioma
    const daUrl = lerPesquisaDaUrl(window.location.search, { idiomas: idiomasAtivos.map(i => i.codigo) }).lang;
    if (daUrl) return daUrl;
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
  // Link de pesquisa compartilhado (?entrada=&saida=&pessoas= — ver
  // lib/linkPesquisa.js): o site abre já com a consulta preenchida.
  const [pesquisaDoLink] = useState(() => lerPesquisaDaUrl(window.location.search, { hoje: hojeBR }));
  const [ci, setCi] = useState(() => pesquisaDoLink.ci || '');
  const [co, setCo] = useState(() => pesquisaDoLink.co || '');
  // "Datas próximas": quantas noites procurar (o hóspede pode encurtar a
  // estadia para caber numa brecha entre reservas). Volta ao da pesquisa
  // sempre que as datas mudam.
  const [noitesAlt, setNoitesAlt] = useState(0);
  // Datas-base: as que o HÓSPEDE escolheu na pesquisa. Clicar numa opção
  // proposta (datas próximas, brecha) muda as datas em vista mas NÃO a base —
  // as opções continuam calculadas à volta do pedido original, para não
  // "andar" a cada clique e o hóspede se perder longe das datas dele.
  const [base, setBase] = useState(null);
  const vindoDeOpcao = useRef(false);
  useEffect(() => {
    if (vindoDeOpcao.current) { vindoDeOpcao.current = false; return; }
    setBase(ci && co && ci < co ? { ci, co } : null);
    setNoitesAlt(0);
  }, [ci, co]);
  const [hosp, setHosp] = useState(() => pesquisaDoLink.hosp || 0);
  const [pesquisaCopiada, setPesquisaCopiada] = useState(false);
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
  const [guestOpen, setGuestOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  // apartamento cujo calendário de disponibilidade está aberto num popover —
  // mostrado quando o cartão está "indisponível" para as datas pesquisadas,
  // para o visitante ver logo ali quais os dias livres desse apartamento.
  const [calApt, setCalApt] = useState(null);
  const [calCi, setCalCi] = useState('');
  const [calCo, setCalCo] = useState('');
  const resultsRef = useRef(null);
  const listaRef = useRef(null); // início da lista de apartamentos (depois da caixa de opções)
  const searchInlineRef = useRef(null);
  const headerRef = useRef(null);
  const groupRefs = useRef({});

  const valid = ci && co && nights(ci, co) >= 1;

  // Depois de ler o link: tira do endereço os parâmetros da pesquisa (o
  // ?apto=, se houver, fica) e, sem apartamento, desliza até os resultados.
  useEffect(() => {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch { return; }
    if (!['entrada', 'saida', 'pessoas', 'lang'].some(k => params.has(k))) return;
    const limpo = semParametrosPesquisa(window.location.href);
    if (limpo) { try { window.history.replaceState(window.history.state, '', limpo); } catch { /* ignora */ } }
    if (pesquisaDoLink.ci && !params.get('apto')) {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Compartilhar pesquisa": link com as datas e as pessoas desta consulta
  const compartilharPesquisa = async () => {
    const url = montarLinkPesquisa(window.location.origin + window.location.pathname, { ci, co, hosp: hosp || undefined, lang });
    const texto = tr('ps_texto_pesquisa', fmtCurta(ci), fmtCurta(co), hosp ? tr('pessoas', hosp) : '');
    const r = await compartilharLink({ url, titulo: 'Grupo PinheiraMar', texto });
    if (r === 'copiado') { setPesquisaCopiada(true); setTimeout(() => setPesquisaCopiada(false), 2500); }
  };

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
      return (Number(y.available) - Number(x.available)) ||
        (Number(y.fits) - Number(x.fits)) ||
        // sem filtro de categoria, os apartamentos Frente Mar aparecem primeiro; depois o mais barato
        ((!activeCategory || catIsResidencial(activeCategory)) ? (Number(y.apt.vista === 'Frente Mar') - Number(x.apt.vista === 'Frente Mar')) : 0) ||
        (x.apt.preco - y.apt.preco);
    });
    const availableApts = withInfo.filter(w => w.available).map(w => w.apt);
    const needsCombo = valid && hosp > 0 && hosp > maxCap;
    const combo = needsCombo ? findCombo(availableApts, hosp) : null;
    return { residencial: r, active, withInfo, maxCap, availableApts, needsCombo, combo };
  }), [data, ci, co, hosp, valid, activeCategory]);

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

  // Datas próximas (N noites, até 14 dias antes/depois da entrada pedida) em
  // que um apartamento está livre — para o hóspede ajustar a viagem. N é o
  // nº de noites escolhido na caixa "Datas próximas" (por omissão, o da pesquisa).
  const bci = base?.ci || ci, bco = base?.co || co;
  const naBase = ci === bci && co === bco;
  const janelaDesloc = (d) => {
    const a = ymd(addDays(parseYMD(bci), d)), b = ymd(addDays(parseYMD(bci), d + noitesBusca));
    if (a < hojeBR || (ultimaNoite && ymd(addDays(parseYMD(b), -1)) > ultimaNoite)) return null;
    return [a, b];
  };
  const OFFSETS = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8, 9, -9, 10, -10, 11, -11, 12, -12, 13, -13, 14, -14];
  const livresProximas = (aptId, max = 2) => {
    if (!valid) return [];
    const res = [];
    for (const d of OFFSETS) {
      const j = janelaDesloc(d);
      if (j && isAvailable(data.reservas, aptId, j[0], j[1])) { res.push(j); if (res.length >= max) break; }
    }
    return res.sort((x, y) => (x[0] < y[0] ? -1 : 1));
  };
  // Noites livres DENTRO do período pedido, em blocos seguidos (quando o
  // hóspede encurta a estadia na caixa "Datas próximas"): ex. 20–23 e 25–26.
  const blocosNoPedido = (aptId) => {
    if (!valid) return [];
    const blocos = []; let ini = null;
    const fim = parseYMD(bco);
    for (let d = parseYMD(bci); d <= fim; d = addDays(d, 1)) {
      const livre = d < fim && isAvailable(data.reservas, aptId, ymd(d), ymd(addDays(d, 1)));
      if (livre && ini === null) ini = d;
      if (!livre && ini !== null) { blocos.push([ymd(ini), ymd(d)]); ini = null; }
    }
    return blocos;
  };
  const fmtJanela = ([a, b]) => `${fmtCurta(a)} – ${fmtCurta(b)}`;
  const mesCurto = (s) => parseYMD(s).toLocaleDateString(locale, { month: 'short' });
  const fmtIntervalo = ([a, b]) => (a.slice(0, 7) === b.slice(0, 7)
    ? `${Number(a.slice(8))}–${Number(b.slice(8))} ${mesCurto(a)}`
    : `${Number(a.slice(8))} ${mesCurto(a)} – ${Number(b.slice(8))} ${mesCurto(b)}`);
  const irPara = (a, b) => {
    if (a === ci && b === co) return;
    vindoDeOpcao.current = true; setCi(a); setCo(b);
    // numa opção proposta a caixa fica em cima: desliza logo para os
    // apartamentos livres nessas datas; ao voltar às datas pedidas, para o topo
    if (a === bci && b === bco) { setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); return; }
    // desconta o que fica fixo no topo (cabeçalho e barra de filtros), que
    // muda entre computador e telemóvel
    setTimeout(() => {
      const el = listaRef.current; if (!el) return;
      const fixos = [...document.querySelectorAll('.pm-pubsite-header, .pm-pubsite-catbar')]
        .filter(x => getComputedStyle(x).position === 'sticky' || getComputedStyle(x).position === 'fixed')
        .reduce((m, x) => Math.max(m, x.getBoundingClientRect().bottom), 0);
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - fixos - 12, behavior: 'smooth' });
    }, 120);
  };
  const escolherJanela = ([a, b]) => irPara(a, b);
  const voltarBase = () => irPara(bci, bco);

  // Topo da lista: o que cabe no filtro E está livre nas datas; o resto
  // (fora do filtro ou ocupado) vai para a secção de baixo.
  const noTopo = (w) => catFilter(w.apt) && (!valid || w.available);
  const nTopo = (g) => g.withInfo.filter(noTopo).length;
  const gruposOrdenados = valid ? [...groups].sort((a, b) => nTopo(b) - nTopo(a)) : groups;
  // Datas próximas com apartamentos livres: janelas de N noites (N = o da
  // pesquisa ou menos, se o hóspede encurtar) que começam de 7 dias antes a
  // 7 dias depois do pedido. Cada janela diz quantos apartamentos ficam
  // livres e se cumpre o mínimo de noites da temporada; se não cumpre, a
  // opção é pedir pelo WhatsApp em vez de reservar.
  const noitesPedido = valid ? nights(bci, bco) : 0;
  // sem teto ligado à pesquisa: o hóspede pode subir de novo depois de
  // escolher uma estadia mais curta (até 30 noites)
  const MAX_NOITES_ALT = 30;
  const noitesBusca = Math.max(1, Math.min(noitesAlt || noitesPedido || 1, MAX_NOITES_ALT));
  const alternativasGerais = (() => {
    if (!valid) return [];
    const cabe = (a) => a.ativo && catFilter(a) && (!hosp || a.capacidade >= hosp);
    const aptos = data.apartamentos.filter(cabe);
    // só interessa o que dá MAIS opções do que as datas pedidas
    const agora = aptos.filter(x => isAvailable(data.reservas, x.id, bci, bco)).length;
    const opc = [];
    const ini0 = addDays(parseYMD(bci), -7);
    const ultimoIni = addDays(parseYMD(bci), Math.max(7, noitesPedido + 7 - noitesBusca));
    for (let d = ini0; d <= ultimoIni; d = addDays(d, 1)) {
      const a = ymd(d), b = ymd(addDays(d, noitesBusca));
      if (a < hojeBR || (ultimaNoite && ymd(addDays(d, noitesBusca - 1)) > ultimaNoite)) continue;
      if (a === bci && b === bco) continue;
      const livres = aptos.filter(x => isAvailable(data.reservas, x.id, a, b));
      // com o mesmo nº de noites ou menos, só o que dá MAIS opções do que as
      // datas pedidas; com mais noites, qualquer janela com vaga
      if (noitesBusca <= noitesPedido ? livres.length <= agora : !livres.length) continue;
      const min = regraNoites(data.seasons, a).min;
      // distância ao período pedido: 0 se a janela cabe dentro dele
      const antes = (parseYMD(bci) - d) / 86400000, depois = (addDays(d, noitesBusca) - parseYMD(bco)) / 86400000;
      opc.push({ j: [a, b], n: livres.length, livres, min, abaixo: noitesBusca < min, dist: Math.max(0, antes, depois) });
    }
    // as que dão para reservar antes, depois as que pedem WhatsApp; mais
    // apartamentos livres e mais perto do pedido primeiro
    // mais perto do período pedido primeiro (as brechas dentro dele antes
    // de tudo), depois as que dão para reservar e as com mais apartamentos
    return opc.sort((x, y) => (x.dist - y.dist) || (Number(x.abaixo) - Number(y.abaixo)) || (y.n - x.n)).slice(0, 4)
      .sort((x, y) => (x.j[0] < y.j[0] ? -1 : 1));
  })();

  // Combinação: quando nenhum apartamento (que caiba no grupo) está livre o
  // período todo, procura DOIS que juntos o cubram — um da entrada até um
  // dia X e outro de X até à saída (troca de apartamento a meio). Prefere
  // partes que cumprem o mínimo de noites, o mesmo residencial e a troca
  // mais equilibrada. Pede-se pelo WhatsApp (são duas reservas).
  const combinacoes = (() => {
    if (!valid || noitesPedido < 2) return [];
    const cabe = (a) => a.ativo && catFilter(a) && (!hosp || a.capacidade >= hosp);
    const aptos = data.apartamentos.filter(cabe);
    if (aptos.some(a => isAvailable(data.reservas, a.id, bci, bco))) return [];
    const res = [];
    for (let k = 1; k < noitesPedido; k++) {
      const m = ymd(addDays(parseYMD(bci), k));
      const primeiros = aptos.filter(a => isAvailable(data.reservas, a.id, bci, m));
      const segundos = aptos.filter(a => isAvailable(data.reservas, a.id, m, bco));
      for (const a of primeiros) for (const b of segundos) {
        if (a.id === b.id) continue;
        const okMin = k >= regraNoites(data.seasons, bci).min && (noitesPedido - k) >= regraNoites(data.seasons, m).min;
        res.push({ partes: [{ apt: a, ci: bci, co: m }, { apt: b, ci: m, co: bco }], okMin, mesmo: a.residencialId === b.residencialId, equilibrio: Math.abs(noitesPedido - 2 * k) });
      }
    }
    res.sort((x, y) => (Number(y.okMin) - Number(x.okMin)) || (Number(y.mesmo) - Number(x.mesmo)) || (x.equilibrio - y.equilibrio));
    // no máximo 2 sugestões, com dias de troca diferentes
    const vistos = new Set(); const out = [];
    for (const c of res) { const chave = c.partes[0].co; if (vistos.has(chave)) continue; vistos.add(chave); out.push(c); if (out.length >= 2) break; }
    return out;
  })();

  // Brechas mais curtas: noites seguidas livres, por apartamento, de 7 dias
  // antes da entrada a 7 dias depois da saída pedidas — mesmo com menos
  // noites do que o pedido, porque podem combinar-se. As que tocam as datas
  // do hóspede vêm primeiro; abaixo do mínimo de noites pede-se pelo WhatsApp.
  const brechas = (() => {
    if (!valid || noitesPedido < 2) return [];
    const cabe = (a) => a.ativo && catFilter(a) && (!hosp || a.capacidade >= hosp);
    let ini = addDays(parseYMD(bci), -7); const fim = addDays(parseYMD(bco), 7);
    if (ymd(ini) < hojeBR) ini = parseYMD(hojeBR);
    const out = {}; // agrupadas por datas: várias com a mesma brecha = uma opção
    for (const apt of data.apartamentos.filter(cabe)) {
      let run = null;
      for (let d = ini; d <= fim; d = addDays(d, 1)) {
        const livre = d < fim && (!ultimaNoite || ymd(d) <= ultimaNoite) && isAvailable(data.reservas, apt.id, ymd(d), ymd(addDays(d, 1)));
        if (livre && !run) run = d;
        if (!livre && run) {
          const a = ymd(run), b = ymd(d), n = nights(a, b);
          if (n < noitesPedido) {
            const dentro = Math.max(0, (Math.min(d, parseYMD(bco)) - Math.max(run, parseYMD(bci))) / 86400000);
            const dist = dentro ? 0 : Math.min(Math.abs(run - parseYMD(bco)), Math.abs(d - parseYMD(bci))) / 86400000;
            const min = regraNoites(data.seasons, a).min;
            const k = a + '|' + b;
            if (!out[k]) out[k] = { aptos: [], j: [a, b], n, dentro, dist, min, abaixo: n < min };
            out[k].aptos.push(apt);
          }
          run = null;
        }
      }
    }
    return Object.values(out).sort((x, y) => (y.dentro - x.dentro) || (x.dist - y.dist) || (y.n - x.n) || (y.aptos.length - x.aptos.length)).slice(0, 6)
      .sort((x, y) => (x.j[0] < y.j[0] ? -1 : x.j[0] > y.j[0] ? 1 : 0));
  })();

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

  // Busca grande na faixa principal (só no computador). Enquanto ela está à
  // vista, a busca compacta do cabeçalho fica escondida (para não haver duas
  // iguais); quando a faixa sai do ecrã, a do cabeçalho volta. No telemóvel a
  // faixa não aparece, por isso isto fica sempre falso lá.
  const heroBuscaRef = useRef(null);
  const [buscaNoHero, setBuscaNoHero] = useState(false);
  useEffect(() => {
    const el = heroBuscaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setBuscaNoHero(false); return undefined; }
    const io = new IntersectionObserver(([e]) => setBuscaNoHero(e.isIntersecting), { rootMargin: '-73px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [detail]);
  // ao trocar de busca (faixa <-> cabeçalho) fecha o calendário e as pessoas abertos
  useEffect(() => { setCalOpen(false); setGuestOpen(false); }, [buscaNoHero]);

  /* ── tokens ── */
  // paleta do Grupo PinheiraMar: marinho (texto e ações), pedra (apoio)
  const BLACK  = BRAND.marinho;
  const GREY   = BRAND.pedra;
  const LIGHT  = C.fundoSuave;
  const BORDER = C.line;
  const ACCENT = BRAND.marinho;
  const WHITE  = C.white;

  /* ── search pill segments ── */
  const Seg = ({ label, children, last }) => (
    <div style={{ flex: 1, padding: '0 16px', borderRight: last ? 'none' : `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, minWidth: 0 }}>
      {/* 11.5px e tracking mais solto que antes (10px/.12em): versalete
          condensada nesse tamanho é o pior caso de legibilidade para
          presbiopia — público 40+ */}
      <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: GREY }}>{label}</div>
      {children}
    </div>
  );
  const segInput = { border: 'none', outline: 'none', background: 'transparent', fontFamily: F.sans, fontSize: 15, color: BLACK, width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  /* ── cartão de data grande (busca mobile em ecrã cheio) — abre o calendário de disponibilidade visual ── */
  const DateCard = ({ label, value, onClick, compact, placeholder }) => {
    const parts = bigDateParts(value, locale);
    return (
      <div>
        {/* rótulo legível (sem maiúsculas miúdas) — público 50+ */}
        <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.marinho, marginBottom: 8 }}>{label}</div>
        <button onClick={onClick} style={{ width: '100%', minHeight: 60, textAlign: 'left', position: 'relative', border: `1.5px solid ${value ? BLACK : C.inativo}`, borderRadius: R.cartao, padding: compact ? '12px' : '14px 16px', background: WHITE, cursor: 'pointer', fontFamily: F.sans }}>
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
              <span style={{ fontSize: 17, color: BRAND.pedra }}>{placeholder || tr('m_pick_date')}</span>
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
        <div className="pm-card-photo" style={{ position: 'relative', overflow: 'hidden', borderRadius: R.cartao, aspectRatio: '4/3', background: LIGHT }}>
          {/* uma só etiqueta de vista, em cima e traduzida — a de baixo
              ("FRENTE MAR") repetia a mesma informação (a pedido do Caio) */}
          {/* altura 100%: a foto preenche a moldura 4:3 em qualquer largura —
              com 240 fixos sobrava uma faixa cinzenta por baixo nos cartões
              largos (lista de resultados no celular) */}
          <PhotoTile apt={apt} h="100%" radius={0} rotulo={dado(apt.vista)} />
          <button onClick={e => { e.stopPropagation(); setLiked(l => ({ ...l, [apt.id]: !l[apt.id] })); }}
            aria-label={liked[apt.id] ? tr('ps_desfavoritar', apt.nome) : tr('ps_favoritar', apt.nome)} aria-pressed={!!liked[apt.id]}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,.86)', border: 'none', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)' }}>
            <Heart size={18} fill={liked[apt.id] ? BRAND.marinho : 'none'} color={liked[apt.id] ? BRAND.marinho : GREY} strokeWidth={1.8} />
          </button>
          {!available && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.55)', display: 'grid', placeItems: 'center' }}>
              <button onClick={e => { e.stopPropagation(); setCalCi(''); setCalCo(''); setCalApt(apt); }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: WHITE, padding: '8px 16px', border: `1px solid ${BORDER}`, borderRadius: R.cartao, cursor: 'pointer', fontFamily: F.sans }}>
                <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '.06em', color: GREY, textTransform: 'uppercase' }}>{tr('ps_indisponivel')}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: ACCENT }}>{tr('ps_ver_datas_livres')}</span>
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
          {/* o título é um botão de verdade: quem navega pelo teclado (Tab +
              Enter) ou com leitor de ecrã também abre o apartamento — o cartão
              inteiro continua clicável com o rato/dedo */}
          {available
            ? <button type="button" onClick={e => { e.stopPropagation(); openDetail(apt); }} className="pm-card-title-row"
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: 0, margin: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: BLACK, lineHeight: 1.3 }}>{apt.nome}</button>
            : <div className="pm-card-title-row" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: BLACK, lineHeight: 1.3 }}>{apt.nome}</div>}
          <div style={{ fontSize: 16, color: GREY, marginTop: 3 }}>{dado(apt.piso)} · {dado(apt.vista)} · {tr('ps_ate_pessoas', apt.capacidade)}</div>
          {valid && !available && (() => {
            // estadia encurtada na caixa "Datas próximas": mostra as brechas
            // DENTRO das datas pedidas com pelo menos essas noites
            if (noitesBusca < noitesPedido) {
              const blocos = blocosNoPedido(apt.id).filter(j => nights(j[0], j[1]) >= noitesBusca);
              return blocos.length ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: GREY, marginBottom: 6 }}>{tr('ps_livre_dentro')}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {blocos.map(j => {
                      const n = nights(j[0], j[1]); const min = regraNoites(data.seasons, j[0]).min;
                      return n < min ? (
                        <a key={j[0]} href={whatsappUrl(msgBrecha({ aptos: [apt.nome], ci: j[0], co: j[1], noites: n, hospedes: hosp }))} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '7px 12px', borderRadius: R.cartao, border: `1px dashed ${C.whatsapp}`, background: WHITE, color: BLACK, fontFamily: F.sans, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                          <span>{fmtJanela(j)} · {tr('noites', n)}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: C.whatsapp }}><MessageCircle size={13} /> WhatsApp · {tr('ps_min_curto', min)}</span>
                        </a>
                      ) : (
                        <button key={j[0]} type="button" onClick={e => { e.stopPropagation(); escolherJanela(j); }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: R.pilula, border: `1px solid ${BLACK}`, background: WHITE, color: BLACK, fontFamily: F.sans, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                          <CalendarDays size={14} /> {fmtJanela(j)} · {tr('noites', n)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : <div style={{ marginTop: 8, fontSize: 14, color: GREY }}>{tr('ps_sem_n_dentro', tr('noites', noitesBusca))}</div>;
            }
            const alt = livresProximas(apt.id);
            return alt.length ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: GREY, marginBottom: 6 }}>{tr('ps_livre_proximas')}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {alt.map(j => (
                    <button key={j[0]} type="button" onClick={e => { e.stopPropagation(); escolherJanela(j); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: R.pilula, border: `1px solid ${BLACK}`, background: WHITE, color: BLACK, fontFamily: F.sans, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                      <CalendarDays size={14} /> {fmtJanela(j)}
                    </button>
                  ))}
                </div>
              </div>
            ) : <div style={{ marginTop: 8, fontSize: 14, color: GREY }}>{tr('ps_sem_livres_2sem')}</div>;
          })()}
          {valid && !fits && (
            needsCombo
              ? <div style={{ fontSize: 16, color: GREY, fontWeight: 600, marginTop: 6 }}>{tr('ps_combinar_obrigatorio', hosp)}</div>
              : <div style={{ fontSize: 16, color: ACCENT, fontWeight: 600, marginTop: 5 }}>{tr('ps_combinar')}</div>
          )}
          {/* com datas: o TOTAL da estadia, já com as taxas obrigatórias — o
              mesmo valor da página do apartamento e do servidor (sem a
              "média por noite", que não batia com a conta quando o fim de
              semana custa mais). Sem datas o cartão não mostra valor nenhum:
              a diária muda muito com a temporada e o "a partir de" enganava;
              uma frase só, acima da lista, pede as datas (a pedido do Caio,
              2026-09). */}
          {valid && orc && available && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 19, fontWeight: 700, color: BLACK }}>{money(orc.total)}</span>
                <span style={{ fontSize: 16, color: GREY }}>{tr('ps_total')}</span>
              </div>
              <div style={{ fontSize: 16, color: GREY, marginTop: 2 }}>{tr('noites', orc.noites)}{orc.taxasTotal > 0 ? ` · ${tr('ps_taxas_incluidas')}` : ''}</div>
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
        {/* setas nas pontas: ‹ à esquerda e › à direita da fila (só no
            computador; no telemóvel somem — ver App.jsx) */}
        {items.length > 4 && (
          <div className="pm-row-arrows" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
            <button onClick={() => shift(-1)} aria-label={tr('ps_rolar_anteriores')} title={tr('ps_rolar_anteriores')} style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', color: GREY }}><ChevronLeft size={16} /></button>
            <button onClick={() => shift(1)}  aria-label={tr('ps_rolar_seguintes')} title={tr('ps_rolar_seguintes')} style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', color: GREY }}><ChevronRight size={16} /></button>
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

  /* ── bloco de um imóvel (à la Booking: banner do imóvel + as suas unidades) ──
     `invert`: usado na secção "outros apartamentos" que aparece abaixo dos
     resultados do filtro quando há um filtro de categoria ativo — mostra o
     COMPLEMENTO do filtro (o que ficou de fora), em vez de reordenar ou
     esconder o resto, a pedido do Caio (2026-09-26): sem filtro, quem olha
     só a lista filtrada pode achar que não há mais opções. */
  const PropertyGroup = ({ g, invert = false, last = false }) => {
    const { residencial: r, withInfo, needsCombo, combo } = g;
    const filtered = withInfo.filter(w => (invert ? !noTopo(w) : noTopo(w)));
    const list = valid ? filtered : filtered.map(w => ({ ...w, available: true }));
    if (!list.length) return null;
    // A contagem é a do que está à vista (com um filtro ativo dizia "17
    // apartamentos" com só 2 no ecrã) e já não repete a localização, que
    // está na etiqueta logo acima (a pedido do Caio). A casa conta à parte:
    // "17 apartamentos e 1 casa"; com datas, "12 de 18 disponíveis".
    const doFiltro = withInfo.filter(w => catFilter(w.apt));
    const disponiveis = doFiltro.filter(w => w.available).length;
    const temCasa = filtered.some(w => ehCasa(w.apt));
    const countLabel = valid
      ? (invert ? tr('ps_n_indisponiveis', filtered.length) : (temCasa ? tr('ps_n_de_m_disponiveis_curto', disponiveis, doFiltro.length) : tr('ps_n_de_m_disponiveis', disponiveis, doFiltro.length)))
      : contagemUnidades(filtered.map(w => w.apt));

    return (
      <div ref={invert ? undefined : el => { groupRefs.current[r.id] = el; }} className={`pm-pubsite-group${last ? ' pm-pubsite-group--last' : ''}`} style={{ marginBottom: last ? 32 : 72, scrollMarginTop: 140 }}>
        <div className="pm-pubsite-group-head" style={{ display: 'flex', alignItems: 'center', gap: 24, paddingBottom: 18, marginBottom: 6, flexWrap: 'wrap' }}>
          <img src={RESIDENCIAL_LOGOS[r.id] || r.heroImage} alt={r.nome} className="pm-pubsite-group-logo"
            style={{ width: RESIDENCIAL_LOGO_W[r.id] || 220, height: 'auto', maxWidth: '100%', flexShrink: 0, display: 'block' }}
            onError={e => { e.target.style.display = 'none'; }} />
          <div className="pm-pubsite-group-info" style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="pm-pubsite-group-region" style={{ fontSize: 16.5, color: GREY, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={15} strokeWidth={1.5} /> {dado(r.regiaoLabel)}</div>
          </div>
          <div className="pm-pubsite-group-count" style={{ fontSize: 14, color: GREY, letterSpacing: '.12em', textTransform: 'uppercase', flexShrink: 0 }}>{countLabel}</div>
        </div>
        {/* indicador de residencial: o segmento deste residencial aceso, os outros a 15% */}
        <Faixa height={3} lit={FAIXA_INDEX[r.id] ?? null} style={{ marginBottom: 28 }} />

        {/* não repete a sugestão de combinação na secção "outros apartamentos"
            (invert) — já apareceu na secção do filtro, para o mesmo imóvel */}
        {!invert && valid && needsCombo && combo && (
          <div className="pm-pubsite-combo" style={{ border: `1px solid ${BORDER}`, borderRadius: R.modal, padding: '20px 24px', marginBottom: 28, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <Users size={18} color={GREY} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 16, color: BLACK, lineHeight: 1.65 }}>
              <b>{tr('ps_combo_titulo', hosp, r.nome)}</b>
              {combo.enough
                ? <> {tr('ps_combo_sugestao')} <b>{combo.pick.map(a => `${a.nome} (${tr('pessoas', a.capacidade)})`).join(' + ')}</b> — {tr('ps_combo_capacidade', combo.cap)}{combo.pick.length > 2 ? ` ${tr('ps_combo_tres')}` : ''}</>
                : <> {tr('ps_combo_sem')}</>}
              {combo.enough && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {combo.pick.map(a => (
                    <button key={a.id} onClick={() => openDetail(a)}
                      style={{ background: BLACK, color: WHITE, border: 'none', borderRadius: R.cartao, minHeight: 44, padding: '0 16px', fontSize: 16, fontWeight: 700, cursor: 'pointer', letterSpacing: '.04em', textTransform: 'uppercase' }}>
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
        <BotaoWhatsApp rotulo={tr('ap_fale_whatsapp')} sobe />
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
    { key: 'cap8', n: 8, curto: '8+', icone: (s) => <Users size={s} />, label: tr('cat_cap8') },
  ].map(c => (c.sep ? c : { ...c, nomeCompleto: c.label }));

  // Calendário e seletor de pessoas da busca — os mesmos na busca do
  // cabeçalho e na busca grande da faixa principal (só um aparece de cada vez).
  const popCalendario = (extra = {}) => (
    <>
      <div onClick={() => setCalOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      {/* 640 px: os dois meses cabem lado a lado (cada um precisa de ~230) */}
      <div className="pm-cal-pop" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 100, width: 640, maxWidth: '90vw', ...extra }} onClick={e => e.stopPropagation()}>
        <AvailabilityCalendar ci={ci} co={co} ate={ultimaNoite}
          onChange={(newCi, newCo) => {
            setCi(newCi);
            if (newCo && nights(newCi, newCo) < 1) setCo(''); else setCo(newCo);
            if (newCi && newCo) setCalOpen(false);
          }} />
      </div>
    </>
  );
  const popPessoas = (extra = {}) => (
    <div style={{ position: 'absolute', top: '100%', marginTop: 8, ...extra, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: R.modal, padding: 20, zIndex: 100, minWidth: 240, boxShadow: '0 8px 32px rgba(0,0,0,.10)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
                      <span style={{ fontSize: 17, fontWeight: 600 }}>{tr('search_guests')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <button aria-label={tr('m_menos_pessoa')} onClick={() => setHosp(h => Math.max(0,h-1))} style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 16 }}>−</button>
                        <span style={{ fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{hosp || '—'}</span>
                        <button aria-label={tr('m_mais_pessoa')} onClick={() => setHosp(h => h+1)} style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 16 }}>+</button>
                      </div>
                    </div>
                    <button onClick={() => setGuestOpen(false)} style={{ width: '100%', padding: '11px 0', background: BLACK, color: WHITE, border: 'none', borderRadius: R.cartao, cursor: 'pointer', fontWeight: 700, fontSize: 16, letterSpacing: '.05em' }}>{tr('search_confirm')}</button>
                  </div>
  );
  // Na faixa principal o calendário abre por baixo do cartão: se não couber no
  // ecrã, a página sobe o suficiente (sem esconder o cartão sob o cabeçalho).
  const abrirNaFaixa = (qual, forcar = false) => {
    if (qual === 'cal') { setGuestOpen(false); setCalOpen(o => (forcar ? true : !o)); } else { setCalOpen(false); setGuestOpen(o => !o); }
    const el = heroBuscaRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const falta = r.bottom + (qual === 'cal' ? 470 : 200) - window.innerHeight;
    if (falta > 0) window.scrollBy({ top: Math.min(falta, Math.max(0, r.top - 90)), behavior: 'smooth' });
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
            {/* barra em pílula, com o botão "Ver apartamentos" arredondado por dentro (caixas e
                botões arredondados, a pedido do Caio). Sem overflow:hidden: o
                calendário e o seletor de pessoas abrem por baixo dela. */}
            <div style={{ display: 'flex', alignItems: 'stretch', height: 50, padding: 4, boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: R.pilula, background: WHITE, boxShadow: '0 2px 10px rgba(27,28,70,.06)', maxWidth: 820, width: '100%', position: 'relative', visibility: buscaNoHero ? 'hidden' : 'visible', opacity: buscaNoHero ? 0 : 1, transition: 'opacity .2s ease' }}>
              <Seg label={tr('search_checkin')}>
                <div style={{ ...segInput, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={() => { setGuestOpen(false); setCalOpen(o => !o); }}>
                  <span style={{ color: ci ? BLACK : C.inkSoft }}>{ci ? fmtCurta(ci) : tr('ps_selecionar_entrada')}</span>
                </div>
              </Seg>
              <Seg label={tr('search_checkout')}>
                <div style={{ ...segInput, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={() => { setGuestOpen(false); setCalOpen(o => !o); }}>
                  <span style={{ color: co ? BLACK : C.inkSoft }}>{co ? fmtCurta(co) : tr('ps_selecionar_saida')}</span>
                </div>
              </Seg>
              {calOpen && !buscaNoHero && popCalendario()}
              <Seg label={tr('search_who')} last>
                <div style={{ ...segInput, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={() => setGuestOpen(o => !o)}>
                  <span style={{ color: hosp ? BLACK : C.inkSoft }}>{hosp ? tr('search_guests_label', hosp) : tr('search_add_guests')}</span>
                </div>
                {guestOpen && !buscaNoHero && popPessoas()}
              </Seg>
              {/* como no telemóvel: sem datas o botão abre o calendário
                  ("Consultar datas e valores"); com datas leva à lista */}
              <button onClick={() => { setGuestOpen(false); if (valid) { setCalOpen(false); resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else setCalOpen(true); }}
                style={{ padding: '0 18px', background: BLACK, color: WHITE, border: 'none', borderRadius: R.pilula, cursor: 'pointer', fontSize: 16, fontWeight: 700, letterSpacing: '.06em', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {(valid ? tr('search_btn') : tr('ps_datas_para_preco')).toUpperCase()}
              </button>
            </div>

            {/* botão "Limpar consulta" ao lado do PROCURAR — mais visível do
                que o X pequeno que ficava espremido dentro da barra, a
                pedido do Caio, 2026-09. */}
            {!!(ci || co || hosp) && !buscaNoHero && (
              <button onClick={() => { setCi(''); setCo(''); setHosp(0); setGuestOpen(false); setCalOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', background: WHITE, border: `1px solid ${BORDER}`, borderRadius: R.pilula, cursor: 'pointer', color: GREY, fontSize: 14, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
                <X size={13} /> {tr('ps_limpar_consulta')}
              </button>
            )}
          </div>


          {/* idioma — canto superior direito do cabeçalho, só no desktop
              (no telemóvel esta barra fica escondida por CSS: lá o seletor de
              idioma vive dentro do bloco "Conheça a Pinheira" — ver
              DestinoSection e .pm-destino-lang em App.jsx, 2026-09-27). */}
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
              style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 40, fontSize: 16, fontWeight: 700, color: BRAND.marinho, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: R.pilula, cursor: 'pointer', padding: '0 14px' }}>
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
            <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.marinho, marginBottom: 8 }}>{tr('m_people')}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64, padding: '8px 12px 8px 16px', border: `1.5px solid ${hosp ? BLACK : C.inativo}`, borderRadius: R.cartao }}>
              <span style={{ fontSize: 16, fontWeight: hosp ? 700 : 400, color: hosp ? BLACK : BRAND.pedra }}>{hosp ? tr('m_people_n', hosp) : tr('m_people_none')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button aria-label={tr('m_menos_pessoa')} disabled={!hosp} onClick={() => setHosp(h => Math.max(0, h - 1))} style={{ width: 46, height: 46, borderRadius: '50%', border: `1.5px solid ${hosp ? C.bordaForte : BORDER}`, background: WHITE, color: hosp ? BLACK : C.inativo, cursor: hosp ? 'pointer' : 'default', fontSize: 22, display: 'grid', placeItems: 'center' }}>−</button>
                <span style={{ fontWeight: 800, fontSize: 18, minWidth: 20, textAlign: 'center', visibility: hosp ? 'visible' : 'hidden' }}>{hosp || 0}</span>
                <button aria-label={tr('m_mais_pessoa')} onClick={() => setHosp(h => h + 1)} style={{ width: 46, height: 46, borderRadius: '50%', border: `1.5px solid ${C.bordaForte}`, background: WHITE, color: BLACK, cursor: 'pointer', fontSize: 22, display: 'grid', placeItems: 'center' }}>+</button>
              </div>
            </div>
          </div>
          {/* sem datas: a caixa "Escolha as datas para ver valores" abre o
              calendário; com datas, o botão leva à lista com os preços */}
          {valid ? (
            <button onClick={() => { setCalOpen(false); resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              style={{ width: '100%', minHeight: 56, background: BLACK, color: WHITE, border: 'none', borderRadius: R.cartao, fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>
              {tr('m_see_available')}
            </button>
          ) : (
            <button type="button" onClick={() => setCalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 56, padding: '12px 18px', background: BLACK, border: 'none', borderRadius: R.cartao, cursor: 'pointer', fontFamily: F.sans, color: WHITE, textAlign: 'left' }}>
              <CalendarDays size={19} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 16, fontWeight: 700, lineHeight: 1.4 }}>{tr('ps_datas_para_preco')}</span>
              <ChevronRight size={17} style={{ flexShrink: 0 }} />
            </button>
          )}
        </div>
      </div>

      {/* ══ HERO — escondido no telemóvel (ver App.jsx), onde ocupava a tela
             toda antes do hóspede ver a busca/resultados; fica só no desktop ══ */}
      {/* 2026-11-22 (a pedido do Caio): título mais legível sobre um degradê
             marinho à esquerda e a busca grande no centro da faixa, em vez de
             só no cabeçalho. Sem overflow:hidden: o calendário e as pessoas
             da busca abrem por baixo do cartão, por cima da página. */}
      <section className="pm-pubsite-hero" style={{ position: 'relative', height: 'clamp(560px,78vh,760px)', display: 'flex', alignItems: 'flex-end' }}>
        {/* foto do topo ocupa toda a faixa (a pedido do Caio, 2026-11-08): aqui
            o corte em cima/em baixo é aceite, para a primeira impressão ser a
            foto de ponta a ponta; o enquadramento fica um pouco abaixo do
            centro, para mostrar mar e praia. Nas outras fotos do site
            continua a regra de nunca cortar (FotoInteira em ui.jsx). */}
        {(() => {
          const src = fotoTopo(r0.heroImage);
          const v = heroVersoes(src);   // WebP + JPG em 2 tamanhos (foto padrão); outra foto vai como está
          return (
            <picture>
              {v && <source type="image/webp" srcSet={v.webp} sizes="100vw" />}
              <img src={src} srcSet={v?.jpg} sizes={v ? '100vw' : undefined} alt="" fetchpriority="high" decoding="async"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 66%' }}
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            </picture>
          );
        })()}
        {/* marinho à esquerda (onde fica o texto) e um pouco em baixo (cartão da busca) */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(20,21,47,.82) 0%, rgba(27,28,70,.62) 34%, rgba(27,28,70,.12) 64%, rgba(0,0,0,0) 80%), linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(20,21,47,.45) 100%)' }} />
        <div className="pm-pubsite-hero-inner" style={{ position: 'relative', maxWidth: 1280, width: '100%', margin: '0 auto', padding: '0 32px 44px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Faixa height={3} width={34} tone="negativo" />
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '.14em', color: C.white, textTransform: 'uppercase' }}>{tr('ps_hero_local')}</span>
          </div>
          <h1 style={{ fontSize: 'clamp(40px,4.4vw,60px)', fontWeight: 700, lineHeight: 1.08, margin: '0 0 18px', letterSpacing: '-.015em', color: C.white, maxWidth: 720, textShadow: '0 2px 18px rgba(0,0,0,.25)' }}>
            {tr('ps_hero_titulo_1')}<br />{tr('ps_hero_titulo_2')}
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.94)', lineHeight: 1.6, margin: '0 0 34px', maxWidth: 560 }}>
            {tr('ps_hero_texto', data.residenciais.length)}
          </p>

          {/* busca grande — os mesmos campos, textos e calendário da busca do cabeçalho */}
          <div ref={heroBuscaRef} className="pm-hero-busca" style={{ position: 'relative', background: WHITE, borderRadius: R.modal, boxShadow: '0 18px 50px rgba(20,21,47,.30)', padding: '22px 24px', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            {[
              { rotulo: tr('search_checkin'), valor: ci ? fmtCurta(ci) : '', vazio: tr('ps_selecionar_entrada'), abrir: () => abrirNaFaixa('cal'), icone: <CalendarDays size={18} color={GREY} /> },
              { rotulo: tr('search_checkout'), valor: co ? fmtCurta(co) : '', vazio: tr('ps_selecionar_saida'), abrir: () => abrirNaFaixa('cal'), icone: <CalendarDays size={18} color={GREY} /> },
              { rotulo: tr('search_who'), valor: hosp ? tr('search_guests_label', hosp) : '', vazio: tr('search_add_guests'), abrir: () => abrirNaFaixa('pessoas'), icone: <Users size={18} color={GREY} />, pessoas: true },
            ].map(f => (
              <div key={f.rotulo} style={{ flex: 1, minWidth: 0, position: f.pessoas ? 'relative' : 'static' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: BLACK, marginBottom: 8 }}>{f.rotulo}</div>
                <button type="button" onClick={f.abrir} aria-label={`${f.rotulo}: ${f.valor || f.vazio}`}
                  style={{ width: '100%', height: 54, border: `1px solid ${f.valor ? BLACK : '#D6D3CC'}`, borderRadius: R.cartao, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 16px', background: WHITE, cursor: 'pointer', fontFamily: F.sans, fontSize: 17.5, color: f.valor ? BLACK : C.inkSoft, fontWeight: f.valor ? 600 : 400, textAlign: 'left' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.valor || f.vazio}</span>
                  {f.icone}
                </button>
                {f.pessoas && guestOpen && buscaNoHero && popPessoas({ left: 0, right: 'auto' })}
              </div>
            ))}
            {calOpen && buscaNoHero && popCalendario({ left: 24 })}
            {/* sem datas: "Consultar datas e valores" abre o calendário; com datas: "Ver apartamentos" */}
            <button type="button" onClick={() => { if (valid) { setGuestOpen(false); setCalOpen(false); resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else abrirNaFaixa('cal', true); }}
              style={{ flexShrink: 0, height: 54, padding: '0 30px', borderRadius: R.cartao, border: 'none', background: BLACK, color: C.white, fontFamily: F.sans, fontSize: 16, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {valid ? tr('search_btn') : tr('ps_datas_para_preco')}
            </button>
          </div>
          {!!(ci || co || hosp) && (
            <button type="button" onClick={() => { setCi(''); setCo(''); setHosp(0); setGuestOpen(false); setCalOpen(false); }}
              style={{ position: 'absolute', right: 32, bottom: 12, display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: C.white, cursor: 'pointer', fontFamily: F.sans, fontSize: 16, fontWeight: 700, textShadow: '0 1px 6px rgba(0,0,0,.5)' }}>
              <X size={14} /> {tr('ps_limpar_consulta')}
            </button>
          )}
        </div>
      </section>

      {/* ══ CATEGORY FILTER STRIP ══ */}
      {/* top = altura do cabeçalho: 72 px da linha + 1 px da borda */}
      <div className="pm-pubsite-catbar" style={{ borderBottom: `1px solid ${BORDER}`, background: WHITE, position: 'sticky', top: 73, zIndex: 40 }}>
        <div className="pm-pubsite-catstrip" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {categorias.map((cat, i) => {
            if (cat.sep) return <div key={`sep${i}`} aria-hidden style={{ alignSelf: 'center', width: 1, height: 26, background: BORDER, margin: '0 10px', flexShrink: 0 }} />;
            const on = activeCategory === cat.key;
            return (
              <button key={String(cat.key)} className="pm-cat-btn" data-active={on ? 'true' : 'false'} onClick={() => setActiveCategory(on ? null : cat.key)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0, fontSize: 13.5, fontWeight: 600, color: on ? BLACK : GREY, borderBottom: on ? `2px solid ${BLACK}` : '2px solid transparent', transition: 'all .15s' }}>
                <span style={{ color: on ? BLACK : GREY }}>{cat.icone(16)}</span>
                {cat.label}
              </button>
            );
          })}
          {activeCategory && (
            <button onClick={() => setActiveCategory(null)} style={{ marginLeft: 'auto', alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 16, padding: '6px 12px', border: `1px solid ${BORDER}`, borderRadius: R.pilula, background: WHITE, cursor: 'pointer', color: GREY, flexShrink: 0 }}>
              <X size={14} aria-hidden="true" /> {tr('ps_limpar_filtro')}
            </button>
          )}
        </div>
      </div>

      {/* ══ RESULTADOS — um bloco por imóvel, como um motor de reservas de hotel ══ */}
      {/* scrollMarginTop: no computador o cabeçalho (73px) e a barra de filtros
          (74px) ficam fixos no topo; com 80 o título dos resultados ("20 dez —
          27 dez · 7 noites") ficava por baixo deles ao rolar até aqui. No
          celular nada fica fixo e continua 80 (ver .pm-pubsite-main em App.jsx). */}
      <main ref={resultsRef} className="pm-pubsite-main" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 32px 40px', scrollMarginTop: 110 }}>
        {/* telemóvel: filtros (só ícones, com rolagem para o lado) logo acima
            da lista — antes ficavam no cabeçalho, que passou a ter a logo do
            grupo (a pedido do Caio, 2026-11-22). No computador ficam na faixa
            fixa por baixo do topo, com o nome. */}
          <nav className="pm-pubsite-hcats" aria-label={tr('ps_filtros')}
            style={{ display: 'none', minWidth: 0, margin: '0 0 28px', alignItems: 'center', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 0' }}>
            {categorias.map((cat, i) => {
              if (cat.sep) return <div key={`sep${i}`} aria-hidden style={{ alignSelf: 'center', width: 1, height: 24, background: BORDER, flexShrink: 0 }} />;
              const on = activeCategory === cat.key;
              const comTexto = false; // teste: sempre só ícone (era catIsResidencial(cat.key))
              return (
                <button key={String(cat.key)} type="button" onClick={() => escolherCategoriaTopo(on ? null : cat.key)}
                  aria-label={cat.nomeCompleto} title={cat.nomeCompleto} aria-pressed={on}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, minWidth: 48, padding: cat.n ? '0 14px 0 12px' : (comTexto ? '0 14px' : '0 12px'), flexShrink: 0, borderRadius: R.pilula, border: `1px solid ${on ? 'rgba(27,28,70,.45)' : BORDER}`, background: on ? 'rgba(27,28,70,.08)' : WHITE, color: on ? BLACK : GREY, cursor: 'pointer', fontFamily: F.sans, fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {cat.icone(20)}{cat.n ? <span aria-hidden>{cat.curto || cat.n}</span> : null}{comTexto ? <span aria-hidden>{cat.label}</span> : null}
                </button>
              );
            })}
          </nav>

        {valid && (
          <div style={{ marginBottom: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {fmtCurta(ci)} — {fmtCurta(co)} · {tr('noites', nights(ci, co))}{hosp ? ` · ${tr('pessoas', hosp)}` : ''}
                <button onClick={() => { setCi(''); setCo(''); setHosp(0); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13.5, fontWeight: 700, color: GREY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: R.pilula, padding: '5px 12px', cursor: 'pointer' }}>
                  <X size={12} /> {tr('ps_limpar_consulta')}
                </button>
                <button onClick={compartilharPesquisa} aria-live="polite"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: BLACK, background: 'none', border: `1px solid ${BORDER}`, borderRadius: R.pilula, padding: '5px 12px', cursor: 'pointer', fontFamily: F.sans }}>
                  <Share2 size={12} /> {pesquisaCopiada ? tr('ap_link_copiado') : tr('ps_compartilhar_pesquisa')}
                </button>
              </div>
              <div style={{ fontSize: 16, color: GREY, marginTop: 4 }}>{subtituloDisponibilidade}</div>
            </div>
          </div>
        )}
        {(() => {
          const temOutros = (activeCategory || valid) && groups.some(g => g.withInfo.some(w => !noTopo(w)));
          // último grupo com algo para mostrar no bloco de cima — só ele
          // encolhe a margem de baixo quando NÃO há secção "outros" depois
          // (a pedido do Caio, 2026-09-26: menos espaço em branco antes do
          // destino, sem também apertar a separação entre residenciais).
          const visiveis = gruposOrdenados.filter(g => nTopo(g) > 0);
          const idUltimoVisivel = temOutros ? null : visiveis[visiveis.length - 1]?.residencial.id;
          const livresNaBase = data.apartamentos.some(a => a.ativo && catFilter(a) && (!hosp || a.capacidade >= hosp) && isAvailable(data.reservas, a.id, bci, bco));
          // Caixa de opções à volta das datas do hóspede. Pouco texto: um título
          // com as datas pedidas e três grupos, do mais perto do pedido para o
          // mais longe — trocar de apartamento nas mesmas datas, a mesma
          // duração noutras datas, estadias mais curtas.
          const rotuloSecao = { fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: GREY, margin: '18px 0 8px' };
          const gradeOpcoes = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))', gap: 8 };
          const cartaoOpcao = (ativo, tracejado) => ({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: '10px 12px', borderRadius: R.cartao, background: WHITE, border: ativo ? `2px solid ${BLACK}` : tracejado ? `1px dashed ${C.whatsapp}` : `1px solid ${BORDER}`, margin: ativo ? 0 : 1, fontFamily: F.sans, textAlign: 'left', textDecoration: 'none', cursor: 'pointer', minWidth: 0 });
          const linhaData = { fontSize: 15.5, fontWeight: 700, color: BLACK, whiteSpace: 'nowrap' };
          const linhaWhats = { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13.5, fontWeight: 700, color: C.whatsapp };
          const caixaAlt = valid && (
            <div style={{ border: `1px solid ${BORDER}`, background: LIGHT, borderRadius: R.modal, padding: '18px 20px 20px', marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: BLACK }}>{livresNaBase ? tr('ps_alt_titulo') : tr('ps_alt_titulo_nenhum_base', fmtIntervalo([bci, bco]))}</div>
                  <div style={{ fontSize: 15, color: GREY, marginTop: 2 }}>{tr('ps_alt_desc_base', hosp ? tr('pessoas', hosp) : '')}</div>
                </div>
                {!naBase && (
                  <button type="button" onClick={voltarBase}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 40, padding: '0 14px 0 10px', borderRadius: R.pilula, border: `1px solid ${BLACK}`, background: WHITE, color: BLACK, fontFamily: F.sans, fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <ChevronLeft size={16} /> {tr('ps_voltar_datas', fmtIntervalo([bci, bco]))}
                  </button>
                )}
              </div>

              {combinacoes.length > 0 && (<>
                <div style={rotuloSecao}>{tr('ps_sec_troca')}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {combinacoes.map(c => (
                    <div key={c.partes.map(x => x.apt.id + x.ci).join('|')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', background: WHITE, border: `1px solid ${BORDER}`, borderRadius: R.cartao, padding: '8px 8px 8px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', columnGap: 8, rowGap: 2, flexWrap: 'wrap', fontSize: 15, color: BLACK, minWidth: 0, flex: '1 1 240px' }}>
                        {c.partes.map((x, k) => (
                          <React.Fragment key={x.apt.id + x.ci}>
                            {k > 0 && <ChevronRight aria-hidden size={15} color={GREY} />}
                            <span style={{ whiteSpace: 'nowrap' }}><b>{x.apt.nome}</b> <span style={{ color: GREY }}>{fmtIntervalo([x.ci, x.co])}</span></span>
                          </React.Fragment>
                        ))}
                      </div>
                      <a href={whatsappUrl(msgCombinacao({ partes: c.partes.map(x => ({ apto: x.apt.nome, ci: x.ci, co: x.co })), hospedes: hosp }))} target="_blank" rel="noopener noreferrer" aria-label={tr('ps_pedir_combinacao')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 38, padding: '0 14px', borderRadius: R.pilula, background: C.whatsapp, color: C.white, fontSize: 14, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                        <MessageCircle size={15} /> {tr('ps_pedir_curto')}
                      </a>
                    </div>
                  ))}
                </div>
              </>)}

              <div style={{ ...rotuloSecao, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span>{tr('ps_sec_mesma_duracao')}</span>
                {/* nº de noites procuradas, compacto, junto do grupo que controla */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0 }}>
                  <button type="button" aria-label={tr('ps_menos_noite')} disabled={noitesBusca <= 1} onClick={() => setNoitesAlt(Math.max(1, noitesBusca - 1))}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: `1px solid ${noitesBusca <= 1 ? BORDER : C.bordaForte}`, background: WHITE, color: noitesBusca <= 1 ? C.inativo : BLACK, cursor: noitesBusca <= 1 ? 'default' : 'pointer', fontSize: 16, lineHeight: 1 }}>−</button>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: BLACK, minWidth: 64, textAlign: 'center' }}>{tr('noites', noitesBusca)}</span>
                  <button type="button" aria-label={tr('ps_mais_noite')} disabled={noitesBusca >= MAX_NOITES_ALT} onClick={() => setNoitesAlt(Math.min(MAX_NOITES_ALT, noitesBusca + 1))}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: `1px solid ${noitesBusca >= MAX_NOITES_ALT ? BORDER : C.bordaForte}`, background: WHITE, color: noitesBusca >= MAX_NOITES_ALT ? C.inativo : BLACK, cursor: noitesBusca >= MAX_NOITES_ALT ? 'default' : 'pointer', fontSize: 16, lineHeight: 1 }}>+</button>
                </span>
              </div>
              {alternativasGerais.length ? (
                <div style={gradeOpcoes}>
                  {alternativasGerais.map(({ j, n, livres, min, abaixo }) => {
                    const ativo = j[0] === ci && j[1] === co;
                    return abaixo ? (
                      <a key={j[0]} href={whatsappUrl(msgBrecha({ aptos: livres.slice(0, 3).map(a => a.nome), ci: j[0], co: j[1], noites: noitesBusca, hospedes: hosp }))} target="_blank" rel="noopener noreferrer" style={cartaoOpcao(false, true)}>
                        <span style={linhaData}>{fmtIntervalo(j)}</span>
                        <span style={{ fontSize: 14, color: GREY }}>{tr('ps_n_livres', n)} · {tr('ps_min_curto', min)}</span>
                        <span style={linhaWhats}><MessageCircle size={13} /> WhatsApp</span>
                      </a>
                    ) : (
                      <button key={j[0]} type="button" onClick={() => escolherJanela(j)} aria-pressed={ativo} style={cartaoOpcao(ativo)}>
                        <span style={linhaData}>{fmtIntervalo(j)}</span>
                        <span style={{ fontSize: 14, color: C.sucesso, fontWeight: 600 }}>{tr('ps_n_livres', n)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 15, color: GREY }}>{tr('ps_alt_sem_curto', tr('noites', noitesBusca))}</div>
              )}

              {brechas.length > 0 && (<>
                <div style={rotuloSecao}>{tr('ps_brechas_titulo')}</div>
                <div style={gradeOpcoes}>
                  {brechas.map(({ aptos, j, n, dentro, min, abaixo }) => {
                    const ativo = j[0] === ci && j[1] === co;
                    const corpo = <>
                      {dentro > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: C.acao }}>{tr('ps_nas_suas_datas')}</span>}
                      <span style={linhaData}>{fmtIntervalo(j)}</span>
                      <span style={{ fontSize: 14, color: abaixo ? GREY : C.sucesso, fontWeight: abaixo ? 500 : 600 }}>
                        {tr('noites', n)}{abaixo ? ` · ${tr('ps_min_curto', min)}` : ` · ${aptos.length === 1 ? aptos[0].nome : tr('ps_n_livres', aptos.length)}`}
                      </span>
                      {abaixo && <span style={linhaWhats}><MessageCircle size={13} /> WhatsApp</span>}
                    </>;
                    return abaixo ? (
                      <a key={j.join()} href={whatsappUrl(msgBrecha({ aptos: aptos.slice(0, 3).map(a => a.nome), ci: j[0], co: j[1], noites: n, hospedes: hosp }))} target="_blank" rel="noopener noreferrer" style={cartaoOpcao(false, true)}>{corpo}</a>
                    ) : (
                      <button key={j.join()} type="button" onClick={() => escolherJanela(j)} aria-pressed={ativo} style={cartaoOpcao(ativo)}>{corpo}</button>
                    );
                  })}
                </div>
              </>)}
            </div>
          );
          return <>
            {(!visiveis.length || !naBase) && caixaAlt}
            <div ref={listaRef} />
            {gruposOrdenados.map(g => <PropertyGroup key={g.residencial.id} g={g} last={g.residencial.id === idUltimoVisivel} />)}
            {visiveis.length > 0 && naBase && caixaAlt}
          </>;
        })()}

        {/* ══ "OUTROS APARTAMENTOS" — com um filtro de categoria ativo, mostra
            abaixo o complemento (o que ficou fora do filtro), sem reordenar
            nem esconder nada: são DUAS apresentações separadas na tela, a do
            filtro e a das demais opções, a pedido do Caio (2026-09-26) —
            antes, escolher um filtro fazia o resto do site "desaparecer" e
            passava a impressão de que não havia mais nada disponível. ══ */}
        {(() => {
          const outrosVisiveis = groups.filter(g => g.withInfo.some(w => !noTopo(w)));
          if ((!activeCategory && !valid) || !outrosVisiveis.length) return null;
          const idUltimoOutro = outrosVisiveis[outrosVisiveis.length - 1].residencial.id;
          return (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                <div aria-hidden style={{ flex: 1, height: 1, background: BORDER }} />
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: GREY, whiteSpace: 'nowrap' }}>{valid && !activeCategory ? tr('ps_indisp_titulo') : tr('ps_outros_apartamentos')}</div>
                <div aria-hidden style={{ flex: 1, height: 1, background: BORDER }} />
              </div>
              <div style={{ fontSize: 16, color: GREY, textAlign: 'center', marginBottom: 36 }}>{valid && !activeCategory ? (noitesBusca < noitesPedido ? tr('ps_indisp_desc_brechas', tr('noites', noitesBusca)) : tr('ps_indisp_desc')) : tr('ps_outros_apartamentos_desc')}</div>
              {groups.map(g => <PropertyGroup key={`outros-${g.residencial.id}`} g={g} invert last={g.residencial.id === idUltimoOutro} />)}
            </div>
          );
        })()}
      </main>

      {/* ══ DESTINATION (partilhado — mesma zona/praia para os dois imóveis) ══ */}
      <DestinoSection residenciais={data.residenciais} lang={lang} setLang={setLang} idiomasAtivos={idiomasAtivos} />

      {/* ══ FOOTER — assinatura do grupo, residenciais e faixa como remate ══ */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, background: LIGHT }}>
        <div className="pm-pubsite-footer-grid" style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 40 }}>
          <div>
            <GroupLogo variant="principal" size={26} />
            <div style={{ fontSize: 17, color: GREY, marginTop: 18, lineHeight: 1.6 }}>{tr('ps_essencia')}</div>
          </div>
          {data.residenciais.map(r => (
            <div key={r.id}>
              <div style={{ fontSize: 17, fontWeight: 500, color: BLACK, marginBottom: 10 }}>{r.nome}</div>
              <div style={{ fontSize: 16, color: GREY, lineHeight: 1.9 }}>
                <div>{r.endereco}</div>
                <div>{r.cidade}</div>
                <a href={whatsappUrl(msgGeral(r.nome))} target="_blank" rel="noopener noreferrer" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, color: C.sucesso, fontWeight: 600, textDecoration: 'none' }}>
                  <MessageCircle size={15} strokeWidth={1.5} /> WhatsApp
                </a>
              </div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 16, fontWeight: 400, letterSpacing: '.2em', textTransform: 'uppercase', color: GREY, marginBottom: 14 }}>{tr('ps_horarios')}</div>
            <div style={{ fontSize: 17, color: GREY, lineHeight: 1.9 }}>
              {/* um único horário: os residenciais usam o mesmo (a pedido do Caio, 2026-11-26) */}
              <div>{tr('ps_checkin_a_partir', data.residenciais[0]?.checkInHora || '14:00')}</div>
              <div>{tr('ps_checkout_ate', data.residenciais[0]?.checkOutHora || '10:00')}</div>
            </div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 32px', textAlign: 'center', fontSize: 16, color: GREY, letterSpacing: '.12em', textTransform: 'uppercase' }}>
          © {new Date().getFullYear()} Grupo PinheiraMar
          {/* links das políticas e da privacidade (LGPD) */}
          <nav aria-label={tr('ps_rodape_politicas')} style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', columnGap: 24, marginTop: 4, letterSpacing: 0, textTransform: 'none', fontSize: 16 }}>
            <a href="/?politicas" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: BLACK, textDecoration: 'underline' }}>{tr('ps_rodape_politicas')}</a>
            <a href="/?politicas#privacidade" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: BLACK, textDecoration: 'underline' }}>{tr('ps_rodape_privacidade')}</a>
          </nav>
        </div>
        <Faixa height={6} />
      </footer>
      {done && <ConfirmationModal info={done.info} paymentStatus={done.paymentStatus} onClose={() => { setDone(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
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
      <BotaoWhatsApp rotulo={tr('ap_fale_whatsapp')} />
    </div>
  );
}
