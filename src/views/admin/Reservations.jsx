import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Search, Download, Upload, Database, Pencil, Trash2, Copy, ChevronDown,
  X, Check, AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Minus, Tag,
  Clock, Info, Users, Wallet, LogIn, LogOut, Car, Sparkles, PawPrint, Umbrella,
  BedDouble, Baby, Percent, Wind, Waves, Utensils, Wifi, Flame, Shield, Gift,
  Sun, Shirt, Sofa, Power } from 'lucide-react';
import { C, F, THEMES } from '../../lib/constants';
import { money, nights, ymd, today, parseYMD, fmtShort, uid, code, isAvailable, stayBreakdown,
  nightlyRate, addDays, holidaysOn, HOLIDAY_LABELS, WD, HOLIDAY_COLORS, MS,
  seasonForDate, aptRates, roomFullName, overlaps, capacidadeBaseOf } from '../../lib/helpers';
import { buildCSV, downloadBlob, rowToReserva, PAISES, reservaToRow, CSV_COLS } from '../../lib/csvUtils';
import { Card, PageHead, Badge, Btn, Modal, Field, TextInput, DateInput, Select, Textarea, duplicateInList,
  Note, STATUS, ConfirmDialog, CheckinBadge, CheckoutBadge, barBackground, displayStatus } from '../../components/ui';
import { moverPorId } from '../../hooks/useReorder';
import { enviarConfirmacaoReserva, encerrarTodasSessoes, carregarAdmin } from '../../lib/dadosAdmin';
import { migrarDados } from '../../lib/migracoes';
import { extrasObrigatorios, quantidadeTaxa } from '../../lib/precos';
import { aplicarEdicaoReserva } from '../../lib/reservas';

// A biblioteca do Excel é pesada (~400 KB): só é descarregada quando o
// gestor exporta ou importa uma planilha.
const carregarXLSX = () => import('xlsx');

// Motivos devolvidos pelo servidor quando o e-mail de confirmação não sai.
export function textoFalhaEmail(motivo) {
  return ({
    nao_configurado: 'o envio de e-mails não está configurado no servidor',
    sem_email: 'a reserva não tem e-mail',
    recusado: 'o EmailJS recusou o envio',
    rede: 'sem conexão com o servidor',
    demo: 'modo demonstração — nenhum e-mail é enviado',
    nao_autorizado: 'a sessão expirou — entre de novo no painel',
    http_401: 'a sessão expirou — entre de novo no painel',
    reserva_nao_encontrada: 'a reserva ainda não está salva no servidor',
    reserva_cancelada: 'a reserva está cancelada',
    reserva_bloqueio: 'é um bloqueio, não uma reserva de hóspede',
    configuracao_pendente: 'falta aplicar o SQL de segurança no Supabase (README, passo 6)',
    servico_indisponivel: 'o servidor não conseguiu ler os dados agora',
  })[motivo] || (motivo ? `erro: ${motivo}` : 'erro desconhecido');
}

// residencial de um apartamento — usado para a etiqueta de cor por imóvel
// (este ambiente é partilhado pelos dois residenciais; a etiqueta é só
// para identificação visual, ver pedido do gestor).
const residencialOf = (data, apt) => (data.residenciais || []).find(r => r.id === apt?.residencialId) || (data.residenciais || [])[0];
const residencialCor = (residencialId) => (THEMES[residencialId] || THEMES.pinheiramar).ocean;

// Ícone intuitivo por palavra-chave no nome da taxa/extra — substitui o texto
// truncado nos botões de atalho por Ícone + valor (pedido do Caio, 2026-09-23:
// "limpa um pouco a tela e simplifica o uso"). O nome completo e
// Obrigatória/Opcional continuam disponíveis no title (tooltip) do botão.
const EXTRA_ICON_RULES = [
  [/estacionamento|vaga|carro|garagem/i, Car],
  [/higieniz|limpeza|faxina|servi[cç]/i, Sparkles],
  [/pet|animal|cachorro|gato/i, PawPrint],
  [/pra(i|í)a|guarda.?sol|piscina|toalha/i, Umbrella],
  [/beb[eê]|bab[aá]/i, Baby],
  [/cama|colch[aã]o|ber[cç]o/i, BedDouble],
  [/desconto|taxa [uú]nica|comiss[aã]o/i, Percent],
  [/ar.?condicionado|climatiz|ventilad/i, Wind],
  [/mar|vista|onda/i, Waves],
  [/churrasco|jantar|refei[cç][aã]o|almo[cç]o|café da manhã/i, Utensils],
  [/wifi|internet/i, Wifi],
  [/lareira|aquecedor|aquecim/i, Flame],
  [/seguro|garantia|prote[cç][aã]o/i, Shield],
  [/kit|presente|brinde/i, Gift],
  [/sol|ver[aã]o/i, Sun],
  [/roupa|enxoval/i, Shirt],
  [/sof[aá]/i, Sofa],
];
const iconForExtra = (nome = '') => (EXTRA_ICON_RULES.find(([re]) => re.test(nome)) || [])[1] || Tag;

// Normaliza qualquer valor em "YYYY-MM-DD" sem nunca lançar exceção — usado
// para a data dos lançamentos do histórico de pagamentos. CORREÇÃO URGENTE
// (2026-09-23): `criadoEm` de reservas antigas (importação histórica) nem
// sempre é uma string "YYYY-MM-DD" limpa (pode faltar, vir noutro formato,
// etc.) — parseYMD (helpers.js) assume sempre uma string e faz s.split('-'),
// o que rebentava (tela em branco) ao abrir ou editar pagamentos de
// qualquer reserva cujo criadoEm não estivesse nesse formato exato.
const safeYmd = (v) => {
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = v ? new Date(v) : null;
  if (d && !isNaN(d.getTime())) return ymd(d);
  return ymd(today());
};

// Cores de fundo das colunas do calendário. As faixas de fim-de-semana e de
// feriado ajudam a ler o mês de relance e ficam como sempre estiveram; o dia
// de hoje ganha verde-pastel e tem precedência sobre as duas, que é o que
// faltava distingui-lo. As barras das reservas são opacas e desenhadas por
// cima, portanto nenhuma destas faixas as corta.
const FIM_DE_SEMANA_CABECALHO = 'rgba(231,215,182,.25)';
const FIM_DE_SEMANA_CELULA = 'rgba(231,215,182,.13)';
const FERIADO_CABECALHO = 'rgba(62,124,177,.10)';
const FERIADO_CELULA = 'rgba(62,124,177,.07)';
const HOJE_CABECALHO = '#CDEBCF';
const HOJE_CELULA = '#EDF7EE';
const HOJE_TEXTO = '#1C7A4B';

const residencialSigla = (nome = '') => nome.replace(/^Residencial\s+/i, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '—';

// Marca de cada residencial — o galo do PinheiraMar, as ondas do Caminho do
// Mar. Reconhece-se de relance, ao contrário do monograma ("P"/"CD"), que
// obrigava a decifrar. Um residencial sem marca própria cai no monograma.
const RESIDENCIAL_ICONE = { pinheiramar: '/logo-icon-pinheiramar.png', novoimovel: '/logo-icon-caminho.png' };

function ResBadge({ residencial }) {
  if (!residencial) return null;
  const icone = RESIDENCIAL_ICONE[residencial.id];
  if (icone) return (
    <img src={icone} alt="" title={residencial.nome}
      style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0, display: 'block' }}
      onError={e => { e.target.style.display = 'none'; }} />
  );
  return (
    <span title={residencial.nome} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', fontSize: 9.5, fontWeight: 800, color: '#fff', background: residencialCor(residencial.id), flexShrink: 0 }}>
      {residencialSigla(residencial.nome)}
    </span>
  );
}

// etiqueta com o nome completo (usada onde há mais espaço, ex.: tabela)
function ResPill({ residencial }) {
  if (!residencial) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, letterSpacing: '.02em', color: '#fff', background: residencialCor(residencial.id), borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>
      {residencial.nome}
    </span>
  );
}

export function Reservations({ data, update, openReservationId, onOpenedReservation }) {
  const [view, setView] = useState('calendario');
  // O calendário abre sempre a partir do dia de hoje (não do dia 1 do mês) —
  // a pedido do Caio (2026-09-26).
  const [start, setStart] = useState(() => today());
  const [showPrices, setShowPrices] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // reserva pendente de eliminação rápida a partir da lista
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const monthPickerRef = useRef(null);
  // campo de pesquisa global (código, hóspede, apartamento, etc.) — a pedido
  // do Caio (2026-09-24), para localizar rapidamente uma reserva sem ter de
  // percorrer o calendário/lista manualmente
  const [search, setSearch] = useState('');

  // abre diretamente uma reserva vinda do Painel de controle (cliques em
  // "Próximos check-ins/check-outs") — ver Dashboard.jsx e Admin.jsx
  useEffect(() => {
    if (!openReservationId) return;
    const r = data.reservas.find(x => x.id === openReservationId);
    if (r) setEditing(r);
    onOpenedReservation?.();
  }, [openReservationId]);

  const COLW = 38, NAMEW = 170; // reduzido para mostrar mais dias do mês sem rolar tanto
  // Número de dias mostrados = dias no mês de `start`. Ao escolher um mês no
  // seletor, `start` fica no dia 1 desse mês, logo mostra 1 a 28-31 (mês
  // inteiro). Ao navegar pelas setas < > (shiftWeek, 7 em 7 dias), `start`
  // deixa de ser sempre o dia 1 — a janela desliza em blocos de 7 dias e pode
  // atravessar a fronteira do mês (o monthLabel abaixo já trata esse caso).

  // largura disponível para o calendário — usada para, em monitores largos,
  // preencher o espaço sobrando com mais dias em vez de deixar uma faixa em
  // branco à direita do último dia visível (a pedido do Caio)
  const calRef = useRef(null);
  const [calWidth, setCalWidth] = useState(0);
  useEffect(() => {
    const el = calRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width;
      if (typeof w === 'number') setCalWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const daysInMonth = useMemo(() => new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate(), [start]);
  const fitCols = calWidth > 0 ? Math.floor((calWidth - NAMEW) / COLW) : 0;
  const DAYS = Math.max(daysInMonth, fitCols);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(start, i)), [start, DAYS]);
  const aptName = (id) => data.apartamentos.find(a => a.id === id)?.nome || '—';
  const aptResidencial = (id) => residencialOf(data, data.apartamentos.find(a => a.id === id));
  const cap1 = (str) => str.charAt(0).toUpperCase() + str.slice(1);
  const monthLabel = useMemo(() => {
    const a = days[0], b = days[days.length - 1];
    const mName = (d) => cap1(d.toLocaleDateString('pt-BR', { month: 'long' }));
    const ya = a.getFullYear(), yb = b.getFullYear();
    if (a.getMonth() === b.getMonth() && ya === yb) return `${mName(a)} de ${ya}`;
    if (ya === yb) return `${mName(a)} – ${mName(b)} de ${ya}`;
    return `${mName(a)} ${ya} – ${mName(b)} ${yb}`;
  }, [days]);

  /* jump to start of a given month/year */
  const jumpToMonth = (year, month) => {
    setStart(new Date(year, month, 1));
    setMonthPickerOpen(false);
  };
  /* avança/recua a janela do calendário de 7 em 7 dias (a pedido do Caio) —
     a escolha de mês no seletor continua a mostrar o mês inteiro (1 a 31),
     isto só afeta as setas < > ao lado do botão "Hoje". */
  const shiftWeek = (delta) => {
    setStart(d => addDays(d, 7 * delta));
  };

  /* close picker on outside click */
  useEffect(() => {
    if (!monthPickerOpen) return;
    const handler = (e) => { if (monthPickerRef.current && !monthPickerRef.current.contains(e.target)) setMonthPickerOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [monthPickerOpen]);

  const openNew = (aptId, dObj, endDObj, status) => {
    setPrefill(aptId ? { apartamentoId: aptId, checkIn: ymd(dObj), checkOut: ymd(addDays(endDObj || dObj, 1)), ...(status ? { status } : {}) } : null);
    setEditing('new');
  };

  // ── seleção por arrastar no calendário (clicar e arrastar de uma data a
  // outra, à semelhança do Wix) — ao soltar o rato sobre mais de um dia,
  // mostra um menu rápido para criar reserva, aplicar uma tarifa pontual
  // ou bloquear o período; um clique simples (sem arrastar) mantém o
  // comportamento antigo de abrir logo uma nova reserva nesse dia ──
  const [dragSel, setDragSel] = useState(null); // { aptId, startIdx, endIdx } enquanto arrasta
  const [rangeMenu, setRangeMenu] = useState(null); // { aptId, startIdx, endIdx, x, y } menu aberto
  const [quickRate, setQuickRate] = useState(null); // { aptId, startIdx, endIdx } modal de tarifa rápida

  useEffect(() => {
    if (!dragSel) return;
    const onUp = (e) => {
      const lo = Math.min(dragSel.startIdx, dragSel.endIdx), hi = Math.max(dragSel.startIdx, dragSel.endIdx);
      if (lo === hi) {
        openNew(dragSel.aptId, days[lo]);
      } else {
        const x = Math.min(e.clientX, window.innerWidth - 240);
        const y = Math.min(e.clientY, window.innerHeight - 180);
        setRangeMenu({ aptId: dragSel.aptId, startIdx: lo, endIdx: hi, x, y });
      }
      setDragSel(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [dragSel, days]);

  // `original` = a reserva tal como estava quando o formulário abriu: só o
  // que o gestor mudou é aplicado sobre a versão mais recente do banco (ver
  // aplicarEdicaoReserva em lib/reservas.js). O e-mail de uma reserva nova
  // sai pelo servidor, e só depois de a reserva estar gravada.
  const save = (r, { original, enviarEmailAoGravar = false } = {}) => {
    const p = update(prev => {
      const atual = prev.reservas.find(x => x.id === r.id);
      if (!atual) return { ...prev, reservas: [...prev.reservas, r] };
      const atualizada = aplicarEdicaoReserva(atual, original, r);
      // Reserva conjunta: salvar uma metade \"adota-a\" (tira o prazo de
      // expiração — ver aplicarEdicaoReserva) para que ela não desapareça
      // sozinha na arrumação automática. Antes isso só valia para a metade
      // editada: a outra, nunca tocada, continuava com prazo e podia sumir
      // sozinha depois, mesmo fazendo parte da MESMA reserva — a pedido do
      // Caio (2026-09-26), agora as duas são adotadas juntas.
      const foiAdotada = atual.expiraEm && !atualizada.expiraEm;
      const reservas = prev.reservas.map(x => {
        if (x.id === r.id) return atualizada;
        if (foiAdotada && atualizada.pagamentoRef && x.pagamentoRef === atualizada.pagamentoRef && x.expiraEm) {
          return { ...x, expiraEm: null };
        }
        return x;
      });
      return { ...prev, reservas };
    });
    setEditing(null); setPrefill(null);
    if (enviarEmailAoGravar) {
      p.then(() => enviarConfirmacaoReserva(r.id))
        .then(res => setImportMsg(res.ok
          ? { ok: true, text: `E-mail de confirmação enviado para ${r.email}.` }
          : { ok: false, text: `A reserva foi salva, mas o e-mail de confirmação não saiu (${textoFalhaEmail(res.motivo)}). Pode reenviar pela própria reserva.` }))
        .catch(() => { /* a falha ao salvar já aparece na barra de sincronização */ });
    }
    p.catch(() => {});
    return p;
  };
  const duplicate = (id) => update(prev => ({ ...prev, reservas: duplicateInList(prev.reservas, id, r => ({ ...r, id: uid(), codigo: code(), status: 'pendente', extras: (r.extras || []).map(e => ({ ...e, id: uid() })) })) }));
  const remove = (id) => { update(prev => ({ ...prev, reservas: prev.reservas.filter(x => x.id !== id) })); setEditing(null); };

  // ── Base de dados: exportar / importar ──
  const fileRef = useRef(null);
  const [dbOpen, setDbOpen] = useState(false);
  const [importMsg, setImportMsg] = useState(null); // { ok, text }

  const [restaurar, setRestaurar] = useState(null); // { obj, nome } — backup JSON à espera de confirmação
  const carimbo = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

  // Encerrar todas as sessões do painel (kill switch) — para quando se quer
  // ter a certeza de que nenhuma aba antiga fica aberta gravando por cima,
  // ex.: antes de aplicar uma migração de banco. Desconecta TODOS os
  // administradores agora, inclusive quem aciona.
  const [confirmEncerrarSessoes, setConfirmEncerrarSessoes] = useState(false);
  const [encerrandoSessoes, setEncerrandoSessoes] = useState(false);
  const acionarEncerrarSessoes = async () => {
    setConfirmEncerrarSessoes(false);
    setEncerrandoSessoes(true);
    const r = await encerrarTodasSessoes();
    setEncerrandoSessoes(false);
    setImportMsg(r.ok
      ? { ok: true, text: `Sessões encerradas (${r.contas ?? '?'} conta(s) de administrador). Recarregue a página para entrar de novo.` }
      : { ok: false, text: `Não foi possível encerrar as sessões (${r.motivo || 'erro'}).` });
  };
  const exportCSV = () => downloadBlob(buildCSV(data.reservas, data.apartamentos), 'reservas-pinheiramar.csv', 'text/csv;charset=utf-8');
  const exportJSON = () => downloadBlob(JSON.stringify(data, null, 2), `pinheiramar-backup-${carimbo()}.json`, 'application/json');
  const exportXLSX = async () => {
    try {
      const XLSX = await carregarXLSX();
      const rows = data.reservas.map(r => reservaToRow(r, data.apartamentos));
      const ws = XLSX.utils.json_to_sheet(rows, { header: CSV_COLS });
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Reservations');
      downloadBlob(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), 'reservas-pinheiramar.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) { setImportMsg({ ok: false, text: 'Não foi possível gerar o Excel: ' + err.message }); }
  };

  const onPickFile = (e) => {
    const file = e.target.files?.[0]; e.target.value = ''; setDbOpen(false);
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const bruto = JSON.parse(reader.result);
          const obj = bruto?.data && Array.isArray(bruto.data.reservas) ? bruto.data : bruto;
          if (!obj || !Array.isArray(obj.apartamentos) || !Array.isArray(obj.reservas)) throw new Error('estrutura não reconhecida');
          // Restaurar SUBSTITUI tudo — antes acontecia logo ao escolher o
          // arquivo, sem perguntar. Agora pede confirmação (ver abaixo).
          setRestaurar({ obj, nome: file.name });
        } catch (err) { setImportMsg({ ok: false, text: 'JSON inválido: ' + err.message }); }
      };
      reader.readAsText(file); return;
    }
    (async () => {
      try {
        const XLSX = await carregarXLSX();
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
        const existing = new Set(data.reservas.map(r => r.codigo));
        const novos = []; let skipped = 0;
        rows.forEach(row => {
          const r = rowToReserva(row, data.apartamentos);
          if (!r || existing.has(r.codigo)) { skipped++; return; }
          // O total da planilha já é o valor final da reserva: as taxas
          // obrigatórias NÃO são somadas por cima (antes eram, e o total
          // importado ficava maior do que o real — decisão do Caio,
          // 2026-09-26). O sinal usa a % do residencial (antes, 50% fixo).
          const resid = residencialOf(data, data.apartamentos.find(a => a.id === r.apartamentoId));
          r.sinal = Math.round(r.total * ((Number(resid?.sinalPct) || 50) / 100));
          existing.add(r.codigo); novos.push(r);
        });
        if (novos.length) {
          update(prev => {
            const ja = new Set(prev.reservas.map(x => x.codigo));
            return { ...prev, reservas: [...prev.reservas, ...novos.filter(x => !ja.has(x.codigo))] };
          }).catch(() => {});
        }
        setImportMsg({ ok: novos.length > 0, text: `Importação concluída — ${novos.length} reserva(s) adicionada(s)${skipped ? `, ${skipped} ignorada(s) (duplicadas ou apartamento não encontrado)` : ''}.` });
      } catch (err) { setImportMsg({ ok: false, text: 'Não foi possível ler o arquivo: ' + err.message }); }
    })();
  };

  const DB_ACTIONS = [
    ['Importar (Excel / CSV / JSON)', () => { fileRef.current?.click(); }, Upload],
    ['Exportar Excel (.xlsx)', () => { exportXLSX(); setDbOpen(false); }, Download],
    ['Exportar CSV', () => { exportCSV(); setDbOpen(false); }, Download],
    ['Backup completo (JSON)', () => { exportJSON(); setDbOpen(false); }, Database],
    [encerrandoSessoes ? 'Encerrando sessões…' : 'Encerrar todas as sessões do painel',
      () => { if (encerrandoSessoes) return; setDbOpen(false); setConfirmEncerrarSessoes(true); }, Power],
  ];

  const [manualOrder, setManualOrder] = useState(false);
  // Ordem manual da lista: arrastar uma linha para cima de outra. (Antes
  // chamava funções que o useReorder não tem e dava erro ao arrastar.)
  // Grava só "mover esta para ali" sobre a lista mais recente.
  const [arrastoRes, setArrastoRes] = useState({ de: null, sobre: null });
  const soltarRes = () => {
    const { de, sobre } = arrastoRes;
    setArrastoRes({ de: null, sobre: null });
    if (de && sobre && de !== sobre) update(prev => ({ ...prev, reservas: moverPorId(prev.reservas, de, sobre) })).catch(() => {});
  };
  // Ordenação por coluna na Lista — clicar num cabeçalho ordena por ele
  // (clicar de novo inverte), a pedido do Caio (2026-09-24), para poder
  // analisar a partir da coluna que precisar em cada momento. 'checkIn' é o
  // padrão (o antigo comportamento fixo), sempre descendente ao trocar de
  // coluna por padrão, exceto texto (nome/código/etc.), que começa ascendente.
  const [sortKey, setSortKey] = useState('checkIn');
  const [sortDir, setSortDir] = useState('desc');
  const SORT_ACCESSORS = {
    codigo: r => r.codigo || '',
    residencial: r => aptResidencial(r.apartamentoId)?.nome || '',
    apartamento: r => aptName(r.apartamentoId) || '',
    hospede: r => r.hospede || '',
    checkIn: r => parseYMD(r.checkIn).getTime(),
    origem: r => r.origem || '',
    total: r => Number(r.total) || 0,
    valorPago: r => Number(r.valorPago) || 0,
    estado: r => displayStatus(r) || '',
  };
  const sortByColumn = (key) => {
    setManualOrder(false);
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return; }
    setSortKey(key);
    setSortDir(key === 'total' || key === 'valorPago' || key === 'checkIn' ? 'desc' : 'asc');
  };
  // normaliza texto (minúsculas, sem acentos) para a pesquisa funcionar com
  // ou sem acentuação
  const normTxt = (v) => (v ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const searchNorm = normTxt(search.trim());
  const matchesSearch = (r) => {
    if (!searchNorm) return true;
    const hay = normTxt([r.codigo, r.hospede, r.nome, r.sobrenome, aptName(r.apartamentoId),
      aptResidencial(r.apartamentoId)?.nome, r.origem, displayStatus(r), r.email, r.telefone,
      r.pais, r.nota].filter(Boolean).join(' '));
    return hay.includes(searchNorm);
  };
  // resultados para o dropdown de pesquisa rápida (todas as reservas, não só
  // as 300 mais recentes da tabela) — só calculado quando há texto digitado
  const searchMatches = searchNorm
    ? data.reservas.filter(matchesSearch).sort((a, b) => parseYMD(b.checkIn) - parseYMD(a.checkIn))
    : [];

  const listSorted = manualOrder
    ? data.reservas
    : [...data.reservas].sort((a, b) => {
        const av = SORT_ACCESSORS[sortKey](a), bv = SORT_ACCESSORS[sortKey](b);
        const r = typeof av === 'string' ? av.localeCompare(bv, 'pt') : av - bv;
        return sortDir === 'asc' ? r : -r;
      });
  // 'todas' | 'sem' (0 pago, sem confirmação) | 'com' (algum pagamento já
  // recebido — é isso que caracteriza uma reserva de facto, a pedido do
  // Caio). Bloqueios ficam de fora dos dois filtros de pagamento: não são
  // reservas de hóspede, não têm o que confirmar.
  const [paymentFilter, setPaymentFilter] = useState('todas');
  // filtro por status (Confirmado/Reservado/Pendente/Bloqueio/Cancelada) na
  // Lista — a pedido do Caio (2026-09-24), mesmas categorias do quadro
  // "Reservas por status" do Financeiro, somado ao filtro de pagamento já
  // existente (não o substitui)
  const [statusFilter, setStatusFilter] = useState('todas');
  const listFiltered = (paymentFilter === 'todas' ? listSorted
    : listSorted.filter(r => r.status !== 'bloqueio' && (paymentFilter === 'sem' ? (Number(r.valorPago) || 0) <= 0 : (Number(r.valorPago) || 0) > 0)))
    .filter(r => statusFilter === 'todas' || r.status === statusFilter)
    .filter(matchesSearch);
  const listCap = 300;

  return (
    <div>
      <PageHead title="Reservas" sub="Calendário de ocupação e gestão de reservas"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Btn variant="ghost" icon={Database} onClick={() => setDbOpen(o => !o)}>Base de dados <ChevronDown size={14} style={{ marginLeft: 2 }} /></Btn>
              {dbOpen && (
                <div onMouseLeave={() => setDbOpen(false)} style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 14px 34px rgba(10,40,46,.18)', padding: 6, zIndex: 30, width: 248 }}>
                  {DB_ACTIONS.map(([label, fn, Ic], idx) => (
                    <button key={idx} onClick={fn} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: C.ink, textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = C.espuma} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <Ic size={15} color={C.brisa} /> {label}
                    </button>
                  ))}
                  <div style={{ fontSize: 11, color: C.inkSoft, padding: '6px 10px 4px', borderTop: `1px solid ${C.line}`, marginTop: 4 }}>Pode importar diretamente o seu ficheiro <b>reservations.xlsx</b>.</div>
                </div>
              )}
            </div>
            <Btn icon={Plus} onClick={() => openNew(null, today())}>Nova reserva</Btn>
          </div>
        } />
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.json" style={{ display: 'none' }} onChange={onPickFile} />
      {importMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '11px 14px', borderRadius: 12, fontSize: 13.5, fontWeight: 500, background: importMsg.ok ? '#E1F0EC' : '#F7E9E9', color: importMsg.ok ? '#1C7A5B' : '#B23B3B' }}>
          {importMsg.ok ? <Check size={16} /> : <AlertCircle size={16} />}
          <span style={{ flex: 1 }}>{importMsg.text}</span>
          <button onClick={() => setImportMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'grid', placeItems: 'center' }}><X size={15} /></button>
        </div>
      )}

      <Card className="pm-res-toolbar" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="pm-res-toggle" style={{ display: 'flex', background: C.espuma, borderRadius: 10, padding: 3 }}>
          {['calendario', 'lista'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, background: view === v ? '#fff' : 'transparent', color: view === v ? C.ocean : C.inkSoft, boxShadow: view === v ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>{v === 'calendario' ? 'Calendário' : 'Lista'}</button>
          ))}
        </div>

        {/* pesquisa global de reservas (código, hóspede, apartamento, e-mail,
            telefone, origem, estado…) — a pedido do Caio (2026-09-24).
            Funciona nas duas vistas: filtra a tabela na Lista, e mostra um
            dropdown de atalho para abrir a reserva diretamente a partir do
            Calendário. */}
        <div style={{ position: 'relative' }}>
          <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <TextInput value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar código, hóspede, apartamento…"
            style={{ width: 260, height: 34, paddingLeft: 30, fontSize: 13 }} />
          {search.trim() && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 14px 34px rgba(10,40,46,.18)', width: 340, maxHeight: 340, overflowY: 'auto' }}>
              {searchMatches.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 13, color: C.inkSoft }}>Nenhuma reserva encontrada.</div>
              ) : <>
                {searchMatches.slice(0, 8).map(r => (
                  <button key={r.id} onClick={() => { setEditing(r); setSearch(''); }}
                    style={{ width: '100%', textAlign: 'left', display: 'block', padding: '9px 12px', background: 'none', border: 'none', borderBottom: `1px solid ${C.line}`, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.espuma} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: F.disp, fontSize: 12.5, color: C.ocean }}>{r.codigo}</span>
                      <span style={{ fontSize: 11.5, color: C.inkSoft, whiteSpace: 'nowrap' }}>{fmtShort(r.checkIn)} → {fmtShort(r.checkOut)}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{r.status === 'bloqueio' ? '⛔ Bloqueio' : (r.hospede || '—')}</div>
                    <div style={{ fontSize: 11.5, color: C.inkSoft }}>{aptName(r.apartamentoId)}</div>
                  </button>
                ))}
                {searchMatches.length > 8 && (
                  <div style={{ padding: '8px 12px', fontSize: 11.5, color: C.inkSoft }}>
                    +{searchMatches.length - 8} resultado(s) — refine a pesquisa {view !== 'lista' && 'ou veja na Lista'}.
                  </div>
                )}
              </>}
            </div>
          )}
        </div>
        {view === 'calendario' && <>
          {/* ── mês/ano clicável com dropdown picker ── */}
          <div className="pm-res-monthpicker" style={{ position: 'relative', marginLeft: 8 }} ref={monthPickerRef}>
            <button onClick={() => setMonthPickerOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: monthPickerOpen ? C.espuma : 'none', border: `1px solid ${monthPickerOpen ? C.line : 'transparent'}`, borderRadius: 10, padding: '5px 12px', cursor: 'pointer', fontFamily: F.disp, fontSize: 17, fontWeight: 600, color: C.ocean }}>
              <CalendarDays size={16} color={C.brisa} />
              {monthLabel}
              <ChevronDown size={14} color={C.brisa} style={{ transform: monthPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>

            {monthPickerOpen && (
              <div className="pm-pop" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 200, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, boxShadow: '0 12px 36px rgba(10,40,46,.16)', padding: 18, minWidth: 280 }}>
                {/* year navigation */}
                {(() => {
                  const pickerYear = start.getFullYear();
                  const pickerMonth = start.getMonth();
                  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                  const td = today();
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <button onClick={() => { const d = new Date(start); d.setFullYear(d.getFullYear()-1); setStart(new Date(d.getFullYear(), d.getMonth(), 1)); }}
                          style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.inkSoft }}>
                          <ChevronLeft size={15} />
                        </button>
                        <span style={{ fontFamily: F.disp, fontSize: 18, fontWeight: 700, color: C.ink }}>{pickerYear}</span>
                        <button onClick={() => { const d = new Date(start); d.setFullYear(d.getFullYear()+1); setStart(new Date(d.getFullYear(), d.getMonth(), 1)); }}
                          style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.inkSoft }}>
                          <ChevronRight size={15} />
                        </button>
                      </div>
                      {/* month grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {MONTHS.map((m, idx) => {
                          const isThisMonth = pickerYear === td.getFullYear() && idx === td.getMonth();
                          const active = idx === pickerMonth;
                          return (
                            <button key={m} onClick={() => jumpToMonth(pickerYear, idx)}
                              style={{ padding: '9px 4px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: active ? 700 : 500,
                                background: active ? C.ocean : (isThisMonth ? C.espuma : 'transparent'),
                                color: active ? '#fff' : (isThisMonth ? C.ocean : C.ink),
                                outline: isThisMonth && !active ? `2px solid ${C.line}` : 'none',
                              }}>
                              {m}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 12, paddingTop: 10, display: 'flex', gap: 6 }}>
                        <button onClick={() => { setStart(today()); setMonthPickerOpen(false); }}
                          style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.ink }}>
                          Hoje
                        </button>
                        <button onClick={() => jumpToMonth(pickerYear, 0)}
                          style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.ink }}>
                          Jan {pickerYear}
                        </button>
                        <button onClick={() => jumpToMonth(pickerYear, 11)}
                          style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.ink }}>
                          Dez {pickerYear}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ── navegação: setas avançam/recuam 7 dias; o seletor de mês (acima)
                 continua a mostrar o mês inteiro quando um mês é escolhido ── */}
          <div className="pm-res-navrow" style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* 7 dias atrás */}
              <button onClick={() => shiftWeek(-1)} title="Recuar 7 dias"
                style={{ height: 32, padding: '0 10px', border: `1px solid ${C.line}`, borderRadius: '8px 0 0 8px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', color: C.inkSoft }}>
                <ChevronLeft size={14} />
              </button>
              {/* hoje */}
              <button onClick={() => setStart(today())} title="Ir para o dia atual"
                style={{ height: 32, padding: '0 12px', border: `1px solid ${C.line}`, borderLeft: 'none', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.ink }}>
                Hoje
              </button>
              {/* 7 dias à frente */}
              <button onClick={() => shiftWeek(1)} title="Avançar 7 dias"
                style={{ height: 32, padding: '0 10px', border: `1px solid ${C.line}`, borderLeft: 'none', borderRadius: '0 8px 8px 0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', color: C.inkSoft }}>
                <ChevronRight size={14} />
              </button>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: C.inkSoft, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={showPrices} onChange={e => setShowPrices(e.target.checked)} /> Mostrar preços
            </label>
          </div>
        </>}
      </Card>

      {view === 'calendario' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div ref={calRef} style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: NAMEW + DAYS * COLW }}>
              {/* header */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${C.line}`, background: C.espuma, position: 'sticky', top: 0 }}>
                <div style={{ width: NAMEW, flexShrink: 0, padding: '10px 14px', fontSize: 12.5, fontWeight: 700, color: C.inkSoft, borderRight: `1px solid ${C.line}` }}>Apartamento</div>
                {days.map((d, i) => {
                  const we = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = ymd(d) === ymd(today());
                  const hol = holidaysOn(d);
                  // dias além do mês âncora (`start`) — preenchimento do espaço sobrando
                  // num monitor largo; marcados com opacidade reduzida e uma divisória
                  // no dia 1, para ficar claro que já é o mês seguinte
                  const overflowMonth = d.getMonth() !== start.getMonth() || d.getFullYear() !== start.getFullYear();
                  const monthStart = d.getDate() === 1 && i > 0;
                  return (
                    <div key={i} title={hol ? hol.map(h => `${h.nome} — ${HOLIDAY_LABELS[h.tipo]}`).join(' · ') : ''}
                      style={{ width: COLW, flexShrink: 0, textAlign: 'center', padding: '6px 0 4px',
                        borderLeft: monthStart ? `2px solid ${C.line}` : 'none',
                        opacity: overflowMonth ? 0.6 : 1,
                        background: isToday ? HOJE_CABECALHO : (hol ? FERIADO_CABECALHO : (we ? FIM_DE_SEMANA_CABECALHO : 'transparent')) }}>
                      <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: 'uppercase' }}>
                        {monthStart ? cap1(d.toLocaleDateString('pt-BR', { month: 'short' })).replace('.', '') : WD[d.getDay()]}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: isToday ? 700 : 500, color: isToday ? HOJE_TEXTO : C.ink }}>{d.getDate()}</div>
                      <div style={{ height: 6, marginTop: 1, display: 'flex', justifyContent: 'center', gap: 2 }}>
                        {hol && [...new Set(hol.map(h => h.tipo))].map(tp => <span key={tp} style={{ width: 5, height: 5, borderRadius: '50%', background: HOLIDAY_COLORS[tp] }} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* rows */}
              {data.apartamentos.map(apt => {
                // residencial do apartamento — precisa dele para o sinalPct
                // usado no prefixo "50% " das reservas em estado "Reservado"
                // (ver etiqueta da barra abaixo).
                const residencial = residencialOf(data, apt);
                const segs = data.reservas.filter(r => r.apartamentoId === apt.id && r.status !== 'cancelada').map(r => {
                  const rawS = Math.round((parseYMD(r.checkIn) - start) / MS);
                  const rawE = Math.round((parseYMD(r.checkOut) - start) / MS);
                  // chega a meio do dia de check-in (13h) e sai a meio do dia de check-out (10h)
                  const left = Math.max(0, (rawS + 0.5) * COLW);
                  const right = Math.min(DAYS * COLW, (rawE + 0.5) * COLW);
                  return { r, left, right };
                }).filter(x => x.right - x.left > 4);
                return (
                  <div key={apt.id} style={{ display: 'flex', borderBottom: `1px solid ${C.line}` }}>
                    <div style={{ width: NAMEW, flexShrink: 0, padding: '0 14px', borderRight: `1px solid ${C.line}`, background: '#fff', display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap' }}>{apt.nome}</span>
                        <ResBadge residencial={residencial} />
                        <span style={{ fontSize: 11.5, color: C.inkSoft, whiteSpace: 'nowrap' }}>{apt.capacidade}p</span>
                      </div>
                    </div>
                    <div style={{ position: 'relative', width: DAYS * COLW, flexShrink: 0, height: 40 }}>
                      {/* day cells */}
                      <div style={{ display: 'flex', height: '100%' }}>
                        {days.map((d, i) => {
                          const we = d.getDay() === 0 || d.getDay() === 6;
                          const hol = holidaysOn(d);
                          const isToday = ymd(d) === ymd(today());
                          const inDrag = dragSel && dragSel.aptId === apt.id && i >= Math.min(dragSel.startIdx, dragSel.endIdx) && i <= Math.max(dragSel.startIdx, dragSel.endIdx);
                          const monthStart = d.getDate() === 1 && i > 0;
                          return (
                            <div key={i}
                              onMouseDown={e => { e.preventDefault(); setDragSel({ aptId: apt.id, startIdx: i, endIdx: i }); }}
                              onMouseEnter={() => setDragSel(sel => (sel && sel.aptId === apt.id) ? { ...sel, endIdx: i } : sel)}
                              title="Clique para criar uma reserva, ou arraste para escolher um período"
                              style={{ width: COLW, height: '100%', borderRight: `1px solid ${C.line}`, borderLeft: monthStart ? `2px solid ${C.line}` : 'none', background: inDrag ? 'rgba(46,126,140,.28)' : (isToday ? HOJE_CELULA : (hol ? FERIADO_CELULA : (we ? FIM_DE_SEMANA_CELULA : '#fff'))), cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 10.5, color: C.inkSoft, userSelect: 'none' }}>
                              {showPrices ? money(nightlyRate(apt, data.seasons, d)).replace('R$', '').trim() : ''}
                            </div>
                          );
                        })}
                      </div>
                      {/* reservation bars */}
                      {segs.map(({ r, left, right }) => {
                        // "50% " por escrito, além da cor amarela — a pedido do
                        // Caio, para ficar claro mesmo sem depender só da cor que a
                        // reserva já está em "Reservado" (sinal confirmado).
                        const sinalMark = r.status === 'reservado' ? `${residencial.sinalPct}% ` : '';
                        return (
                          <button key={r.id} onClick={() => setEditing(r)} title={`${r.hospede || 'Bloqueio'} · ${fmtShort(r.checkIn)} (13h) → ${fmtShort(r.checkOut)} (10h)${r.checkinRealizado ? ' · Check-in realizado' : ''}${r.checkoutRealizado ? ' · Check-out realizado' : ''}`}
                            style={{ position: 'absolute', top: 7, height: 36, left: left + 2, width: Math.max(10, right - left - 4), background: barBackground(displayStatus(r)), color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '0 8px', textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', boxShadow: '0 1px 4px rgba(0,0,0,.12)' }}>
                            {r.status === 'bloqueio' ? '⛔ Bloqueio' : `${sinalMark}${r.hospede || 'Reserva'}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pm-res-legend" style={{ display: 'flex', gap: 16, padding: '12px 16px', fontSize: 12.5, color: C.inkSoft, flexWrap: 'wrap', alignItems: 'center', borderTop: `1px solid ${C.line}` }}>
            {Object.entries(STATUS).filter(([k]) => k !== 'cancelada' && k !== 'checkout').map(([k, s]) =>
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: barBackground(k) }} /> {s.label}</span>)}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><LogIn size={12} color="#065F46" /> Check-in realizado</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><LogOut size={12} color="#8A2E2E" /> Check-out realizado</span>
            <span className="pm-hide-sm" style={{ width: 1, height: 16, background: C.line }} />
            {Object.entries(HOLIDAY_LABELS).map(([tp, label]) =>
              <span key={tp} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: HOLIDAY_COLORS[tp] }} /> {label}</span>)}
            <span className="pm-hide-sm" style={{ marginLeft: 'auto' }}>Check-out 10h · check-in 13h — turnover no mesmo dia permitido.</span>
          </div>
          {(() => {
            const items = [];
            days.forEach(d => { const h = holidaysOn(d); if (h) h.forEach(x => items.push({ date: d, ...x })); });
            if (!items.length) return null;
            return (
              <div style={{ borderTop: `1px solid ${C.line}`, padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, marginRight: 2 }}>Feriados no período:</span>
                {items.map((it, idx) => (
                  <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.espuma, borderRadius: 999, padding: '4px 10px', fontSize: 12, color: C.ink }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: HOLIDAY_COLORS[it.tipo] }} />
                    <b style={{ fontWeight: 700 }}>{it.date.getDate()}/{it.date.getMonth() + 1}</b> {it.nome}
                  </span>
                ))}
              </div>
            );
          })()}
        </Card>
      )}

      {/* menu rápido ao soltar o rato após arrastar sobre vários dias —
          "Criar reserva", "Adicionar tarifa rápida" ou "Definir como
          ocupado", à semelhança do Wix */}
      {rangeMenu && (() => {
        const apt = data.apartamentos.find(a => a.id === rangeMenu.aptId);
        const startD = days[rangeMenu.startIdx], endD = days[rangeMenu.endIdx];
        const nNoites = rangeMenu.endIdx - rangeMenu.startIdx + 1;
        const close = () => setRangeMenu(null);
        const itemStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: C.ink, textAlign: 'left' };
        return (
          <>
            <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
            <div className="pm-pop" style={{ position: 'fixed', left: rangeMenu.x, top: rangeMenu.y, zIndex: 151, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 14px 34px rgba(10,40,46,.22)', padding: 6, minWidth: 230 }}>
              <div style={{ padding: '8px 10px 6px', fontSize: 12, color: C.inkSoft, borderBottom: `1px solid ${C.line}`, marginBottom: 4 }}>
                {apt?.nome} · {fmtShort(ymd(startD))} → {fmtShort(ymd(addDays(endD, 1)))} · <b>{nNoites} noite{nNoites > 1 ? 's' : ''}</b>
              </div>
              <button onClick={() => { openNew(rangeMenu.aptId, startD, endD); close(); }} style={itemStyle}
                onMouseEnter={e => e.currentTarget.style.background = C.espuma} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <Plus size={15} color={C.brisa} /> Criar reserva
              </button>
              <button onClick={() => { setQuickRate({ aptId: rangeMenu.aptId, startIdx: rangeMenu.startIdx, endIdx: rangeMenu.endIdx }); close(); }} style={itemStyle}
                onMouseEnter={e => e.currentTarget.style.background = C.espuma} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <Tag size={15} color={C.brisa} /> Adicionar tarifa rápida
              </button>
              <button onClick={() => { openNew(rangeMenu.aptId, startD, endD, 'bloqueio'); close(); }} style={itemStyle}
                onMouseEnter={e => e.currentTarget.style.background = C.espuma} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <AlertCircle size={15} color={C.brisa} /> Definir como ocupado
              </button>
            </div>
          </>
        );
      })()}

      {quickRate && (() => {
        const apt = data.apartamentos.find(a => a.id === quickRate.aptId);
        const startD = days[quickRate.startIdx], endD = days[quickRate.endIdx];
        const nNoites = quickRate.endIdx - quickRate.startIdx + 1;
        const ciSel = ymd(startD), coSel = ymd(addDays(endD, 1));
        // reservas deste apartamento que já ocupam (mesmo que só em parte) o
        // período escolhido — a pedido do Caio, a tarifa rápida deve alterar
        // diretamente o preço destas reservas (o mesmo campo "Preço" da edição
        // da reserva), em vez de criar sempre uma nova temporada; só cria uma
        // temporada (oculta, marcada `rapida: true` — ver Seasons.jsx) quando
        // não há reserva alguma no período, só para o cálculo de preço
        // reconhecer essas datas/apartamento quando nascer uma reserva ali.
        const afetadas = data.reservas.filter(r =>
          r.apartamentoId === apt.id && r.status !== 'cancelada' && r.status !== 'bloqueio' &&
          overlaps(ciSel, coSel, r.checkIn, r.checkOut));
        // Só é seguro alterar diretamente o preço/noite de uma reserva
        // quando ela cabe INTEIRAMENTE no período selecionado — senão
        // ficaríamos a aplicar o preço da tarifa rápida também às noites
        // de fora da seleção (ver comentário acima).
        const afetadasTotais = afetadas.filter(r => r.checkIn >= ciSel && r.checkOut <= coSel);
        const afetadasParciais = afetadas.filter(r => !(r.checkIn >= ciSel && r.checkOut <= coSel));
        return (
          <QuickRateModal apt={apt} startD={startD} endD={endD} nNoites={nNoites} afetadas={afetadasTotais} parciais={afetadasParciais}
            onClose={() => setQuickRate(null)}
            onSave={preco => {
              update(prev => {
                if (afetadasTotais.length > 0) {
                  const idsAfetadas = new Set(afetadasTotais.map(r => r.id));
                  return {
                    ...prev,
                    reservas: prev.reservas.map(r => {
                      if (!idsAfetadas.has(r.id)) return r;
                      const nr = Math.max(1, nights(r.checkIn, r.checkOut));
                      const extrasVal = (r.extras || []).reduce((s, e) => s + (Number(e.qtd) || 0) * (Number(e.preco) || 0), 0);
                      const acomod = Math.round(preco * nr);
                      return { ...r, precoNoite: preco, total: acomod + extrasVal };
                    }),
                  };
                }
                return {
                  ...prev,
                  seasons: [{
                    id: 's' + uid(),
                    nome: `Tarifa rápida — ${apt.nome}`,
                    inicio: ymd(startD),
                    fim: ymd(endD),
                    ativa: true,
                    minNoites: 1,
                    precos: { [apt.id]: { diaSemana: preco, fimSemana: preco } },
                    // Ajuste pontual, não uma temporada para gerir — fica de fora
                    // de "Opções de preços por temporada" (ver Seasons.jsx), mas
                    // continua a valer no cálculo do preço (helpers.js) igual a
                    // qualquer outra temporada, a pedido do Caio, 2026-09-22.
                    rapida: true,
                  }, ...(prev.seasons || [])],
                };
              });
              setQuickRate(null);
            }} />
        );
      })()}

      {view === 'lista' && (
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: `1px solid ${C.line}`, gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: C.inkSoft }}>Pagamento:</span>
              <button onClick={() => setPaymentFilter('todas')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, background: paymentFilter === 'todas' ? C.ocean : C.espuma, color: paymentFilter === 'todas' ? '#fff' : C.inkSoft }}>Todas</button>
              <button onClick={() => setPaymentFilter('sem')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, background: paymentFilter === 'sem' ? C.coralDeep : C.espuma, color: paymentFilter === 'sem' ? '#fff' : C.inkSoft }}>Sem confirmação (0 pago)</button>
              <button onClick={() => setPaymentFilter('com')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, background: paymentFilter === 'com' ? '#1C7A5B' : C.espuma, color: paymentFilter === 'com' ? '#fff' : C.inkSoft }}>Com pagamento</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: C.inkSoft }}>Status:</span>
              <button onClick={() => setStatusFilter('todas')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, background: statusFilter === 'todas' ? C.ocean : C.espuma, color: statusFilter === 'todas' ? '#fff' : C.inkSoft }}>Todas</button>
              {['confirmado', 'reservado', 'pendente', 'bloqueio', 'cancelada'].map(st => (
                <button key={st} onClick={() => setStatusFilter(st)}
                  style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, background: statusFilter === st ? STATUS[st].fg : C.espuma, color: statusFilter === st ? '#fff' : C.inkSoft }}>
                  {STATUS[st].label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: C.inkSoft }}>Ordenação:</span>
              <button onClick={() => { setManualOrder(false); setSortKey('checkIn'); setSortDir('desc'); }} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, background: !manualOrder ? C.ocean : C.espuma, color: !manualOrder ? '#fff' : C.inkSoft }}>Por data</button>
              <button onClick={() => setManualOrder(true)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, background: manualOrder ? C.ocean : C.espuma, color: manualOrder ? '#fff' : C.inkSoft }}>Manual ⠿</button>
            </div>
          </div>
          <div className="pm-hide-sm" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 720 }}>
              <thead><tr style={{ background: C.espuma, textAlign: 'left', color: C.inkSoft }}>
                <th style={{ padding: '12px 14px', fontWeight: 700, fontSize: 12.5 }}>{manualOrder ? '⠿' : ''}</th>
                {[['Código', 'codigo'], ['Residencial', 'residencial'], ['Apartamento', 'apartamento'], ['Hóspede', 'hospede'], ['Estadia', 'checkIn'], ['Origem', 'origem'], ['Total', 'total'], ['Valor pago', 'valorPago'], ['Estado', 'estado']].map(([h, key]) => (
                  <th key={key} onClick={() => sortByColumn(key)} title="Ordenar por esta coluna"
                    style={{ padding: '12px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                    {h}{!manualOrder && sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
                <th style={{ padding: '12px 14px', fontWeight: 700, fontSize: 12.5 }}></th>
              </tr></thead>
              <tbody>
                {listFiltered.slice(0, listCap).map((r, idx) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${C.line}`, opacity: arrastoRes.de === r.id ? 0.4 : 1, outline: arrastoRes.sobre === r.id && arrastoRes.de !== r.id ? `2px dashed ${C.coral}` : 'none' }}
                    draggable={manualOrder}
                    onDragStart={manualOrder ? (e) => { setArrastoRes({ de: r.id, sobre: null }); try { e.dataTransfer.setData('text/plain', r.id); } catch { /* ignora */ } } : undefined}
                    onDragOver={manualOrder ? e => { e.preventDefault(); if (arrastoRes.sobre !== r.id) setArrastoRes(a => ({ ...a, sobre: r.id })); } : undefined}
                    onDragEnd={manualOrder ? () => setArrastoRes({ de: null, sobre: null }) : undefined}
                    onDrop={manualOrder ? (e) => { e.preventDefault(); soltarRes(); } : undefined}>
                    <td style={{ padding: '11px 10px', color: C.inkSoft, cursor: manualOrder ? 'grab' : 'default', fontSize: 16 }}>{manualOrder ? '⠿' : ''}</td>
                    <td style={{ padding: '11px 14px', fontFamily: F.disp, color: C.ocean }}>{r.codigo}</td>
                    <td style={{ padding: '11px 14px' }}><ResPill residencial={aptResidencial(r.apartamentoId)} /></td>
                    <td style={{ padding: '11px 14px', fontWeight: 600 }}>{aptName(r.apartamentoId)}</td>
                    <td style={{ padding: '11px 14px' }}>
                      {r.status === 'bloqueio' ? <span style={{ color: C.inkSoft }}>—</span> : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          {r.hospede}
                          {r.checkinRealizado && <CheckinBadge compact />}
                          {r.checkoutRealizado && <CheckoutBadge compact />}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px', color: C.inkSoft }}>{fmtShort(r.checkIn)} → {fmtShort(r.checkOut)}</td>
                    <td style={{ padding: '11px 14px', color: C.inkSoft }}>{r.origem}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600 }}>{money(r.total)}</td>
                    <td style={{ padding: '11px 14px', color: (Number(r.valorPago) || 0) > 0 ? C.ink : C.inkSoft }}>{r.status === 'bloqueio' ? <span style={{ color: C.inkSoft }}>—</span> : money(r.valorPago || 0)}</td>
                    <td style={{ padding: '11px 14px' }}><Badge status={displayStatus(r)} /></td>
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setDeleteConfirm(r)} title="Eliminar" style={iconBtn}><Trash2 size={15} /></button>
                      <button onClick={() => setEditing(r)} title="Editar" style={{ ...iconBtn, marginLeft: 6 }}><Pencil size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* versão mobile — cartões em vez de tabela larga, com a mesma
              informação relevante que aparece em "Reservas no período" do
              Financeiro (hóspede, datas, total, estado) em vez de obrigar
              a rolar a tabela na horizontal para ver algo útil */}
          <div className="pm-res-listcards" style={{ display: 'none' }}>
            {listFiltered.slice(0, listCap).map(r => (
              <div key={r.id} style={{ padding: '13px 16px', borderTop: `1px solid ${C.line}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: F.disp, fontSize: 12.5, color: C.ocean }}>{r.codigo}</span>
                  <Badge status={displayStatus(r)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 15.5, marginBottom: 3, flexWrap: 'wrap' }}>
                  {r.status === 'bloqueio' ? '⛔ Bloqueio' : (r.hospede || '—')}
                  {r.checkinRealizado && <CheckinBadge compact />}
                  {r.checkoutRealizado && <CheckoutBadge compact />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12.5, color: C.inkSoft, marginBottom: 6 }}>
                  <ResPill residencial={aptResidencial(r.apartamentoId)} /> <span>{aptName(r.apartamentoId)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, flexWrap: 'wrap', rowGap: 4 }}>
                  <span style={{ color: C.inkSoft }}>{fmtShort(r.checkIn)} → {fmtShort(r.checkOut)}</span>
                  <span style={{ fontWeight: 700 }}>{money(r.total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button onClick={() => setEditing(r)} title="Editar" style={iconBtn}><Pencil size={15} /></button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '11px 16px', fontSize: 12.5, color: C.inkSoft, borderTop: `1px solid ${C.line}` }}>
            {listFiltered.length > listCap ? `A mostrar as ${listCap} reservas mais recentes de ${listFiltered.length}.${paymentFilter === 'todas' ? ' Use a exportação para ver todas.' : ''}` : `${listFiltered.length} reserva(s)${paymentFilter === 'todas' ? ' no total.' : paymentFilter === 'sem' ? ' sem confirmação (0 pago).' : ' com algum pagamento.'}`}
          </div>
        </Card>
      )}

      {editing && <ReservationForm data={data} initial={editing === 'new' ? prefill : editing} isNew={editing === 'new'}
        onSave={save} onRemove={remove} onDuplicate={duplicate} onClose={() => { setEditing(null); setPrefill(null); }} />}

      {deleteConfirm && (
        <ConfirmDialog
          message={<>Eliminar definitivamente a reserva <b>{deleteConfirm.codigo || ''}</b>? Esta ação não pode ser desfeita — para manter o registo sem bloquear as datas, marque o estado como Cancelada em vez disso.</>}
          onConfirm={() => { remove(deleteConfirm.id); setDeleteConfirm(null); }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {restaurar && (
        <ConfirmDialog
          title="Restaurar backup?"
          confirmLabel="Restaurar e substituir tudo"
          message={<>O arquivo <b>{restaurar.nome}</b> tem <b>{restaurar.obj.reservas.length} reservas</b> e <b>{restaurar.obj.apartamentos.length} apartamentos</b>. Hoje o sistema tem <b>{data.reservas.length} reservas</b> e <b>{data.apartamentos.length} apartamentos</b>.<br /><br />Restaurar <b>substitui todos os dados</b> pelos do backup — inclusive reservas feitas pelo site depois da data do backup. Antes de substituir, uma cópia dos dados atuais será baixada para este computador.</>}
          onCancel={() => setRestaurar(null)}
          onConfirm={async () => {
            const { obj } = restaurar;
            setRestaurar(null);
            // a cópia de segurança sai dos dados MAIS RECENTES do banco (não só
            // do que este painel tinha em memória) — assim inclui também as
            // reservas feitas pelo site desde a última atualização do painel
            let atuais = data;
            try { atuais = (await carregarAdmin()).data || data; } catch { /* sem rede: guarda o que o painel tem */ }
            downloadBlob(JSON.stringify(atuais, null, 2), `pinheiramar-antes-de-restaurar-${carimbo()}.json`, 'application/json');
            const novo = migrarDados(obj).data;
            update(() => novo, { permitirReducao: true })
              .then(() => setImportMsg({ ok: true, text: `Backup restaurado — ${novo.reservas.length} reservas e ${novo.apartamentos.length} apartamentos. A cópia dos dados anteriores foi baixada.` }))
              .catch(e => setImportMsg({ ok: false, text: e?.codigo === 'descartada' ? 'A restauração foi cancelada.' : `Não foi possível restaurar (${e?.codigo || e?.message || 'erro'}). Nada foi alterado.` }));
          }}
        />
      )}

      {confirmEncerrarSessoes && (
        <ConfirmDialog
          title="Encerrar todas as sessões do painel?"
          confirmLabel="Encerrar todas as sessões"
          message={<>Isso vai desconectar <b>todos os administradores</b>, em qualquer dispositivo — <b>inclusive você</b>. Todos precisarão entrar de novo com e-mail e senha.<br /><br />Aviso: uma aba que já esteja aberta continua a funcionar até o acesso dela vencer sozinho (normalmente até 1 hora) — isto impede que alguém entre de novo, mas não fecha instantaneamente uma aba já aberta.</>}
          onCancel={() => setConfirmEncerrarSessoes(false)}
          onConfirm={acionarEncerrarSessoes}
        />
      )}
    </div>
  );
}
export const iconBtn = { background: C.espuma, border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.inkSoft };

export const secTitle = { fontFamily: F.disp, fontSize: 16, color: C.ink, margin: '2px 0 10px', display: 'flex', alignItems: 'center', gap: 8 };
export const cellInput = { width: '100%', padding: '7px 9px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: F.sans, outline: 'none', background: '#fff', color: C.ink };

export function Stepper({ value, set, min = 0, max = 99, disabled }) {
  const btn = { width: 36, height: 40, border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.ocean };
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden', opacity: disabled ? 0.5 : 1, background: '#fff' }}>
      <button type="button" disabled={disabled || value <= min} onClick={() => set(Math.max(min, value - 1))} style={{ ...btn, borderRight: `1px solid ${C.line}` }}><Minus size={15} /></button>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 600, minWidth: 44 }}>{value}</div>
      <button type="button" disabled={disabled || value >= max} onClick={() => set(Math.min(max, value + 1))} style={{ ...btn, borderLeft: `1px solid ${C.line}` }}><Plus size={15} /></button>
    </div>
  );
}
export const MoneyInput = ({ value, onChange, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 8px', background: '#fff', ...style }}>
    <span style={{ fontSize: 12, color: C.inkSoft }}>R$</span>
    <input className="pmf" type="number" step="1" value={value} onChange={onChange}
      style={{ width: '100%', border: 'none', outline: 'none', padding: '7px 0', fontSize: 13, fontFamily: F.sans, background: 'transparent', color: C.ink }} />
  </div>
);

// Modal simples usado pela opção "Adicionar tarifa rápida" do menu de
// arrastar no calendário. Quando o período escolhido já tem reserva(s) deste
// apartamento, altera diretamente o preço por noite dessa(s) reserva(s) — o
// mesmo campo "Preço" editável na edição da reserva — sem mexer nas datas.
// Só quando não há reserva nenhuma no período é que guarda uma tarifa
// pontual (marcada `rapida: true`, para que uma futura reserva ali já nasça
// com este preço) — nunca aparece em "Opções de preços por temporada"
// (ver Seasons.jsx), só serve o cálculo interno de preço (helpers.js), em
// vez de reaproveitar o editor completo de Opções de preços, para manter a
// ação de um único ecrã.
function QuickRateModal({ apt, startD, endD, nNoites, afetadas, parciais, onClose, onSave }) {
  const temReservas = afetadas && afetadas.length > 0;
  const umaReserva = afetadas && afetadas.length === 1 ? afetadas[0] : null;
  const temParciais = parciais && parciais.length > 0;
  const [preco, setPreco] = useState(() => (umaReserva ? umaReserva.precoNoite : (apt?.preco || 0)));
  return (
    <Modal title="Tarifa rápida"
      subtitle={`${apt?.nome} · ${fmtShort(ymd(startD))} → ${fmtShort(ymd(addDays(endD, 1)))} · ${nNoites} noite${nNoites > 1 ? 's' : ''}`}
      onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" onClick={() => onSave(Number(preco) || 0)}>Guardar tarifa</Btn>
      </>}>
      <Field label="Preço por noite neste período"
        hint={temReservas
          ? `Este período já tem ${afetadas.length > 1 ? `${afetadas.length} reservas` : 'uma reserva'} deste apartamento inteiramente dentro dele — vai alterar diretamente o preço por noite ${afetadas.length > 1 ? 'delas' : 'dela'} (o mesmo campo "Preço" da edição da reserva), sem mexer nas datas.`
          : 'Sem reservas inteiramente dentro deste período — guarda este preço só para este apartamento e estas datas (não cria uma temporada em "Opções de preços"), para que uma futura reserva aqui já nasça com este valor.'}>
        <MoneyInput value={preco} onChange={e => setPreco(e.target.value)} />
      </Field>
      {temParciais && (
        <div style={{ marginTop: 10 }}>
          <Note color="#b45309" bg="#fff7ed">
            {parciais.length > 1 ? `${parciais.length} reservas` : '1 reserva'} deste apartamento {parciais.length > 1 ? 'começam antes ou terminam depois' : 'começa antes ou termina depois'} do período selecionado — o preço {parciais.length > 1 ? 'delas' : 'dela'} não será alterado, para não afetar noites fora da seleção. Edite {parciais.length > 1 ? 'essas reservas' : 'essa reserva'} individualmente se precisar.
          </Note>
        </div>
      )}
    </Modal>
  );
}

export function ReservationForm({ data, initial, isNew, onSave, onRemove, onDuplicate, onClose }) {
  const i = initial || {};
  const firstApt = data.apartamentos[0];
  const [aptId, setAptId] = useState(i.apartamentoId || firstApt.id);
  const [ci, setCi] = useState(i.checkIn || ymd(today()));
  const [co, setCo] = useState(i.checkOut || ymd(addDays(today(), 1)));
  const [status, setStatus] = useState(i.status || 'confirmado');
  const [origem, setOrigem] = useState(i.origem || 'Manual');
  const [adultos, setAdultos] = useState(i.adultos ?? (i.hospedes || 2));
  const [criancas, setCriancas] = useState(i.criancas ?? 0);
  const [nome, setNome] = useState(i.nome ?? (i.hospede ? i.hospede.split(' ')[0] : ''));
  const [sobrenome, setSobrenome] = useState(i.sobrenome ?? (i.hospede ? i.hospede.split(' ').slice(1).join(' ') : ''));
  const [tel, setTel] = useState(i.telefone || '');
  const [pais, setPais] = useState(i.pais || 'Brasil');
  const [email, setEmail] = useState(i.email || '');
  const [enviarEmail, setEnviarEmail] = useState(i.enviarEmail || false);
  // quando saiu o último e-mail de confirmação (guardado na reserva) e o
  // estado do envio manual em curso: null | 'a-enviar' | 'enviado' | 'falhou'
  const [emailEnviadoEm, setEmailEnviadoEm] = useState(i.emailEnviadoEm || null);
  const [envio, setEnvio] = useState(null);
  const [motivoEnvio, setMotivoEnvio] = useState(null);
  // checkinRealizado/checkoutRealizado: independentes do status (que agora
  // representa só o pagamento) — marcam se o hóspede já chegou/saiu de facto.
  // Ver ui.jsx (CheckinBadge/CheckoutBadge) e Dashboard.jsx.
  const [checkinRealizado, setCheckinRealizado] = useState(i.checkinRealizado || false);
  const [checkoutRealizado, setCheckoutRealizado] = useState(i.checkoutRealizado || false);
  const [nota, setNota] = useState(i.nota || '');
  // Registo de pagamentos — substitui o antigo campo único "valor pago" por um
  // histórico de lançamentos (descrição/data/valor), a pedido do Caio
  // (2026-09-23). Reservas antigas só têm o escalar `valorPago`: nunca é
  // reescrito aqui sozinho — continua a contar como 1º lançamento (legado,
  // só em memória) até o gestor lançar um pagamento novo, momento em que é
  // materializado sem perder nem alterar o valor original (ver commitRegistro).
  const [registrosPagamento, setRegistrosPagamento] = useState(i.registrosPagamento || []);
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaData, setNovaData] = useState(ymd(today()));
  const [novoValor, setNovoValor] = useState('');
  const [extras, setExtras] = useState(() => {
    if (!isNew) {
      // Edição: os extras tal como estão gravados (com taxaId/por/tipo).
      // Antes, uma reserva antiga SEM extras (ex.: as importadas) recebia as
      // taxas obrigatórias ao abrir — e salvar somava-as ao total dela.
      return (i.extras || []).map(e => ({ ...e, id: e.id || uid() }));
    }
    // Nova reserva: pré-carregar as taxas obrigatórias, com a quantidade
    // certa para "por noite"/"por hóspede" (antes era sempre 1)
    return extrasObrigatorios(data.taxasAdicionais, { noites: Math.max(1, nights(ci, co)), hospedes: adultos + criancas })
      .map(({ subtotal, ...e }) => ({ ...e, id: uid(), auto: true }));
  });
  // as taxas "por noite"/"por hóspede" pré-carregadas acompanham as datas e
  // o nº de hóspedes, até o gestor mexer à mão na quantidade
  useEffect(() => {
    const ctx = { noites: Math.max(1, nights(ci, co)), hospedes: adultos + criancas };
    setExtras(x => (x.some(e => e.auto) ? x.map(e => (e.auto ? { ...e, qtd: quantidadeTaxa({ por: e.por }, ctx) } : e)) : x));
  }, [ci, co, adultos, criancas]);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const apt = data.apartamentos.find(a => a.id === aptId) || firstApt;
  // este ambiente é partilhado pelos dois residenciais — os horários/sinal
  // usados são sempre os do imóvel a que o apartamento escolhido pertence.
  const residencial = residencialOf(data, apt);
  const validDates = nights(ci, co) >= 1;
  const n = Math.max(1, nights(ci, co));
  // Precisa de vir antes do stayBreakdown abaixo — o preço já inclui
  // automaticamente o "Adulto extra" por hóspede acima da capacidade base
  // do apartamento (ver helpers.js/nightlyRate), a pedido do Caio, 2026-09-17.
  const totalGuests = adultos + criancas;
  const bd = stayBreakdown(apt, data.seasons, ci, co, totalGuests);
  const suggested = Math.round(bd.total / n);
  const ciSeason = seasonForDate(data.seasons, parseYMD(ci));
  const seasonRates = aptRates(ciSeason, apt.id) || {};
  const adultoExtra = Number(seasonRates.adultoExtra) || 0;
  const capacidadeBase = capacidadeBaseOf(apt);
  const hospedesExtra = status !== 'bloqueio' ? Math.max(0, Math.min(totalGuests, apt.capacidade || totalGuests) - capacidadeBase) : 0;

  // Em edição, o preço inicial é o que está GRAVADO na reserva
  // (i.precoNoite) — nunca o valor recalculado pela tabela de temporada.
  // Só reservas NOVAS partem do valor sugerido pela temporada.
  const [precoNoite, setPrecoNoite] = useState(() => (
    !isNew && i.precoNoite != null ? i.precoNoite : suggested
  ));
  // Em edição, se o preço gravado já é diferente do valor de temporada
  // sugerido, mostra o link "repor" desde já — é um preço personalizado e
  // o gestor precisa de ver isso, podendo repor o valor de tabela se quiser.
  const [precoEdited, setPrecoEdited] = useState(() => (
    !isNew && i.precoNoite != null && Math.round(Number(i.precoNoite)) !== suggested
  )); // depois disto, só true quando o gestor digita manualmente

  // Sempre que o gestor MUDA apartamento, datas, estado ou hóspedes depois
  // de a reserva já estar aberta: recalcula pelo valor de temporada do
  // apartamento escolhido. Ignora se o gestor editou manualmente E não
  // mudou o apartamento nem as datas. Este efeito dispara sempre também na
  // primeira renderização (mesmo sem nada ter mudado) — em edição, esse
  // primeiro disparo é ignorado, porque o valor inicial já foi tratado
  // corretamente acima (ver comentário no useState de precoNoite).
  const skipFirstPriceReset = useRef(!isNew);
  useEffect(() => {
    if (status === 'bloqueio') { setPrecoNoite(0); return; }
    if (nights(ci, co) < 1) return;
    if (skipFirstPriceReset.current) { skipFirstPriceReset.current = false; return; }
    const a = data.apartamentos.find(x => x.id === aptId) || firstApt;
    const newBd = stayBreakdown(a, data.seasons, ci, co, adultos + criancas);
    setPrecoNoite(Math.round(newBd.total / Math.max(1, nights(ci, co))) || a.preco || 0);
    setPrecoEdited(false); // reset: troca de apt/data/hóspedes cancela override manual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aptId, ci, co, status, adultos, criancas]);

  // Estadia: fica a que está GRAVADA na reserva enquanto o gestor não mexer
  // no preço por noite, nas datas, no apartamento ou no estado. Antes era
  // sempre refeita como "preço por noite (arredondado) × noites": bastava
  // abrir e salvar uma reserva do site (ex.: para pôr uma nota) para o total
  // mudar R$ 1–2 — e o sinal com ele, o que fazia o pagamento certo do
  // Mercado Pago parecer "a menos".
  const somaExtras = (lista) => (lista || []).reduce((s, e) => s + (Number(e.qtd) || 0) * (Number(e.preco) || 0), 0);
  const estadiaGravada = !isNew && i.total != null ? Math.round((Number(i.total) - somaExtras(i.extras)) * 100) / 100 : null;
  const mesmaEstadia = !isNew && estadiaGravada != null && estadiaGravada >= 0 && i.status !== 'bloqueio' && status !== 'bloqueio'
    && i.precoNoite != null && Math.round(Number(precoNoite) * 100) === Math.round(Number(i.precoNoite) * 100)
    && ci === i.checkIn && co === i.checkOut && aptId === i.apartamentoId;
  const acomod = status === 'bloqueio' ? 0 : (mesmaEstadia ? estadiaGravada : Math.round(precoNoite * n));
  const extrasVal = status === 'bloqueio' ? 0 : somaExtras(extras);
  const total = Math.round((acomod + extrasVal) * 100) / 100;
  // Sinal: fica o gravado enquanto o total não mudar; a 2ª metade de uma
  // reserva conjunta nunca leva sinal (o pagamento está todo na 1ª).
  const metadeConjunta = !isNew && !!i.pagamentoRef && i.pagamentoRef !== i.id;
  const sinal = metadeConjunta ? (Number(i.sinal) || 0)
    : (!isNew && i.sinal != null && Math.abs(total - Number(i.total)) < 0.005) ? Number(i.sinal)
    : Math.round(total * (residencial.sinalPct / 100));
  const free = isAvailable(data.reservas, aptId, ci, co, i.id);
  const overCap = status !== 'bloqueio' && totalGuests > apt.capacidade;
  // Telefone/Email deixaram de ser obrigatórios para gravar (a pedido do
  // Caio, 2026-09-23): as 3261 reservas do histórico importado não têm
  // telefone (e muitas não têm email), o que impedia GRAVAR QUALQUER
  // EDIÇÃO nelas — o botão "Guardar alterações" ficava sempre desativado.
  // O nome do hóspede continua obrigatório.
  const canSave = validDates && (free || status === 'cancelada') && !overCap && (status === 'bloqueio' || (nome.trim() && sobrenome.trim()));
  const valorLegado = registrosPagamento.length === 0 ? Math.round((Number(i.valorPago) || 0) * 100) / 100 : 0;
  const registrosExibidos = valorLegado > 0
    ? [{ id: '__legado__', descricao: 'Valor pago anteriormente (registo antigo)', data: safeYmd(i.criadoEm), valor: valorLegado, legado: true }, ...registrosPagamento]
    : registrosPagamento;
  const valorPago = Math.round(registrosExibidos.reduce((s, r) => s + (Number(r.valor) || 0), 0) * 100) / 100;
  const restante = Math.max(0, Math.round((total - valorPago) * 100) / 100);

  // Lança um novo pagamento no histórico. Se ainda não havia nenhum
  // lançamento novo (só o legado em memória), o legado é gravado como 1º
  // item — de forma exata, sem alterar o total já registado — só agora que
  // o gestor está de facto a mexer nesta reserva.
  const commitRegistro = (descricao, data, valor) => {
    const v = Math.round((Number(valor) || 0) * 100) / 100;
    if (!descricao.trim() || v <= 0) return;
    setRegistrosPagamento(prev => {
      const base = prev.length === 0 && valorLegado > 0
        ? [{ id: uid(), descricao: 'Valor pago anteriormente (registo antigo)', data: safeYmd(i.criadoEm), valor: valorLegado }]
        : prev;
      return [...base, { id: uid(), descricao: descricao.trim(), data: safeYmd(data), valor: v }];
    });
    setNovaDescricao('');
    setNovoValor('');
  };
  const removeRegistro = (id) => setRegistrosPagamento(prev => prev.filter(r => r.id !== id));
  const marcarComoPaga = () => { if (restante > 0) commitRegistro('Pagamento — saldo restante', ymd(today()), restante); };

  const addExtra = (preset) => setExtras(x => [...x, { id: uid(), nome: preset?.nome || '', qtd: 1, preco: preset?.preco ?? 0 }]);
  const updExtra = (id, patch) => setExtras(x => x.map(e => e.id === id ? { ...e, ...patch, ...('qtd' in patch ? { auto: false } : {}) } : e));
  const delExtra = (id) => setExtras(x => x.filter(e => e.id !== id));
  const ORIGENS = [...new Set([origem, 'Manual', 'Site', 'Telefone', 'WhatsApp', 'Booking', 'Airbnb'])];

  // A reserva tal como está no ecrã. Serve tanto para gravar como para o envio
  // manual do e-mail — assim o e-mail vai sempre com os mesmos dados que o
  // botão "Guardar" gravaria, sem haver duas montagens a poderem divergir.
  const montarReserva = () => ({
    id: i.id || uid(), codigo: i.codigo || code(), apartamentoId: aptId, checkIn: ci, checkOut: co,
    status, origem,
    nome: status === 'bloqueio' ? '' : nome.trim(), sobrenome: status === 'bloqueio' ? '' : sobrenome.trim(),
    hospede: status === 'bloqueio' ? '' : `${nome.trim()} ${sobrenome.trim()}`.trim(),
    email: email.trim(), telefone: tel.trim(), pais,
    adultos: status === 'bloqueio' ? 0 : adultos, criancas: status === 'bloqueio' ? 0 : criancas,
    hospedes: status === 'bloqueio' ? 0 : totalGuests,
    precoNoite: status === 'bloqueio' ? 0 : Math.round((Number(precoNoite) || 0) * 100) / 100,
    precoTabela: status === 'bloqueio' ? 0 : (mesmaEstadia && i.precoTabela != null ? i.precoTabela : bd.total),
    extras: status === 'bloqueio' ? [] : extras.map(({ auto, ...e }) => ({ ...e, qtd: Number(e.qtd) || 0, preco: Number(e.preco) || 0 })),
    total, sinal, valorPago: status === 'bloqueio' ? 0 : valorPago,
    registrosPagamento: status === 'bloqueio' ? [] : registrosPagamento,
    checkinRealizado: status === 'bloqueio' ? false : checkinRealizado,
    checkoutRealizado: status === 'bloqueio' ? false : checkoutRealizado,
    enviarEmail, nota, criadoEm: i.criadoEm || ymd(today()),
    ...(emailEnviadoEm ? { emailEnviadoEm } : {}),
  });

  // O (re)envio do e-mail vai com os dados SALVOS (o servidor lê do banco).
  // Se o gestor mudou algo que aparece no e-mail, pede para salvar antes.
  const chaveExtras = (lista) => JSON.stringify((lista || []).map(e => [e.nome, Number(e.qtd) || 0, Number(e.preco) || 0]));
  const mudouParaEmail = !isNew && (
    email.trim() !== String(i.email || '').trim() || aptId !== i.apartamentoId || ci !== i.checkIn || co !== i.checkOut
    || nome.trim() !== String(i.nome ?? (i.hospede ? i.hospede.split(' ')[0] : '')).trim()
    || sobrenome.trim() !== String(i.sobrenome ?? (i.hospede ? i.hospede.split(' ').slice(1).join(' ') : '')).trim()
    || adultos !== (i.adultos ?? (i.hospedes || 2)) || criancas !== (i.criancas ?? 0)
    || (i.precoNoite != null && Math.round(Number(precoNoite) * 100) !== Math.round(Number(i.precoNoite) * 100))
    || chaveExtras(extras) !== chaveExtras(i.extras));

  return (
    <>
    <Modal title={isNew ? 'Criar nova reserva' : `Reserva ${i.codigo || ''}`} subtitle={`${residencial.nome} · ${apt.nome} · ${apt.piso} · ${apt.vista}${!isNew && i.criadoEm ? ` · Criada em ${fmtShort(i.criadoEm)}` : ''}`} onClose={onClose} wide
      headerActions={!isNew && onDuplicate && (
        <button onClick={() => { onDuplicate(i.id); onClose(); }} title="Duplicar reserva"
          style={{ background: C.espuma, border: 'none', borderRadius: 9, width: 34, height: 34, cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.inkSoft, flexShrink: 0 }}>
          <Copy size={17} />
        </button>
      )}
      footer={<>
        {!isNew && onRemove && <Btn variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)} style={{ marginRight: 'auto' }}>Eliminar</Btn>}
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={!canSave} style={{ opacity: canSave ? 1 : .5 }}
          onClick={() => {
            const r = montarReserva();
            // só envia ao CRIAR a reserva (e depois de gravada) — reeditar uma
            // reserva existente com a caixa ainda marcada não reenvia o e-mail.
            onSave(r, { original: isNew ? undefined : i, enviarEmailAoGravar: isNew && enviarEmail && !!r.email });
          }}>{isNew ? 'Salvar reserva' : 'Salvar alterações'}</Btn>
      </>}>
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1fr)' }}>

        {/* Status */}
        <div>
          <div style={secTitle}><Tag size={16} color={C.brisa} /> Status da reserva</div>
          <div className="pm-dash-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Estado" hint={!isNew ? 'Marque como Cancelada para manter no histórico sem bloquear as datas, ou use "Eliminar" abaixo para remover definitivamente.' : undefined}>
              {/* Pintado com a cor do estado escolhido (a mesma do calendário
                  e das etiquetas): confirma de relance o que está seleccionado,
                  sem ser preciso ler. */}
              <Select value={status} onChange={e => setStatus(e.target.value)}
                style={{ background: (STATUS[status] || STATUS.pendente).bg, color: (STATUS[status] || STATUS.pendente).fg, borderColor: (STATUS[status] || STATUS.pendente).bar, fontWeight: 700 }}>
                <option value="pendente">Pendente (sem pagamento)</option>
                <option value="reservado">Reservado (50% pago)</option>
                <option value="confirmado">Confirmado (100% pago)</option>
                <option value="bloqueio">Bloqueio</option>
                <option value="cancelada">Cancelada</option>
              </Select>
            </Field>
            <Field label="Origem"><Select value={origem} onChange={e => setOrigem(e.target.value)}>{ORIGENS.map(o => <option key={o}>{o}</option>)}</Select></Field>
          </div>
          {status !== 'bloqueio' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 10, border: `1px solid ${checkinRealizado ? '#6EE7B7' : C.line}`, background: checkinRealizado ? '#EAFBF4' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: checkinRealizado ? '#0B6B4F' : C.ink }}>
                <input type="checkbox" checked={checkinRealizado} onChange={e => setCheckinRealizado(e.target.checked)} />
                <LogIn size={15} /> Check-in realizado
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 10, border: `1px solid ${checkoutRealizado ? '#EFB3B3' : C.line}`, background: checkoutRealizado ? '#FBE9E9' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: checkoutRealizado ? '#8A2E2E' : C.ink }}>
                <input type="checkbox" checked={checkoutRealizado} onChange={e => setCheckoutRealizado(e.target.checked)} />
                <LogOut size={15} /> Check-out realizado
              </label>
              <span style={{ fontSize: 11.5, color: C.inkSoft }}>Normalmente marcados só depois de "Confirmado" (100% pago).</span>
            </div>
          )}
        </div>

        {/* Detalhes da reserva */}
        <div>
          <div style={secTitle}><CalendarDays size={16} color={C.brisa} /> Detalhes da reserva</div>
          <div className="pm-dash-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Check-in" required><DateInput value={ci} onChange={e => { setCi(e.target.value); if (nights(e.target.value, co) < 1) setCo(ymd(addDays(parseYMD(e.target.value), 1))); }} /></Field>
            <Field label="Check-out" required><DateInput value={co} min={ymd(addDays(parseYMD(ci), 1))} onChange={e => setCo(e.target.value)} /></Field>
          </div>
          {/* O ícone é o único item flex; a frase inteira vai num só <span>.
              Antes cada pedaço de texto era um item flex à parte, e as horas
              alinhavam-se em colunas em vez de correrem dentro da frase. */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12.5, color: C.inkSoft, margin: '8px 2px 0', lineHeight: 1.5 }}>
            <Clock size={14} color={C.brisa} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Check-in a partir das <b style={{ color: C.ink }}>{residencial.checkInHora}</b> · check-out até às <b style={{ color: C.ink }}>{residencial.checkOutHora}</b>.</span>
          </div>
          {status !== 'bloqueio' && (
            <div className="pm-dash-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              <Field label="Adultos"><Stepper value={adultos} set={setAdultos} min={1} max={apt.capacidade} /></Field>
              <Field label="Crianças"><Stepper value={criancas} set={setCriancas} min={0} max={Math.max(0, apt.capacidade - 1)} /></Field>
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <Field label="Apartamento (tipo / acomodação)" required>
              <Select value={aptId} onChange={e => setAptId(e.target.value)}>
                {(data.residenciais || [{ id: undefined, nome: '' }]).map(r => (
                  <optgroup key={r.id || 'x'} label={r.nome}>
                    {data.apartamentos.filter(a => a.residencialId === r.id).map(a => (
                      <option key={a.id} value={a.id}>{roomFullName(a)}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
          </div>
          {!free && <div style={{ marginTop: 12 }}><Note color="#B23B3B" bg="#F7E9E9"><AlertCircle size={15} /> Conflito: já existe uma reserva neste apartamento nestas datas.</Note></div>}
          {overCap && <div style={{ marginTop: 10 }}><Note color="#9A6A14" bg="#FBEFD9"><AlertCircle size={15} /> {totalGuests} hóspedes excede a capacidade do apartamento ({apt.capacidade}).</Note></div>}
        </div>

        {/* Hóspede */}
        {status !== 'bloqueio' && <div>
          <div style={secTitle}><Users size={16} color={C.brisa} /> Detalhes do hóspede</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="pm-dash-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Nome" required><TextInput value={nome} onChange={e => setNome(e.target.value)} placeholder="Primeiro nome" /></Field>
              <Field label="Sobrenome" required><TextInput value={sobrenome} onChange={e => setSobrenome(e.target.value)} placeholder="Sobrenome" /></Field>
            </div>
            <div className="pm-dash-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Telefone"><TextInput value={tel} onChange={e => setTel(e.target.value)} placeholder="(00) 00000-0000" /></Field>
              <Field label="País"><Select value={pais} onChange={e => setPais(e.target.value)}>{[...new Set([pais, ...PAISES])].map(p => <option key={p}>{p}</option>)}</Select></Field>
            </div>
            <Field label="Email"><TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" /></Field>
            {/* Ao CRIAR, a caixa manda o e-mail no momento de gravar. Ao EDITAR
                ela não fazia nada (o envio só acontecia na criação), o que era
                enganador — passa a ser um botão que envia mesmo, na hora, e diz
                quando foi o último envio. Vai com os dados que estão no ecrã. */}
            {isNew ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: C.ink, cursor: 'pointer' }}>
                <input type="checkbox" checked={enviarEmail} onChange={e => setEnviarEmail(e.target.checked)} /> Enviar um email de confirmação para o hóspede
              </label>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Btn size="sm" variant="ghost" disabled={!email.trim() || envio === 'a-enviar' || mudouParaEmail}
                  onClick={async () => {
                    setEnvio('a-enviar');
                    const res = await enviarConfirmacaoReserva(i.id);
                    setEnvio(res.ok ? 'enviado' : 'falhou');
                    setMotivoEnvio(res.motivo || null);
                    if (res.ok) setEmailEnviadoEm(res.enviadoEm || new Date().toISOString());
                  }}>
                  {emailEnviadoEm ? 'Reenviar e-mail de confirmação' : 'Enviar e-mail de confirmação'}
                </Btn>
                <span style={{ fontSize: 12.5, color: envio === 'falhou' ? '#A24C4C' : C.inkSoft }}>
                  {envio === 'a-enviar' ? 'Enviando…'
                    : envio === 'enviado' ? 'Enviado agora.'
                    : envio === 'falhou' ? `Não foi possível enviar — ${textoFalhaEmail(motivoEnvio)}.`
                    : mudouParaEmail ? 'Salve as alterações primeiro — o e-mail vai com os dados salvos.'
                    : !email.trim() ? 'Preencha o e-mail para poder enviar.'
                    : emailEnviadoEm ? `Último envio: ${fmtShort(emailEnviadoEm.slice(0, 10))}.`
                    : 'Ainda não foi enviado nenhum e-mail para este hóspede.'}
                </span>
              </div>
            )}
            <Field label="Notas">
              <Textarea value={nota} maxLength={250} onChange={e => setNota(e.target.value)} placeholder="Observações internas (não visível para o hóspede)" />
              <span style={{ display: 'block', textAlign: 'right', fontSize: 11.5, color: C.inkSoft, marginTop: 4 }}>{nota.length}/250</span>
            </Field>
          </div>
        </div>}

        {status === 'bloqueio' && (
          <Field label="Motivo do bloqueio"><Textarea value={nota} maxLength={250} onChange={e => setNota(e.target.value)} placeholder="Ex.: manutenção, uso do proprietário…" /></Field>
        )}

        {/* Pagamento */}
        {status !== 'bloqueio' && <div>
          <div style={secTitle}><Wallet size={16} color={C.brisa} /> Detalhes de pagamento</div>
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
            <div className="pm-hide-sm" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
                <thead>
                  <tr style={{ background: C.espuma, color: C.inkSoft, textAlign: 'left' }}>
                    <th style={{ padding: '9px 12px', fontWeight: 700, fontSize: 12 }}>Nome do serviço</th>
                    <th style={{ padding: '9px 8px', fontWeight: 700, fontSize: 12, width: 110 }}>Quantidade</th>
                    <th style={{ padding: '9px 8px', fontWeight: 700, fontSize: 12, width: 120 }}>Preço</th>
                    <th style={{ padding: '9px 8px', fontWeight: 700, fontSize: 12, width: 64 }}>Imposto</th>
                    <th style={{ padding: '9px 12px', fontWeight: 700, fontSize: 12, width: 110, textAlign: 'right' }}>Valor</th>
                    <th style={{ width: 38 }} />
                  </tr>
                </thead>
                <tbody>
                  {/* Acomodação */}
                  <tr style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: C.ink }}>{roomFullName(apt)}</div>
                      <div style={{ fontSize: 11.5, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                        <Info size={12} /> Tarifa de tabela: {money(bd.total)} ({money(suggested)}/noite)
                        {Number(seasonRates.semanal) > 0 && <span>· semanal {money(seasonRates.semanal)}</span>}
                        {Number(seasonRates.mensal) > 0 && <span>· mensal {money(seasonRates.mensal)}</span>}
                        {hospedesExtra > 0 && <span>· inclui {hospedesExtra} hóspede{hospedesExtra > 1 ? 's' : ''} extra a {money(adultoExtra)}/noite</span>}
                        {precoEdited && <button type="button" onClick={() => { setPrecoEdited(false); setPrecoNoite(suggested); }} style={{ background: 'none', border: 'none', color: C.coralDeep, cursor: 'pointer', fontWeight: 600, fontSize: 11.5, padding: 0 }}>repor</button>}
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px', color: C.inkSoft }}>{n} {n === 1 ? 'noite' : 'noites'}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <MoneyInput value={precoNoite} onChange={e => { setPrecoNoite(e.target.value === '' ? '' : Number(e.target.value)); setPrecoEdited(true); }} />
                      <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 2 }}>por noite</div>
                    </td>
                    <td style={{ padding: '10px 8px', color: C.inkSoft }}>0%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{money(acomod)}</td>
                    <td />
                  </tr>
                  {/* Extras */}
                  {extras.map(e => {
                    const v = (Number(e.qtd) || 0) * (Number(e.preco) || 0);
                    return (
                      <tr key={e.id} style={{ borderTop: `1px solid ${C.line}` }}>
                        <td style={{ padding: '8px 12px' }}><input className="pmf" value={e.nome} onChange={ev => updExtra(e.id, { nome: ev.target.value })} placeholder="Descrição do serviço" style={cellInput} /></td>
                        <td style={{ padding: '8px 8px' }}><input className="pmf" type="number" min="0" value={e.qtd} onChange={ev => updExtra(e.id, { qtd: ev.target.value })} style={cellInput} /></td>
                        <td style={{ padding: '8px 8px' }}><MoneyInput value={e.preco} onChange={ev => updExtra(e.id, { preco: ev.target.value })} /></td>
                        <td style={{ padding: '8px 8px', color: C.inkSoft }}>0%</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: v < 0 ? C.coralDeep : C.ink }}>{money(v)}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}><button type="button" onClick={() => delExtra(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkSoft, display: 'grid', placeItems: 'center' }}><Trash2 size={15} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* versão mobile — mesmos campos da tabela acima, empilhados em
                cartões para que nada fique escondido atrás de rolagem horizontal */}
            <div className="pm-pay-mobile" style={{ display: 'none' }}>
              <div style={{ padding: 12, borderTop: `1px solid ${C.line}` }}>
                <div style={{ fontWeight: 600, color: C.ink, marginBottom: 4 }}>{roomFullName(apt)}</div>
                <div style={{ fontSize: 11.5, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <Info size={12} /> {n} {n === 1 ? 'noite' : 'noites'} · tabela {money(bd.total)} ({money(suggested)}/noite)
                  {hospedesExtra > 0 && <span>· inclui {hospedesExtra} extra a {money(adultoExtra)}/noite</span>}
                  {precoEdited && <button type="button" onClick={() => { setPrecoEdited(false); setPrecoNoite(suggested); }} style={{ background: 'none', border: 'none', color: C.coralDeep, cursor: 'pointer', fontWeight: 600, fontSize: 11.5, padding: 0 }}>repor</button>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MoneyInput value={precoNoite} onChange={e => { setPrecoNoite(e.target.value === '' ? '' : Number(e.target.value)); setPrecoEdited(true); }} style={{ flex: 1 }} />
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{money(acomod)}</span>
                </div>
              </div>
              {extras.map(e => {
                const v = (Number(e.qtd) || 0) * (Number(e.preco) || 0);
                return (
                  <div key={e.id} style={{ padding: 12, borderTop: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className="pmf" value={e.nome} onChange={ev => updExtra(e.id, { nome: ev.target.value })} placeholder="Descrição do serviço" style={{ ...cellInput, flex: 1 }} />
                      <button type="button" onClick={() => delExtra(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Trash2 size={15} /></button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className="pmf" type="number" min="0" value={e.qtd} onChange={ev => updExtra(e.id, { qtd: ev.target.value })} style={{ ...cellInput, width: 56, flexShrink: 0 }} />
                      <MoneyInput value={e.preco} onChange={ev => updExtra(e.id, { preco: ev.target.value })} style={{ flex: 1 }} />
                      <span style={{ fontWeight: 600, minWidth: 72, textAlign: 'right', color: v < 0 ? C.coralDeep : C.ink }}>{money(v)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => addExtra()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: `1px dashed ${C.line}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.ocean, fontWeight: 600, fontSize: 12.5 }}><Plus size={14} /> Adicionar item</button>
              {(data.taxasAdicionais || []).filter(tx => tx.tipo !== 'obrigatoria').map(tx => {
                const Icon = iconForExtra(tx.nome);
                return (
                  <button key={tx.id} type="button" onClick={() => addExtra({ nome: tx.nome, preco: tx.preco })} title={`${tx.nome} — Opcional`}
                    style={{ background: C.areiaSoft, border: `1px solid ${C.areia}`, borderRadius: 999, padding: '6px 12px', cursor: 'pointer', color: C.ink, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={14} strokeWidth={2.25} />
                    {money(tx.preco)}
                  </button>
                );
              })}
            </div>
            <div style={{ background: C.oceanDeep, color: '#fff', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Pago/Restante em cima (a pedido do Caio, 2026-09-23) — é a
                  informação mais consultada de relance ao abrir uma reserva. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.82)' }}>Pago: <b style={{ color: C.areia }}>{money(valorPago)}</b></div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.82)' }}>Restante: <b style={{ color: restante > 0 ? '#FFB25E' : C.areia }}>{money(restante)}</b></div>
                {restante > 0 && (
                  <button type="button" onClick={marcarComoPaga}
                    style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.32)', borderRadius: 8, padding: '6px 12px', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
                    Marcar como paga
                  </button>
                )}
              </div>
              {/* Total, com a % já paga (sobre o total) logo abaixo — em vez da
                  % sugerida do sinal, que é sempre a mesma fração fixa e diz
                  pouco; o que importa aqui é quanto do total já entrou (a
                  pedido do Caio, 2026-09-24). */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.18)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.82)' }}>Total:</span>
                  <span style={{ fontSize: 24, fontWeight: 700, fontFamily: F.disp }}>{money(total)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.68)' }}>{total > 0 ? Math.round((valorPago / total) * 100) : 0}%: <b style={{ color: C.areia }}>{money(valorPago)}</b></div>
              </div>
              {/* Histórico de pagamentos — registo do que foi de facto recebido,
                  já não um valor único adivinhado a partir do status. Reservas
                  do site entram aqui automaticamente com o valor real da
                  transação (ver api/mp-webhook.js); reservas manuais lançam-se
                  à mão abaixo. "Restante" é sempre total - soma dos
                  lançamentos, nunca gravado à parte. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.18)' }}>
                {registrosExibidos.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {registrosExibidos.map(reg => (
                      <div key={reg.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.08)', borderRadius: 7, padding: '5px 9px', fontSize: 12 }}>
                        <span style={{ flex: 1, color: '#fff', opacity: reg.legado ? .75 : 1, fontStyle: reg.legado ? 'italic' : 'normal' }}>{reg.descricao}</span>
                        <span style={{ color: 'rgba(255,255,255,.7)' }}>{fmtShort(reg.data)}</span>
                        <span style={{ fontWeight: 700, minWidth: 64, textAlign: 'right' }}>{money(reg.valor)}</span>
                        {!reg.legado && (
                          <button type="button" onClick={() => removeRegistro(reg.id)} title="Apagar lançamento"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.7)', display: 'grid', placeItems: 'center' }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input className="pmf" value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} placeholder="Descrição do pagamento"
                    style={{ ...cellInput, flex: '1 1 160px' }} />
                  <input className="pmf" type="date" value={novaData} onChange={e => setNovaData(e.target.value)}
                    style={{ ...cellInput, width: 140 }} />
                  <MoneyInput value={novoValor} onChange={e => setNovoValor(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: 110 }} />
                  <button type="button" onClick={() => commitRegistro(novaDescricao, novaData, novoValor)}
                    disabled={!novaDescricao.trim() || !(Number(novoValor) > 0)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: C.areia, border: 'none', borderRadius: 8, padding: '6px 12px', cursor: novaDescricao.trim() && Number(novoValor) > 0 ? 'pointer' : 'not-allowed', opacity: novaDescricao.trim() && Number(novoValor) > 0 ? 1 : .5, color: C.oceanDeep, fontWeight: 700, fontSize: 12.5 }}>
                    <Plus size={14} /> Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: C.inkSoft, margin: '8px 2px 0' }}>Ajuste o preço por noite ou adicione itens/descontos para negociar o valor final livremente.</p>
        </div>}
      </div>
    </Modal>
    {confirmDelete && (
      <ConfirmDialog
        message={<>Eliminar definitivamente a reserva <b>{i.codigo || ''}</b>? Esta ação não pode ser desfeita — para manter o registo sem bloquear as datas, marque o estado como Cancelada em vez disso.</>}
        onConfirm={() => { onRemove(i.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    </>
  );
}
