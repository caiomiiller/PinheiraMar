import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CalendarDays, Home, Settings, CreditCard, Users, Plus, Pencil, Trash2,
  X, ChevronLeft, ChevronRight, Waves, MapPin, Phone, Mail, Search,
  LayoutDashboard, Tag, Check, Sun, ArrowRight, Building2, Wallet,
  AlertCircle, BedDouble, Wifi, Car, Download, Upload, Database, Clock,
  Minus, Info, ChevronDown, GripVertical, Copy, Star, Heart
} from 'lucide-react';
import * as XLSX from 'xlsx';

/* ───────────────────────── Palette & type ───────────────────────── */
const C = {
  ocean: '#0E4A58', oceanDeep: '#0A3742', brisa: '#2E7E8C',
  espuma: '#EEF4F3', areia: '#E7D7B6', areiaSoft: '#F4ECD9',
  coral: '#E8744F', coralDeep: '#D65F3C',
  ink: '#15302E', inkSoft: '#506764', line: '#D9E3E1', white: '#FFFFFF',
};
const F = {
  disp: "Georgia, 'Times New Roman', serif",
  sans: "'Inter','Segoe UI',system-ui,-apple-system,Roboto,sans-serif",
};

/* ───────────────────────── Date / money helpers ───────────────────────── */
const MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYMD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const nights = (ci, co) => Math.round((parseYMD(co) - parseYMD(ci)) / MS);
const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const fmtShort = (s) => parseYMD(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const fmtLong = (s) => parseYMD(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (v) => brl.format(v || 0);
const uid = () => Math.random().toString(36).slice(2, 9);
const code = () => 'PM-' + Math.random().toString(36).slice(2, 6).toUpperCase();

const isWeekendNight = (d) => { const g = d.getDay(); return g === 5 || g === 6; }; // noites de sexta e sábado
function seasonForDate(seasons, dObj) {
  const t = dObj.getTime();
  return seasons.find(s => s.ativa !== false && parseYMD(s.inicio).getTime() <= t && t <= parseYMD(s.fim).getTime()) || null;
}
const aptRates = (season, aptId) => (season && season.precos && season.precos[aptId]) || null;
function nightlyRate(apt, seasons, dObj) {
  const p = aptRates(seasonForDate(seasons, dObj), apt.id);
  if (p) {
    const r = isWeekendNight(dObj) ? (Number(p.fimSemana) || Number(p.diaSemana) || 0) : (Number(p.diaSemana) || 0);
    if (r > 0) return Math.round(r);
  }
  return Math.round(apt.preco || 0); // tarifa base do apartamento (fallback)
}
function stayBreakdown(apt, seasons, ci, co) {
  const n = nights(ci, co);
  let total = 0; const perNight = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(parseYMD(ci), i);
    const s = seasonForDate(seasons, d);
    const rate = nightlyRate(apt, seasons, d);
    total += rate;
    perNight.push({ date: ymd(d), rate, season: s ? s.nome : 'Tarifa base', weekend: isWeekendNight(d) });
  }
  return { total, n, perNight };
}
// Intervalo meia-aberto [check-in, check-out): o dia de check-out (saída até às 10h)
// pode coincidir com o dia de check-in de outra reserva (entrada a partir das 13h),
// permitindo terminar e iniciar reservas no mesmo dia sem conflito.
const overlaps = (aCi, aCo, bCi, bCo) => parseYMD(aCi) < parseYMD(bCo) && parseYMD(aCo) > parseYMD(bCi);
function isAvailable(reservations, aptId, ci, co, ignoreId) {
  return !reservations.some(r =>
    r.apartamentoId === aptId && r.status !== 'cancelada' && r.id !== ignoreId && overlaps(ci, co, r.checkIn, r.checkOut));
}

/* ───────────────────────── Feriados (nacionais + SC + RS) ───────────────────────── */
// Páscoa pelo algoritmo de Computus (Meeus/Jones/Butcher) — base dos feriados móveis.
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
const _holCache = {};
function holidaysForYear(year) {
  if (_holCache[year]) return _holCache[year];
  const map = {};
  const add = (dObj, nome, tipo) => { (map[ymd(dObj)] = map[ymd(dObj)] || []).push({ nome, tipo }); };
  add(new Date(year, 0, 1), 'Confraternização Universal', 'Nacional');
  add(new Date(year, 3, 21), 'Tiradentes', 'Nacional');
  add(new Date(year, 4, 1), 'Dia do Trabalho', 'Nacional');
  add(new Date(year, 8, 7), 'Independência do Brasil', 'Nacional');
  add(new Date(year, 9, 12), 'Nossa Senhora Aparecida', 'Nacional');
  add(new Date(year, 10, 2), 'Finados', 'Nacional');
  add(new Date(year, 10, 15), 'Proclamação da República', 'Nacional');
  add(new Date(year, 10, 20), 'Consciência Negra', 'Nacional');
  add(new Date(year, 11, 25), 'Natal', 'Nacional');
  const easter = easterSunday(year);
  add(addDays(easter, -48), 'Carnaval (segunda)', 'Nacional');
  add(addDays(easter, -47), 'Carnaval (terça)', 'Nacional');
  add(addDays(easter, -46), 'Quarta-feira de Cinzas', 'Nacional');
  add(addDays(easter, -2), 'Sexta-feira Santa', 'Nacional');
  add(addDays(easter, 60), 'Corpus Christi', 'Nacional');
  add(new Date(year, 7, 11), 'Criação da Capitania de SC', 'SC');
  add(new Date(year, 10, 25), 'Sta. Catarina de Alexandria (padroeira)', 'SC');
  add(new Date(year, 8, 20), 'Revolução Farroupilha', 'RS');
  _holCache[year] = map;
  return map;
}
const holidaysOn = (dObj) => holidaysForYear(dObj.getFullYear())[ymd(dObj)] || null;
const HOLIDAY_COLORS = { Nacional: '#3E7CB1', SC: '#1C7A5B', RS: '#B26A2E' };
const HOLIDAY_LABELS = { Nacional: 'Nacional', SC: 'Santa Catarina', RS: 'Rio Grande do Sul' };

/* ───────────────────────── Apartamentos · serviços · países ───────────────────────── */
const vistaLabel = (v) => (v === 'Frente Mar' ? 'Frente Mar' : 'à beira mar');
// Nome completo do tipo no formato usado na base de dados (ex.: "Apto 102 - Térreo Frente Mar, 4 pessoas")
const roomFullName = (apt) => apt.tipo || `${apt.nome} - ${apt.piso} ${vistaLabel(apt.vista)}, ${apt.capacidade} pessoas`;

const EXTRA_PRESETS = [
  { nome: 'Vaga de Estacionamento p/ 1 Automóvel', preco: 50 },
  { nome: 'Higienização e Serviços de Hospedagem', preco: 175 },
  { nome: 'Taxa de limpeza', preco: 120 },
  { nome: 'Roupa de cama / banho extra', preco: 60 },
  { nome: 'Desconto de negociação', preco: -100 },
];

/* Gera os extras obrigatórios a incluir em cada nova reserva não-bloqueio */
const mkExtrasObrigatorios = (taxasAdicionais = []) =>
  taxasAdicionais
    .filter(tx => tx.tipo === 'obrigatoria')
    .map(tx => ({ id: uid(), nome: tx.nome, qtd: 1, preco: tx.preco }));

const PAISES = ['Brasil', 'Argentina', 'Uruguai', 'Paraguai', 'Chile', 'Portugal', 'Estados Unidos', 'Outro'];

/* ───────────────────────── Base de dados · exportar / importar ───────────────────────── */
const CSV_COLS = ['Reservation No', 'Guest First Name', 'Guest Last Name', 'Email', 'Country',
  'Check-In date', 'Check-Out date', 'Room', 'Unit No', 'Subtotal', 'Revenue', 'Currency', 'Create Date'];

function reservaToRow(r, apartamentos) {
  const apt = apartamentos.find(a => a.id === r.apartamentoId);
  return {
    'Reservation No': r.codigo || '',
    'Guest First Name': r.nome || (r.hospede ? r.hospede.split(' ')[0] : ''),
    'Guest Last Name': r.sobrenome || (r.hospede ? r.hospede.split(' ').slice(1).join(' ') : ''),
    'Email': r.email || '',
    'Country': r.pais || '',
    'Check-In date': r.checkIn || '',
    'Check-Out date': r.checkOut || '',
    'Room': apt ? roomFullName(apt) : '',
    'Unit No': 1,
    'Subtotal': Math.round(r.precoTabela ?? r.total ?? 0),
    'Revenue': Math.round(r.total ?? 0),
    'Currency': 'BRL',
    'Create Date': r.criadoEm || '',
  };
}
const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
function buildCSV(reservas, apartamentos) {
  const lines = [CSV_COLS.join(',')];
  reservas.forEach(r => { const row = reservaToRow(r, apartamentos); lines.push(CSV_COLS.map(c => csvCell(row[c])).join(',')); });
  return '\uFEFF' + lines.join('\r\n'); // BOM p/ acentos no Excel
}
function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
// Aceita datas em ISO (YYYY-MM-DD), número de série do Excel ou texto reconhecível.
const serialToYMD = (serial) => {
  const d = new Date(Math.floor(serial) * MS + Date.UTC(1899, 11, 30));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};
function parseAnyDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return ymd(v);
  if (typeof v === 'number' && v > 20000 && v < 80000) return serialToYMD(v); // série Excel
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const n = Number(s);
  if (!isNaN(n) && n > 20000 && n < 80000) return serialToYMD(n);
  const d = new Date(s);
  return isNaN(d) ? null : ymd(d);
}
function rowToReserva(row, apartamentos) {
  const get = (k) => { const key = Object.keys(row).find(x => x.trim().toLowerCase() === k.toLowerCase()); return key ? row[key] : undefined; };
  const roomTxt = String(get('Room') || '').trim();
  const m = roomTxt.match(/Apto\s*(\d+)/i);
  let apt = apartamentos.find(a => roomFullName(a).toLowerCase() === roomTxt.toLowerCase());
  if (!apt && m) apt = apartamentos.find(a => a.nome.replace(/\D/g, '') === m[1]);
  if (!apt) return null;
  const ci = parseAnyDate(get('Check-In date')); const co = parseAnyDate(get('Check-Out date'));
  if (!ci || !co || nights(ci, co) < 1) return null;
  const sub = Number(get('Subtotal')) || 0;
  const rev = Number(get('Revenue')) || sub || 0;
  const n = nights(ci, co);
  const first = String(get('Guest First Name') || '').trim();
  const last = String(get('Guest Last Name') || '').trim();
  return {
    id: uid(), codigo: String(get('Reservation No') || '').trim() || code(),
    apartamentoId: apt.id, checkIn: ci, checkOut: co,
    nome: first, sobrenome: last, hospede: `${first} ${last}`.trim() || 'Hóspede',
    email: String(get('Email') || '').trim(), telefone: '',
    pais: String(get('Country') || '').trim() || 'Brasil',
    adultos: 2, criancas: 0, hospedes: 2,
    precoNoite: Math.round(rev / n), precoTabela: sub || rev, extras: [], total: rev,
    sinal: Math.round(rev * 0.5), status: 'confirmada', origem: 'Importado', enviarEmail: false,
    nota: '', criadoEm: parseAnyDate(get('Create Date')) || ymd(today()),
  };
}

/* ───────────────────────── Seed data (from the screenshots) ───────────────────────── */
function seedData() {
  const apartamentos = [
    { id: 'a101', nome: 'Apto 101', tipo: 'Apto 101 - Térreo à beira mar, 4 pessoas', piso: 'Térreo', vista: 'Beira-mar', capacidade: 4, preco: 245, foto: '', ativo: true },
    { id: 'a102', nome: 'Apto 102', tipo: 'Apto 102 - Térreo Frente Mar, 4 pessoas', piso: 'Térreo', vista: 'Frente Mar', capacidade: 4, preco: 285, foto: '', ativo: true },
    { id: 'a114', nome: 'Apto 114', tipo: 'Apto 114 - Térreo à beira mar, 6 pessoas', piso: 'Térreo', vista: 'Beira-mar', capacidade: 6, preco: 320, foto: '', ativo: true },
    { id: 'a118', nome: 'Apto 118', tipo: 'Apto 118 - 1°Piso à beira mar, 2 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 2, preco: 180, foto: '', ativo: true },
    { id: 'a203', nome: 'Apto 203', tipo: 'Apto 203 - 1°Piso à beira mar, 4 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 4, preco: 250, foto: '', ativo: true },
    { id: 'a204', nome: 'Apto 204', tipo: 'Apto 204 - 1°Piso Frente Mar, 4 pessoas', piso: '1º Piso', vista: 'Frente Mar', capacidade: 4, preco: 290, foto: '', ativo: true },
    { id: 'a206', nome: 'Apto 206', tipo: 'Apto 206 - 1°Piso à beira mar, 6 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 6, preco: 330, foto: '', ativo: true },
    { id: 'a207', nome: 'Apto 207', tipo: 'Apto 207 - 1°Piso Frente Mar, 8 pessoas', piso: '1º Piso', vista: 'Frente Mar', capacidade: 8, preco: 430, foto: '', ativo: true },
    { id: 'a209', nome: 'Apto 209', tipo: 'Apto 209 - 1°Piso à beira mar, 4 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 4, preco: 250, foto: '', ativo: true },
    { id: 'a210', nome: 'Apto 210', tipo: 'Apto 210 - 1°Piso à beira mar, 4 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 4, preco: 250, foto: '', ativo: true },
    { id: 'a211', nome: 'Apto 211', tipo: 'Apto 211 - 1°Piso à beira mar, 2 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 2, preco: 190, foto: '', ativo: true },
    { id: 'a212', nome: 'Apto 212', tipo: 'Apto 212 - 1°Piso à beira mar, 2 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 2, preco: 190, foto: '', ativo: true },
    { id: 'a305', nome: 'Apto 305', tipo: 'Apto 305 - 2°Piso Frente Mar, 4 pessoas', piso: '2º Piso', vista: 'Frente Mar', capacidade: 4, preco: 300, foto: '', ativo: true },
    { id: 'a313', nome: 'Apto 313', tipo: 'Apto 313 - 2°Piso à beira mar, 8 pessoas', piso: '2º Piso', vista: 'Beira-mar', capacidade: 8, preco: 420, foto: '', ativo: true },
    { id: 'a315', nome: 'Apto 315', tipo: 'Apto 315 - 2°Piso Frente Mar, 8 pessoas', piso: '2º Piso', vista: 'Frente Mar', capacidade: 8, preco: 450, foto: '', ativo: true },
    { id: 'a316', nome: 'Apto 316', tipo: 'Apto 316 - 2°Piso à beira mar, 6 pessoas', piso: '2º Piso', vista: 'Beira-mar', capacidade: 6, preco: 340, foto: '', ativo: true },
    { id: 'a317', nome: 'Apto 317', tipo: 'Apto 317 - 2°Piso à beira mar, 6 pessoas', piso: '2º Piso', vista: 'Beira-mar', capacidade: 6, preco: 340, foto: '', ativo: true },
  ];
  // Gera preços por apartamento para uma temporada: diária × fator, fim de semana com acréscimo.
  const mkPrecos = (f, wknd = 1.15) => Object.fromEntries(apartamentos.map(a => [a.id, {
    diaSemana: Math.round(a.preco * f), fimSemana: Math.round(a.preco * f * wknd),
    semanal: 0, mensal: 0, adultoExtra: 0,
  }]));
  const seasons = [
    { id: 's1', nome: 'Baixa 2026', inicio: '2026-04-07', fim: '2026-11-30', minNoites: 2, maxNoites: null, ativa: true, precos: mkPrecos(1.0) },
    { id: 's2', nome: 'Pós-temporada 2026', inicio: '2026-02-19', fim: '2026-04-06', minNoites: 2, maxNoites: null, ativa: true, precos: mkPrecos(1.2) },
    { id: 's3', nome: 'Alta 2026-2027', inicio: '2026-12-26', fim: '2027-02-11', minNoites: 4, maxNoites: null, ativa: true, precos: mkPrecos(1.9) },
    { id: 's4', nome: 'Pré-temporada 2026-2027', inicio: '2026-12-01', fim: '2026-12-25', minNoites: 3, maxNoites: null, ativa: true, precos: mkPrecos(1.4) },
    { id: 's5', nome: 'Pós-temporada 2027', inicio: '2027-02-12', fim: '2027-03-29', minNoites: 2, maxNoites: null, ativa: true, precos: mkPrecos(1.2) },
    { id: 's6', nome: 'Alta 2025-2026', inicio: '2025-12-26', fim: '2026-02-18', minNoites: 4, maxNoites: null, ativa: true, precos: mkPrecos(1.9) },
    { id: 's7', nome: 'Pré-temporada 2025-2026', inicio: '2025-12-01', fim: '2025-12-25', minNoites: 3, maxNoites: null, ativa: true, precos: mkPrecos(1.4) },
  ];
  const byId = Object.fromEntries(apartamentos.map(a => [a.id, a]));
  const mk = (aptId, ci, co, nome, sobrenome, adultos, criancas, status, origem, contacto, extras = []) => {
    const apt = byId[aptId];
    const bd = stayBreakdown(apt, seasons, ci, co);
    const n = Math.max(1, bd.n);
    const precoNoite = status === 'bloqueio' ? 0 : Math.round(bd.total / n);
    const extrasVal = extras.reduce((s, e) => s + e.qtd * e.preco, 0);
    const total = status === 'bloqueio' ? 0 : precoNoite * n + extrasVal;
    return {
      id: uid(), codigo: code(), apartamentoId: aptId, checkIn: ci, checkOut: co,
      nome: status === 'bloqueio' ? '' : nome, sobrenome: status === 'bloqueio' ? '' : sobrenome,
      hospede: status === 'bloqueio' ? '' : `${nome} ${sobrenome}`.trim(),
      email: contacto?.email || '', telefone: contacto?.tel || '', pais: contacto?.pais || 'Brasil',
      adultos: status === 'bloqueio' ? 0 : adultos, criancas: status === 'bloqueio' ? 0 : criancas,
      hospedes: status === 'bloqueio' ? 0 : adultos + criancas,
      precoNoite, precoTabela: status === 'bloqueio' ? 0 : bd.total,
      extras: extras.map(e => ({ id: uid(), ...e })), total, sinal: Math.round(total * 0.5),
      status, origem, enviarEmail: false,
      nota: status === 'bloqueio' ? 'Manutenção / bloqueio interno' : '', criadoEm: ymd(today()),
    };
  };
  const reservas = [
    mk('a207', '2026-06-13', '2026-06-20', 'Carlos', 'Andrade', 5, 1, 'confirmada', 'Site', { email: 'andrade@email.com', tel: '47 99123-4567' }, [{ nome: 'Vaga de Estacionamento p/ 1 Automóvel', qtd: 1, preco: 50 }, { nome: 'Higienização e Serviços de Hospedagem', qtd: 1, preco: 175 }]),
    mk('a101', '2026-06-15', '2026-06-18', 'Mariana', 'Lopes', 3, 0, 'confirmada', 'WhatsApp', { email: 'mari.lopes@email.com', tel: '48 99888-1122' }),
    mk('a305', '2026-06-19', '2026-06-26', 'Rui', 'Tavares', 2, 0, 'pendente', 'Site', { email: 'rui.t@email.com', tel: '21 99777-3344' }),
    // Turnover no mesmo dia (14/06): João sai até às 10h e a Família Becker entra a partir das 13h
    mk('a204', '2026-06-12', '2026-06-14', 'João', 'Pereira', 4, 0, 'confirmada', 'Telefone', { email: 'jp@email.com', tel: '48 99555-9090' }),
    mk('a204', '2026-06-14', '2026-06-19', 'Helena', 'Becker', 3, 1, 'confirmada', 'Site', { email: 'becker@email.com', tel: '51 99444-2211' }),
    mk('a206', '2026-06-16', '2026-06-21', 'Diego', 'Martins', 4, 2, 'confirmada', 'Booking', { email: 'diego.m@email.com', tel: '48 99222-7788', pais: 'Argentina' }, [{ nome: 'Desconto de negociação', qtd: 1, preco: -150 }]),
    mk('a102', '2026-06-22', '2026-06-25', '', '', 0, 0, 'bloqueio', 'Manual', {}),
  ];
  const settings = {
    nome: 'Residencial PinheiraMar', tipo: 'Apartamento',
    email: 'contato@pinheiramar.com.br', telefone: '48 98476-1800',
    cidade: 'Palhoça - Santa Catarina, Brasil',
    endereco: 'Rua Dom Patrício 82 - Praia da Pinheira', cep: '88.139-427',
    fuso: '(GMT-03:00) América/São Paulo', moeda: 'Real Brasileiro (R$)',
    sinalPct: 50, checkInHora: '13:00', checkOutHora: '10:00',
    politicas: {
      reservas: {
        titulo: 'Termos e Políticas de Hospedagem',
        texto: `IMPORTANTE

• Por questões de segurança e privacidade dos demais hóspedes, visitas e convidados só serão permitidos mediante autorização prévia. As dependências do residencial — incluindo áreas internas e apartamentos — são de uso exclusivo dos hóspedes registados.

• Mínimo de 2 (duas) diárias em períodos regulares. Em feriados e datas festivas, o mínimo varia conforme o pacote — consulte nossos canais de atendimento.

• O Residencial oferece apartamentos mobiliados para locação de temporada. Não estão incluídos: café da manhã, roupas de cama/mesa/banho, itens de higiene pessoal nem utensílios de praia.

CHECK-IN: 13h00 | CHECK-OUT: 10h00

---

1. PAGAMENTO

• Para pagamento via cartão de crédito ou Pix/transferência bancária: 50% do valor total antecipado para confirmar a reserva; os 50% restantes + taxas devem ser pagos no check-in.
• Tarifas Promocionais: pagamento de 100% no acto da reserva. Não reembolsável.
• A confirmação da reserva é efectuada somente após a recepção do sinal de 50% (ou 100% em tarifas promocionais).

---

2. COMO RESERVAR

Acesse www.pinheiramar.com.br ou entre em contacto via WhatsApp/redes sociais.

---

3. HOSPEDAGEM

• Lei do silêncio: das 22h às 7h (excepto Réveillon e Carnaval).
• O acesso aos apartamentos é restrito exclusivamente aos hóspedes registados.
• A chave é retirada no check-in e devolvida no check-out. Perda da chave ou controle de portão: R$ 50,00.
• Danos ou extravios do patrimônio do residencial serão cobrados pelo valor de reposição.
• É proibido pendurar roupas em áreas comuns.
• Manter torneiras, luzes e ar condicionado desligados quando não houver ninguém no apartamento.

---

4. POLÍTICA DE PETS

• Aceitos cães e gatos com mais de 6 meses e até 10 kg (máximo 2 pets por apartamento).
• Taxa única de R$ 150,00 por pet.
• O proprietário é responsável pela limpeza, silêncio e uso de tapete higiênico dentro do apartamento.
• Não é permitido utilizar utensílios do apartamento para o animal.

---

5. ESTACIONAMENTO

• Cada apartamento tem direito a 1 vaga de garagem.
• Vaga adicional: taxa única de R$ 50,00 por automóvel (sujeito a disponibilidade).

---

6. LOCAÇÕES DISPONÍVEIS

Jogo de lençol R$ 28,00 · Manta R$ 30,00 · Toalha (banho + rosto) R$ 13,00 · Rede R$ 15,00 · Cooler R$ 25,00 · Cadeira de praia R$ 10,00/dia (acima de 5 dias: R$ 50,00/unidade).`,
      },
      cancelamento: {
        titulo: 'Política de Cancelamento',
        texto: `Solicitações de cancelamento são aceitas exclusivamente por ligação ou WhatsApp: (48) 98476-1800, pelo titular da reserva.

PRAZOS E CONDIÇÕES

• Cancelamento ou troca de data com mais de 31 dias de antecedência do check-in:
  → Emissão de Voucher no valor já antecipado, válido para nova reserva.

• Cancelamento ou troca de data entre 16 e 30 dias de antecedência do check-in:
  → Cobrança de 50% do valor total da estadia. O valor eventualmente excedente não será reembolsado.

• Cancelamento com menos de 15 dias de antecedência do check-in:
  → Cobrança de 100% do valor total da estadia. Sem reembolso.

• No-show (não comparecimento sem aviso prévio):
  → Cobrança de 100% do valor total da hospedagem. Sem reembolso.

• Cancelamentos ou alterações realizados após o check-in:
  → Cobrança de 100% do valor total da hospedagem. Sem reembolso.

• Tarifas Promocionais:
  → Não reembolsáveis em nenhuma situação.

NOTA: A contagem de dias é feita em relação à data de check-in. Todos os prazos referem-se a dias corridos.`,
      },
    },
    idiomas: [
      { codigo: 'pt', nome: 'Português', nativo: 'Português', bandeira: '🇧🇷', principal: true, ativo: true },
      { codigo: 'es', nome: 'Espanhol', nativo: 'Español', bandeira: '🇦🇷', principal: false, ativo: true },
      { codigo: 'en', nome: 'Inglês', nativo: 'English', bandeira: '🇺🇸', principal: false, ativo: true },
    ],
  };
  const pagamentos = [
    {
      id: 'mercadopago', nome: 'Mercado Pago', cor: '#00B1EA', conectado: false,
      taxa: 'Pix 0% · Cartão à vista 3,79% · Parcelado até 4,99%',
      desc: ['Pix com confirmação instantânea (0% de taxa)', 'Parcelamento em até 12x sem juros para o hóspede', 'Link de pagamento por WhatsApp — sem app necessário', 'Recebimento: Pix imediato · Cartão D+14 ou D+2 (+1%)'],
      link: 'https://www.mercadopago.com.br/conta',
    },
    {
      id: 'pagseguro', nome: 'PagSeguro', cor: '#00A859', conectado: false,
      taxa: 'Pix 0% · Cartão à vista 3,99% · Parcelado até 4,99%',
      desc: ['Pix gratuito com QR Code por reserva', 'Parcelamento em até 12x sem juros', 'Conta digital PagBank integrada', 'Recebimento: Pix imediato · Cartão D+14'],
      link: 'https://pagseguro.uol.com.br',
    },
    {
      id: 'asaas', nome: 'Asaas', cor: '#1A56DB', conectado: false,
      taxa: 'Pix 1% (mín. R$1) · Cartão à vista 2,99% · Boleto R$3,00',
      desc: ['Especializado em cobranças recorrentes e links únicos', 'Emissão automática de boleto, Pix e cartão por reserva', 'API simples — ideal para integração com motor de reservas', 'Recebimento: Pix D+0 · Cartão D+2'],
      link: 'https://www.asaas.com',
    },
    {
      id: 'pix', nome: 'Pix Manual', cor: '#32BCAD', conectado: true,
      taxa: '0% — sem nenhuma taxa',
      desc: ['Hóspede transfere directamente para a sua chave Pix', 'Confirme o pagamento manualmente e actualize a reserva', 'Ideal para o sinal de 50% por WhatsApp', 'Chave recomendada: CNPJ ou telefone do residencial'],
      link: '',
    },
    {
      id: 'offline', nome: 'Pagamento presencial', cor: C.ocean, conectado: true,
      taxa: '0% — sem comissões',
      desc: ['Cartão na maquininha, dinheiro ou Pix no check-in', 'Ideal para o saldo de 50% restante na chegada', 'Sem necessidade de integração digital'],
      link: '',
    },
  ];
  const taxasAdicionais = [
    { id: 'tx1', nome: 'Vaga de Estacionamento p/ 1 Automóvel (taxa única)', preco: 50,  tipo: 'obrigatoria', por: 'reserva' },
    { id: 'tx2', nome: 'Higienização e Serviços de Hospedagem',               preco: 175, tipo: 'obrigatoria', por: 'reserva' },
    { id: 'tx3', nome: 'Quero levar meu Pet (taxa única)',                     preco: 200, tipo: 'opcional',    por: 'reserva' },
    { id: 'tx4', nome: 'Kit Praia (2 cadeiras + 1 Guarda Sol)',                preco: 75,  tipo: 'opcional',    por: 'reserva' },
    { id: 'tx5', nome: 'Vaga Adicional de Estacionamento',                     preco: 50,  tipo: 'opcional',    por: 'reserva' },
  ];
  const cupons = [
    { id: 'cup1', nome: 'Desconto Fidelidade', codigo: 'PINHEIRA10', tipo: 'percentagem', valor: 10, inicio: '2026-01-01', fim: '2026-12-31', usos: 0, maxUsos: 100, ativo: true },
  ];
  return { apartamentos, seasons, reservas, settings, pagamentos, taxasAdicionais, cupons };
}

/* ───────────────────────── Persistent storage ───────────────────────── */
const STORE_KEY = 'pinheiramar:data:v4';
let memFallback = null;
async function loadData() {
  try { if (window.storage) { const r = await window.storage.get(STORE_KEY); if (r && r.value) return JSON.parse(r.value); } }
  catch (e) { /* key absent → seed */ }
  return memFallback;
}
async function saveData(d) {
  memFallback = d;
  try { if (window.storage) await window.storage.set(STORE_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
}

/* ───────────────────────── UI atoms ───────────────────────── */
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${C.line}`, background: C.white, color: C.ink, fontSize: '14px', outline: 'none', fontFamily: F.sans };
const TextInput = (p) => <input {...p} className="pmf" style={{ ...inputStyle, ...(p.style || {}) }} />;
const DateInput = (p) => <input type="date" {...p} className="pmf" style={{ ...inputStyle, ...(p.style || {}) }} />;
const NumberInput = (p) => <input type="number" {...p} className="pmf" style={{ ...inputStyle, ...(p.style || {}) }} />;
const Select = ({ children, ...p }) => <select {...p} className="pmf" style={{ ...inputStyle, appearance: 'auto', ...(p.style || {}) }}>{children}</select>;
const Textarea = (p) => <textarea {...p} className="pmf" style={{ ...inputStyle, minHeight: 70, resize: 'vertical', ...(p.style || {}) }} />;

function Btn({ variant = 'primary', size = 'md', children, style, icon: Icon, ...p }) {
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: F.sans, fontWeight: 600, borderRadius: '10px', cursor: 'pointer', border: '1px solid transparent', transition: 'all .15s ease', whiteSpace: 'nowrap' };
  const sizes = { sm: { padding: '7px 12px', fontSize: 13 }, md: { padding: '10px 16px', fontSize: 14 }, lg: { padding: '13px 22px', fontSize: 15 } };
  const variants = {
    primary: { background: C.ocean, color: '#fff' },
    accent: { background: C.coral, color: '#fff' },
    ghost: { background: 'transparent', color: C.ocean, border: `1px solid ${C.line}` },
    soft: { background: C.areiaSoft, color: C.ink, border: `1px solid ${C.areia}` },
    danger: { background: 'transparent', color: '#B23B3B', border: '1px solid #E7C4C4' },
  };
  return (
    <button {...p} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.94)'; }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
      {Icon && <Icon size={size === 'sm' ? 15 : 17} />}{children}
    </button>
  );
}

function Modal({ title, subtitle, onClose, children, footer, wide }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,40,46,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 14px', zIndex: 50, overflowY: 'auto', backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} className="pm-pop" style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: wide ? 760 : 520, boxShadow: '0 24px 70px rgba(10,40,46,.35)', overflow: 'hidden', marginTop: 12 }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 style={{ fontFamily: F.disp, fontSize: 22, color: C.ink, margin: 0, lineHeight: 1.1 }}>{title}</h3>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: C.inkSoft }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ background: C.espuma, border: 'none', borderRadius: 9, width: 34, height: 34, cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.inkSoft }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 22px' }}>{children}</div>
        {footer && <div style={{ padding: '16px 22px', borderTop: `1px solid ${C.line}`, background: C.espuma, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

const Field = ({ label, children, hint, required }) => (
  <label style={{ display: 'block' }}>
    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.inkSoft, marginBottom: 6, letterSpacing: '.01em' }}>
      {label}{required && <span style={{ color: C.coral }}> *</span>}
    </span>
    {children}
    {hint && <span style={{ display: 'block', fontSize: 12, color: C.inkSoft, marginTop: 5 }}>{hint}</span>}
  </label>
);

const STATUS = {
  confirmada: { label: 'Confirmada', bg: '#E1F0EC', fg: '#1C7A5B', bar: '#2E9E78' },
  pendente: { label: 'Pendente', bg: '#FBEFD9', fg: '#9A6A14', bar: '#E0A23A' },
  bloqueio: { label: 'Bloqueio', bg: '#E9ECEC', fg: '#5C6B6A', bar: '#8A9896' },
  cancelada: { label: 'Cancelada', bg: '#F3E3E3', fg: '#A24C4C', bar: '#C98B8B' },
};
const Badge = ({ status }) => {
  const s = STATUS[status] || STATUS.pendente;
  return <span style={{ background: s.bg, color: s.fg, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>{s.label}</span>;
};

function PhotoTile({ apt, h = 184, radius = 14 }) {
  if (apt.foto) {
    return <div style={{ height: h, borderRadius: radius, overflow: 'hidden', background: `center/cover no-repeat url(${apt.foto})`, position: 'relative' }}>
      <span style={tilePill}>{apt.vista}</span>
    </div>;
  }
  let seed = 0; for (const ch of (apt.id || apt.nome || 'x')) seed = (seed * 31 + ch.charCodeAt(0)) % 360;
  const sky = `hsl(${198 + seed % 16}, 64%, 87%)`;
  const sea1 = `hsl(${189 + seed % 18}, 50%, 53%)`;
  const sea2 = `hsl(${196 + seed % 14}, 58%, 37%)`;
  return (
    <div style={{ position: 'relative', height: h, borderRadius: radius, overflow: 'hidden', background: `linear-gradient(180deg, ${sky} 0%, ${sea1} 56%, ${sea2} 100%)` }}>
      <div style={{ position: 'absolute', top: 16, right: 18, width: 32, height: 32, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #FFF4D8, #F9CE74)', boxShadow: '0 0 22px rgba(249,206,116,.75)' }} />
      <svg viewBox="0 0 400 130" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '48%' }}>
        <path d="M0,42 C60,12 120,72 200,46 C280,20 340,76 400,46 L400,130 L0,130 Z" fill="rgba(255,255,255,.22)" />
        <path d="M0,72 C70,46 140,96 210,72 C290,48 350,92 400,70 L400,130 L0,130 Z" fill="#ECDCB9" />
      </svg>
      <span style={tilePill}>{apt.vista}</span>
    </div>
  );
}
const tilePill = { position: 'absolute', left: 12, top: 12, background: 'rgba(14,74,88,.78)', color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999, backdropFilter: 'blur(3px)' };

/* ═══════════════════════════ PUBLIC BOOKING SITE ═══════════════════════════ */
/* ═══════════════════════════ i18n ═══════════════════════════ */
const TRANSLATIONS = {
  pt: {
    /* header */
    nav_location: 'Praia da Pinheira, SC',
    /* hero */
    hero_tag: 'Frente para o mar',
    hero_loc: 'Praia da Pinheira, Palhoça — Santa Catarina',
    hero_title: 'Residencial PinheiraMar',
    hero_desc: 'Apartamentos residenciais completos, à beira-mar. Escolha as datas, veja a disponibilidade em tempo real e reserve a unidade ideal — o valor é por apartamento.',
    hero_chip1: 'Vista mar', hero_chip2: 'Wi-Fi grátis', hero_chip3: 'Estacionamento',
    hero_chip4: '2 a 8 hóspedes', hero_chip5: 'Apartamento completo',
    /* search */
    search_checkin: 'Check-in', search_checkout: 'Check-out',
    search_who: 'Quem', search_guests: 'Hóspedes',
    search_btn: 'Procurar', search_confirm: 'Confirmar',
    search_nights: (n) => `${n} ${n === 1 ? 'noite' : 'noites'}`,
    search_guests_label: (n) => `${n} hóspede${n > 1 ? 's' : ''}`,
    search_add_guests: 'Adicionar viajantes',
    /* results */
    results_title: (n) => `Apartamentos em Praia da Pinheira`,
    results_sub: (n) => `${n} alojamentos · Pinheira, Palhoça — Santa Catarina`,
    results_avail: (n) => `${n} ${n === 1 ? 'disponível' : 'disponíveis'}`,
    results_avail_for: (ci, co) => ` para ${ci}–${co}`,
    combo_title: (n) => `Para ${n} hóspedes é necessário combinar apartamentos.`,
    combo_max: (n) => `Cada unidade acomoda no máximo ${n} pessoas.`,
    combo_suggest: (names, cap) => ` Sugestão: reserve ${names} — juntos acomodam até ${cap} pessoas.`,
    combo_none: ' Sem unidades disponíveis suficientes nestas datas.',
    combo_book: (nome) => `Reservar ${nome}`,
    /* card */
    card_unavail: 'Indisponível', card_combine: 'Combinar',
    card_guests: (n) => `${n} hóspedes · apartamento completo`,
    card_combine_hint: (n) => `Para ${n} pessoas, combine com outra unidade`,
    card_night: 'noite', card_total: 'Total:',
    /* category pills */
    cat1: 'Frente Mar', cat2: 'Apartamento', cat3: 'Estacionamento',
    cat4: 'Wi-Fi', cat5: 'Famílias', cat6: 'Vista Mar', cat7: 'Praia', cat8: '2-8 pessoas',
    /* booking modal */
    book_title: (nome) => `Reservar ${nome}`, book_name: 'Nome completo',
    book_email: 'E-mail', book_phone: 'Telefone', book_guests: 'Hóspedes',
    book_total: 'Total', book_signal: 'Sinal (50%)', book_confirm: 'Confirmar reserva',
    book_cancel: 'Cancelar',
    /* footer */
    footer_copy: (y) => `© ${y} Residencial PinheiraMar · Praia da Pinheira, Palhoça — SC`,
  },
  es: {
    nav_location: 'Playa de Pinheira, SC',
    hero_tag: 'Frente al mar',
    hero_loc: 'Playa de Pinheira, Palhoça — Santa Catarina',
    hero_title: 'Residencial PinheiraMar',
    hero_desc: 'Apartamentos residenciales completos frente al mar. Elige las fechas, consulta la disponibilidad en tiempo real y reserva tu unidad — el precio es por apartamento.',
    hero_chip1: 'Vista al mar', hero_chip2: 'Wi-Fi gratis', hero_chip3: 'Estacionamiento',
    hero_chip4: '2 a 8 huéspedes', hero_chip5: 'Apartamento completo',
    search_checkin: 'Check-in', search_checkout: 'Check-out',
    search_who: 'Quién', search_guests: 'Huéspedes',
    search_btn: 'Buscar', search_confirm: 'Confirmar',
    search_nights: (n) => `${n} ${n === 1 ? 'noche' : 'noches'}`,
    search_guests_label: (n) => `${n} huésped${n > 1 ? 'es' : ''}`,
    search_add_guests: 'Añadir viajeros',
    results_title: () => 'Apartamentos en Playa de Pinheira',
    results_sub: (n) => `${n} alojamientos · Pinheira, Palhoça — Santa Catarina`,
    results_avail: (n) => `${n} ${n === 1 ? 'disponible' : 'disponibles'}`,
    results_avail_for: (ci, co) => ` para ${ci}–${co}`,
    combo_title: (n) => `Para ${n} huéspedes es necesario combinar apartamentos.`,
    combo_max: (n) => `Cada unidad admite un máximo de ${n} personas.`,
    combo_suggest: (names, cap) => ` Sugerencia: reserva ${names} — juntos admiten hasta ${cap} personas.`,
    combo_none: ' Sin unidades disponibles suficientes en estas fechas.',
    combo_book: (nome) => `Reservar ${nome}`,
    card_unavail: 'No disponible', card_combine: 'Combinar',
    card_guests: (n) => `${n} huéspedes · apartamento completo`,
    card_combine_hint: (n) => `Para ${n} personas, combina con otra unidad`,
    card_night: 'noche', card_total: 'Total:',
    cat1: 'Frente al mar', cat2: 'Apartamento', cat3: 'Estacionamiento',
    cat4: 'Wi-Fi', cat5: 'Familias', cat6: 'Vista al mar', cat7: 'Playa', cat8: '2-8 personas',
    book_title: (nome) => `Reservar ${nome}`, book_name: 'Nombre completo',
    book_email: 'Correo electrónico', book_phone: 'Teléfono', book_guests: 'Huéspedes',
    book_total: 'Total', book_signal: 'Señal (50%)', book_confirm: 'Confirmar reserva',
    book_cancel: 'Cancelar',
    footer_copy: (y) => `© ${y} Residencial PinheiraMar · Playa de Pinheira, Palhoça — SC`,
  },
  en: {
    nav_location: 'Pinheira Beach, SC',
    hero_tag: 'Oceanfront',
    hero_loc: 'Pinheira Beach, Palhoça — Santa Catarina, Brazil',
    hero_title: 'Residencial PinheiraMar',
    hero_desc: 'Complete residential apartments by the sea. Choose your dates, check real-time availability and book your unit — pricing is per apartment.',
    hero_chip1: 'Ocean view', hero_chip2: 'Free Wi-Fi', hero_chip3: 'Parking',
    hero_chip4: '2 to 8 guests', hero_chip5: 'Full apartment',
    search_checkin: 'Check-in', search_checkout: 'Check-out',
    search_who: 'Who', search_guests: 'Guests',
    search_btn: 'Search', search_confirm: 'Confirm',
    search_nights: (n) => `${n} ${n === 1 ? 'night' : 'nights'}`,
    search_guests_label: (n) => `${n} guest${n > 1 ? 's' : ''}`,
    search_add_guests: 'Add travellers',
    results_title: () => 'Apartments at Pinheira Beach',
    results_sub: (n) => `${n} listings · Pinheira Beach, Palhoça — Santa Catarina`,
    results_avail: (n) => `${n} ${n === 1 ? 'available' : 'available'}`,
    results_avail_for: (ci, co) => ` for ${ci}–${co}`,
    combo_title: (n) => `For ${n} guests you need to combine apartments.`,
    combo_max: (n) => `Each unit accommodates a maximum of ${n} people.`,
    combo_suggest: (names, cap) => ` Suggestion: book ${names} — together they fit up to ${cap} people.`,
    combo_none: ' Not enough available units for these dates.',
    combo_book: (nome) => `Book ${nome}`,
    card_unavail: 'Unavailable', card_combine: 'Combine',
    card_guests: (n) => `${n} guests · full apartment`,
    card_combine_hint: (n) => `For ${n} people, combine with another unit`,
    card_night: 'night', card_total: 'Total:',
    cat1: 'Oceanfront', cat2: 'Apartment', cat3: 'Parking',
    cat4: 'Wi-Fi', cat5: 'Families', cat6: 'Ocean view', cat7: 'Beach', cat8: '2-8 guests',
    book_title: (nome) => `Book ${nome}`, book_name: 'Full name',
    book_email: 'Email', book_phone: 'Phone', book_guests: 'Guests',
    book_total: 'Total', book_signal: 'Deposit (50%)', book_confirm: 'Confirm booking',
    book_cancel: 'Cancel',
    footer_copy: (y) => `© ${y} Residencial PinheiraMar · Pinheira Beach, Palhoça — SC, Brazil`,
  },
};

/* Hook — resolves a translation key; falls back to PT if missing */
function useT(lang) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS['pt'];
  return (key, ...args) => {
    const val = dict[key] ?? TRANSLATIONS['pt'][key];
    if (typeof val === 'function') return val(...args);
    return val ?? key;
  };
}

/* ── IdiomasView ── */
/* ── TaxasView ── */
function TaxasView({ data, update }) {
  const taxas = data.taxasAdicionais || [];
  const [editing, setEditing] = useState(null);

  const save = (tx) => {
    update(prev => {
      const list = prev.taxasAdicionais || [];
      const exists = list.some(x => x.id === tx.id);
      return { ...prev, taxasAdicionais: exists ? list.map(x => x.id === tx.id ? tx : x) : [...list, tx] };
    });
    setEditing(null);
  };
  const remove = (id) => update(prev => ({ ...prev, taxasAdicionais: (prev.taxasAdicionais || []).filter(x => x.id !== id) }));
  const dnd = useReorder(taxas, arr => update(prev => ({ ...prev, taxasAdicionais: arr })));

  const TIPO_LABEL = { obrigatoria: 'Obrigatória', opcional: 'Opcional' };
  const POR_LABEL  = { reserva: 'Reserva', noite: 'Noite', hospede: 'Hóspede' };

  return (
    <div>
      <PageHead title="Taxas Adicionais"
        sub="Taxas obrigatórias ou opcionais apresentadas ao hóspede durante a reserva · arraste para ordenar."
        action={<Btn icon={Plus} onClick={() => setEditing('new')}>Adicionar</Btn>} />

      <div style={{ display: 'grid', gap: 0, background: '#fff', borderRadius: 16, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
        {taxas.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: C.inkSoft, fontSize: 14 }}>
            Nenhuma taxa configurada. Clique em <b>Adicionar</b> para criar a primeira.
          </div>
        )}
        {taxas.map((tx, idx) => (
          <div key={tx.id} {...dnd.zone(idx)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: idx < taxas.length - 1 ? `1px solid ${C.line}` : 'none', ...dnd.deco(idx) }}>
            <DragGrip {...dnd.grip(idx)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: C.ocean, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.nome}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, minWidth: 64, textAlign: 'right' }}>{money(tx.preco)}</div>
            <div style={{ minWidth: 90, textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: tx.tipo === 'obrigatoria' ? '#1C7A5B' : C.inkSoft, background: tx.tipo === 'obrigatoria' ? '#D1FAE5' : C.espuma, borderRadius: 999, padding: '3px 10px', fontWeight: 600 }}>
                {TIPO_LABEL[tx.tipo] || tx.tipo}
              </span>
            </div>
            <div style={{ minWidth: 72, fontSize: 13, color: C.inkSoft, textAlign: 'center' }}>{POR_LABEL[tx.por] || tx.por}</div>
            <button onClick={() => setEditing(tx)} style={iconBtn} title="Editar"><Pencil size={15} /></button>
            <button onClick={() => remove(tx.id)} style={{ ...iconBtn, color: '#B23B3B' }} title="Eliminar"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, padding: '12px 16px', background: '#EEF6FF', border: '1px solid #BDD9F8', borderRadius: 12, fontSize: 13, color: '#1A4A7A' }}>
        <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        As taxas <b>obrigatórias</b> são adicionadas automaticamente a cada reserva. As <b>opcionais</b> ficam disponíveis como chips rápidos no formulário de reserva para o gestor adicionar manualmente.
      </div>

      {editing && <TaxaForm initial={editing === 'new' ? null : editing} isNew={editing === 'new'} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TaxaForm({ initial, isNew, onSave, onClose }) {
  const i = initial || {};
  const [nome, setNome] = useState(i.nome || '');
  const [preco, setPreco] = useState(i.preco ?? 0);
  const [tipo, setTipo] = useState(i.tipo || 'opcional');
  const [por, setPor] = useState(i.por || 'reserva');
  const ok = nome.trim() && Number(preco) >= 0;

  return (
    <Modal
      title={isNew ? 'Adicionar Taxa Adicional' : 'Editar Sua Taxa Adicional'}
      onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={!ok} style={{ opacity: ok ? 1 : .5 }}
          onClick={() => onSave({ id: i.id || ('tx' + uid()), nome: nome.trim(), preco: Number(preco), tipo, por })}>
          {isNew ? 'Adicionar' : 'Salvar alterações'}
        </Btn>
      </>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Field label="Nomeie sua taxa" required hint="ⓘ">
          <TextInput value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Higienização e Serviços de Hospedagem" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Adicione a taxa por" hint="ⓘ">
            <Select value={por} onChange={e => setPor(e.target.value)}>
              <option value="reserva">Reserva</option>
              <option value="noite">Noite</option>
              <option value="hospede">Hóspede</option>
            </Select>
          </Field>
          <Field label="Defina o preço">
            <MoneyInput value={preco} onChange={e => setPreco(e.target.value === '' ? '' : Number(e.target.value))} />
          </Field>
          <Field label="Defina o tipo de taxa" hint="ⓘ">
            <Select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="obrigatoria">Obrigatória</option>
              <option value="opcional">Opcional</option>
            </Select>
          </Field>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: C.inkSoft }}>
          * Campos obrigatórios
        </p>
      </div>
    </Modal>
  );
}

/* ── CuponsView ── */
function CuponsView({ data, update }) {
  const cupons = data.cupons || [];
  const [editing, setEditing] = useState(null);
  const t = today();

  const save = (c) => {
    update(prev => {
      const list = prev.cupons || [];
      const exists = list.some(x => x.id === c.id);
      return { ...prev, cupons: exists ? list.map(x => x.id === c.id ? c : x) : [...list, c] };
    });
    setEditing(null);
  };
  const remove = (id) => update(prev => ({ ...prev, cupons: (prev.cupons || []).filter(x => x.id !== id) }));

  const statusCupon = (c) => {
    if (!c.ativo) return { label: 'Inactivo', cor: C.inkSoft, bg: C.espuma };
    if (parseYMD(c.fim) < t) return { label: 'Expirado', cor: '#B23B3B', bg: '#FFF5F5' };
    if (c.maxUsos > 0 && c.usos >= c.maxUsos) return { label: 'Esgotado', cor: '#B26A2E', bg: '#FBF1E6' };
    return { label: 'Activo', cor: '#1C7A5B', bg: '#D1FAE5' };
  };

  return (
    <div>
      <PageHead title="Cupons de Desconto"
        sub="Crie códigos promocionais para os seus hóspedes."
        action={<Btn icon={Plus} onClick={() => setEditing('new')}>Adicionar</Btn>} />

      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
        {/* header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 0.6fr 80px 72px', gap: 12, padding: '10px 20px', background: C.espuma, borderBottom: `1px solid ${C.line}`, fontSize: 12, fontWeight: 700, color: C.inkSoft }}>
          <span>NOME / CÓDIGO</span><span>DESCONTO</span><span>VALIDADE</span><span>USOS</span><span>ESTADO</span><span></span>
        </div>
        {cupons.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: C.inkSoft, fontSize: 14 }}>
            Nenhum cupão criado ainda. Clique em <b>Adicionar</b> para criar o primeiro.
          </div>
        )}
        {cupons.map((c, idx) => {
          const st = statusCupon(c);
          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 0.6fr 80px 72px', gap: 12, alignItems: 'center', padding: '14px 20px', borderBottom: idx < cupons.length - 1 ? `1px solid ${C.line}` : 'none' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.ocean, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</div>
                <div style={{ fontSize: 12.5, fontFamily: 'monospace', color: C.inkSoft, marginTop: 2, letterSpacing: '.04em' }}>{c.codigo}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {c.tipo === 'percentagem' ? `${c.valor}%` : money(c.valor)}
                <div style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: 400 }}>{c.tipo === 'percentagem' ? 'desconto' : 'valor fixo'}</div>
              </div>
              <div style={{ fontSize: 13 }}>
                {fmtShort(c.inicio)} – {fmtShort(c.fim)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.usos} / {c.maxUsos === 0 ? '∞' : c.maxUsos}</div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: st.cor, background: st.bg, borderRadius: 999, padding: '3px 9px' }}>{st.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditing(c)} style={iconBtn} title="Editar"><Pencil size={14} /></button>
                <button onClick={() => remove(c.id)} style={{ ...iconBtn, color: '#B23B3B' }} title="Eliminar"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* apply cupon note */}
      <div style={{ marginTop: 14, padding: '12px 16px', background: '#EEF6FF', border: '1px solid #BDD9F8', borderRadius: 12, fontSize: 13, color: '#1A4A7A' }}>
        <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Para aplicar um cupão a uma reserva, abra a reserva no painel e adicione o desconto manualmente no campo de extras (valor negativo). A validação automática no checkout requer integração com backend.
      </div>

      {editing && <CuponForm initial={editing === 'new' ? null : editing} isNew={editing === 'new'} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CuponForm({ initial, isNew, onSave, onClose }) {
  const i = initial || {};
  const t = today();
  const [nome, setNome] = useState(i.nome || '');
  const [codigo, setCodigo] = useState(i.codigo || '');
  const [tipo, setTipo] = useState(i.tipo || 'percentagem');
  const [valor, setValor] = useState(i.valor ?? 10);
  const [inicio, setInicio] = useState(i.inicio || ymd(t));
  const [fim, setFim] = useState(i.fim || ymd(addDays(t, 180)));
  const [maxUsos, setMaxUsos] = useState(i.maxUsos ?? 1);
  const [ativo, setAtivo] = useState(i.ativo !== false);
  const ok = nome.trim() && codigo.trim() && Number(valor) > 0;

  const gerarCodigo = () => {
    const base = nome.trim().split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCodigo(base + Math.floor(Math.random() * 900 + 100));
  };

  return (
    <Modal title={isNew ? 'Criar Cupão de Desconto' : `Editar — ${i.nome}`} onClose={onClose} wide
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={!ok} style={{ opacity: ok ? 1 : .5 }}
          onClick={() => onSave({
            id: i.id || ('cup' + uid()), nome: nome.trim(),
            codigo: codigo.trim().toUpperCase(), tipo, valor: Number(valor),
            inicio, fim, maxUsos: Number(maxUsos), usos: i.usos ?? 0, ativo,
          })}>
          {isNew ? 'Criar cupão' : 'Salvar alterações'}
        </Btn>
      </>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Nome do cupão" required hint="Para identificação interna">
            <TextInput value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Desconto Fidelidade" />
          </Field>
          <Field label="Código do cupão" required hint="O hóspede usa este código">
            <div style={{ display: 'flex', gap: 8 }}>
              <TextInput value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ex.: PINHEIRA10" style={{ flex: 1, fontFamily: 'monospace', letterSpacing: '.05em', textTransform: 'uppercase' }} />
              <Btn variant="soft" size="sm" onClick={gerarCodigo}>Gerar</Btn>
            </div>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Tipo de desconto">
            <Select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="percentagem">Percentagem (%)</option>
              <option value="fixo">Valor fixo (R$)</option>
            </Select>
          </Field>
          <Field label={tipo === 'percentagem' ? 'Desconto (%)' : 'Desconto (R$)'} required>
            {tipo === 'percentagem'
              ? <NumberInput min={1} max={100} value={valor} onChange={e => setValor(e.target.value)} />
              : <MoneyInput value={valor} onChange={e => setValor(e.target.value === '' ? '' : Number(e.target.value))} />}
          </Field>
          <Field label="Máximo de usos" hint="0 = ilimitado">
            <NumberInput min={0} value={maxUsos} onChange={e => setMaxUsos(e.target.value)} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Válido de" required><DateInput value={inicio} onChange={e => setInicio(e.target.value)} /></Field>
          <Field label="Válido até" required><DateInput value={fim} min={inicio} onChange={e => setFim(e.target.value)} /></Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Cupão activo
        </label>
        {codigo && (
          <div style={{ padding: '12px 16px', background: C.espuma, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 2 }}>Pré-visualização do cupão</div>
              <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, letterSpacing: '.1em', color: C.ocean }}>{codigo}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.coralDeep }}>{tipo === 'percentagem' ? `-${valor}%` : `-${money(valor)}`}</div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>{fmtShort(inicio)} – {fmtShort(fim)}</div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

const IDIOMAS_DISPONIVEIS = [
  { codigo: 'pt', nome: 'Português', nativo: 'Português', bandeira: '🇧🇷' },
  { codigo: 'es', nome: 'Espanhol', nativo: 'Español', bandeira: '🇦🇷' },
  { codigo: 'en', nome: 'Inglês', nativo: 'English', bandeira: '🇺🇸' },
  { codigo: 'de', nome: 'Alemão', nativo: 'Deutsch', bandeira: '🇩🇪' },
  { codigo: 'fr', nome: 'Francês', nativo: 'Français', bandeira: '🇫🇷' },
  { codigo: 'it', nome: 'Italiano', nativo: 'Italiano', bandeira: '🇮🇹' },
];

function IdiomasView({ data, update }) {
  const idiomas = data.settings.idiomas || [
    { codigo: 'pt', nome: 'Português', nativo: 'Português', bandeira: '🇧🇷', principal: true, ativo: true },
  ];
  const [showAdd, setShowAdd] = useState(false);
  const [editando, setEditando] = useState(null); // { codigo, nativo, bandeira }

  const saveIdiomas = (list) => update(prev => ({ ...prev, settings: { ...prev.settings, idiomas: list } }));

  const toggle = (codigo) => saveIdiomas(idiomas.map(i => i.codigo === codigo ? { ...i, ativo: !i.ativo } : i));
  const remove = (codigo) => saveIdiomas(idiomas.filter(i => i.codigo !== codigo));
  const add = (lang) => {
    if (idiomas.find(i => i.codigo === lang.codigo)) return;
    saveIdiomas([...idiomas, { ...lang, principal: false, ativo: true }]);
    setShowAdd(false);
  };
  const saveEdit = (codigo, patch) => {
    saveIdiomas(idiomas.map(i => i.codigo === codigo ? { ...i, ...patch } : i));
    setEditando(null);
  };

  const available = IDIOMAS_DISPONIVEIS.filter(l => !idiomas.find(i => i.codigo === l.codigo));
  const principal = idiomas.find(i => i.principal);
  const outros = idiomas.filter(i => !i.principal);

  return (
    <div>
      <PageHead
        title="Idiomas"
        sub="Escolha em que idiomas o site de reservas é apresentado aos hóspedes."
        action={<Btn icon={Plus} onClick={() => setShowAdd(true)}>Adicionar</Btn>}
      />

      <div style={{ display: 'grid', gap: 10, maxWidth: 760 }}>

        {/* idioma principal — fixo, sem toggle */}
        {principal && (
          <Card style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>{principal.bandeira}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 17 }}>{principal.nativo}</span>
              <span style={{ marginLeft: 10, fontSize: 13, color: C.inkSoft, background: C.espuma, border: `1px solid ${C.line}`, borderRadius: 999, padding: '2px 9px', fontWeight: 600 }}>Idioma Principal</span>
            </div>
          </Card>
        )}

        {/* outros idiomas */}
        {outros.map(lang => (
          <Card key={lang.codigo} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>{lang.bandeira}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{lang.nativo}</span>
              <span style={{ marginLeft: 8, fontSize: 13, color: C.inkSoft }}>({lang.nome})</span>
              {!TRANSLATIONS[lang.codigo] && (
                <span style={{ marginLeft: 8, fontSize: 11.5, color: '#B26A2E', background: '#FBF1E6', border: '1px solid #EBD9C0', borderRadius: 999, padding: '2px 8px', fontWeight: 600 }}>Tradução parcial</span>
              )}
            </div>

            {/* toggle activo/inactivo */}
            <div onClick={() => toggle(lang.codigo)}
              style={{ width: 46, height: 26, borderRadius: 13, background: lang.ativo ? C.brisa : C.line, cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: lang.ativo ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left .2s' }} />
            </div>

            <button onClick={() => setEditando(lang)} style={iconBtn} title="Editar"><Pencil size={15} /></button>
            <button onClick={() => remove(lang.codigo)} style={{ ...iconBtn, color: '#B23B3B' }} title="Remover"><Trash2 size={15} /></button>
          </Card>
        ))}

        {outros.length === 0 && (
          <div style={{ padding: '20px 16px', color: C.inkSoft, fontSize: 14, textAlign: 'center', background: '#fff', borderRadius: 12, border: `1px dashed ${C.line}` }}>
            Nenhum idioma adicional configurado. Clique em <b>Adicionar</b> para disponibilizar o site em mais idiomas.
          </div>
        )}
      </div>

      {/* info note */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px', background: '#EEF6FF', border: '1px solid #BDD9F8', borderRadius: 12, marginTop: 18, fontSize: 13.5, color: '#1A4A7A', maxWidth: 760 }}>
        <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Os idiomas activos aparecem como selector de bandeira no canto do site público. O hóspede escolhe o idioma e todas as etiquetas, botões e textos do site são apresentados na língua seleccionada. Português é sempre o idioma principal e não pode ser removido.</span>
      </div>

      {/* Add language modal */}
      {showAdd && (
        <Modal title="Adicionar idioma" onClose={() => setShowAdd(false)}
          footer={<Btn variant="ghost" onClick={() => setShowAdd(false)}>Fechar</Btn>}>
          {available.length === 0
            ? <p style={{ color: C.inkSoft, fontSize: 14 }}>Todos os idiomas disponíveis já foram adicionados.</p>
            : <div style={{ display: 'grid', gap: 8 }}>
              {available.map(lang => (
                <button key={lang.codigo} onClick={() => add(lang)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.espuma, border: `1px solid ${C.line}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <span style={{ fontSize: 24 }}>{lang.bandeira}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{lang.nativo}</div>
                    <div style={{ fontSize: 13, color: C.inkSoft }}>{lang.nome}{!TRANSLATIONS[lang.codigo] ? ' · tradução parcial' : ' · tradução completa'}</div>
                  </div>
                  <Plus size={16} color={C.brisa} style={{ marginLeft: 'auto' }} />
                </button>
              ))}
            </div>}
        </Modal>
      )}

      {/* Edit language modal */}
      {editando && (
        <Modal title={`Editar — ${editando.nome}`} onClose={() => setEditando(null)}
          footer={<>
            <Btn variant="ghost" onClick={() => setEditando(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={() => saveEdit(editando.codigo, { nativo: editando.nativo, bandeira: editando.bandeira })}>Guardar</Btn>
          </>}>
          <div style={{ display: 'grid', gap: 14 }}>
            <Field label="Nome no próprio idioma (nativo)">
              <TextInput value={editando.nativo} onChange={e => setEditando(p => ({ ...p, nativo: e.target.value }))} />
            </Field>
            <Field label="Emoji de bandeira" hint="Ex.: 🇧🇷 🇦🇷 🇺🇸 🇵🇹">
              <TextInput value={editando.bandeira} onChange={e => setEditando(p => ({ ...p, bandeira: e.target.value }))} maxLength={4} style={{ fontSize: 22, width: 80 }} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════ DestinoSection ═══════════════════════════ */
function DestinoSection() {
  const [tab, setTab] = useState('destino');

  const TABS_DEST = [
    { id: 'destino',   label: '🌊 A Pinheira' },
    { id: 'atrativos', label: '🗺️ Atrativos' },
    { id: 'chegar',    label: '🚗 Como chegar' },
  ];

  const ATRATIVOS = [
    {
      nome: 'Pontão da Pinheira',
      desc: 'Conjunto de rochas entre a praia e o costão — local de beleza exuberante com piscinas naturais formadas pelas marés. Ideal para banhos de mar, pesca artesanal e contemplar o pôr do sol.',
      destaque: false,
    },
    {
      nome: 'Praia de Baixo',
      desc: 'Praia de enseada com 7 km de extensão, de águas calmas e límpidas. Perfeita para famílias, caminhadas, esportes aquáticos e náuticos. A pesca artesanal é um dos principais atrativos, com peixes frescos todos os dias.',
      destaque: true,
    },
    {
      nome: 'Pedra do Urubu',
      desc: 'Uma das vistas mais belas de Santa Catarina. Do alto avista-se a enseada da Pinheira, a Praia do Sonho, a Ponta dos Papagaios e a foz do Rio da Madre. Vale cada passo da subida.',
      destaque: false,
    },
    {
      nome: 'Praia de Cima',
      desc: 'Praia de águas limpas e conhecida pela beleza exuberante. Possui posto de salvavidas, bares, lojas, restaurantes e muita agitação para os veranistas.',
      destaque: false,
    },
    {
      nome: 'Prainha',
      desc: 'Praia deserta com ondas impressionantes para surfistas. Também conhecida como "Gaúcha Pelada" — águas agitadas, mas cristalinas e selvagens.',
      destaque: false,
    },
    {
      nome: 'Guarda do Embaú',
      desc: 'A 2 km da Pinheira, situada na foz do Rio da Madre com mar aberto e vista para a Ilha do Coral. Famosa em todo o Brasil por surfistas, artistas e modelos — um lugar de paz, beleza e curtição.',
      destaque: true,
    },
    {
      nome: 'Praia do Maço',
      desc: 'Praia deserta de águas limpas e ondas fortes. Acessada por três trilhas que começam no pé do morro da Pinheira e terminam na Praia de Cima. Para quem busca natureza selvagem e tranquilidade total.',
      destaque: false,
    },
    {
      nome: 'Parque Serra do Tabuleiro',
      desc: 'Com guias treinados, é possível fazer trilhas onde se avistam animais nativos e flora da região. Um dos maiores parques do Brasil em área contínua de preservação.',
      destaque: false,
    },
  ];

  return (
    <section style={{ background: '#fff', borderTop: '1px solid #eee' }}>

      {/* hero banner */}
      <div style={{ position: 'relative', height: 340, overflow: 'hidden', background: `linear-gradient(160deg,#0A3742 0%,#2E7E8C 60%,#5AAFBC 100%)` }}>
        {/* decorative wave overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#fff', textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .8, marginBottom: 14 }}>Praia da Pinheira · Palhoça · Santa Catarina</div>
          <h2 style={{ fontFamily: F.disp, fontSize: 'clamp(32px,5vw,54px)', fontWeight: 600, margin: '0 0 16px', lineHeight: 1.1, maxWidth: 700 }}>
            Conheça a Pinheira e seus Encantos
          </h2>
          <p style={{ fontSize: 16, opacity: .88, maxWidth: 580, lineHeight: 1.6, margin: 0 }}>
            Uma das praias mais frequentadas da região de Florianópolis — 35 km do centro, tradição açoriana, piscinas naturais e o melhor do litoral catarinense.
          </p>
        </div>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, width: '100%', height: 80 }}>
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#fff" />
        </svg>
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px 64px' }}>

        {/* tab nav */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #eee', marginBottom: 36, marginTop: -8, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS_DEST.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '14px 22px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? C.ocean : '#717171', borderBottom: tab === t.id ? `3px solid ${C.ocean}` : '3px solid transparent', marginBottom: -2, whiteSpace: 'nowrap', transition: 'color .15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── tab: A Pinheira ── */}
        {tab === 'destino' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 56, alignItems: 'start' }}>
            <div>
              <h3 style={{ fontFamily: F.disp, fontSize: 32, lineHeight: 1.15, margin: '0 0 16px', color: C.ink }}>
                Viva o Melhor da Vida
              </h3>
              <div style={{ width: 48, height: 3, background: C.coral, borderRadius: 2, marginBottom: 20 }} />
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, margin: '0 0 18px' }}>
                A Praia da Pinheira é uma das praias mais frequentadas da grande Florianópolis, recebendo visitantes de todos os estados do Brasil e estrangeiros.
              </p>
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, margin: '0 0 18px' }}>
                Localizada numa enseada a 35 km do centro do município e a 48 km de Florianópolis, é dividida em duas praias: Praia de Baixo e Praia de Cima, situadas em oposição uma a outra.
              </p>
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, margin: 0 }}>
                Hoje a Pinheira não é só um povoado de pescadores de tradição açoriana — o desenvolvimento chegou, mas a paz da convivência entre visitantes e nativos permanece, e os ranchos dos pescadores ainda caracterizam a praia.
              </p>
            </div>
            <div>
              <h4 style={{ fontFamily: F.disp, fontSize: 20, margin: '0 0 14px', color: C.ink }}>A origem do nome</h4>
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, margin: '0 0 20px' }}>
                Conta-se que havia uma enseada coberta por árvores de madeira leve e resistente, muito usada para fabricar boias para as redes dos pescadores. O fruto desta árvore parecia-se com uma pinha — e dai as árvores serem chamadas de <i>pinheira</i>. Como esta linda praia não tinha nome, os nativos chamaram-na de Pinheira.
              </p>
              <h4 style={{ fontFamily: F.disp, fontSize: 20, margin: '0 0 14px', color: C.ink }}>Por que escolher a Pinheira?</h4>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  ['🌊', 'Praia de baixo agitação e excelente para famílias'],
                  ['🐟', 'Pesca artesanal e gastronomia fresca todos os dias'],
                  ['🌅', 'Pôr do sol deslumbrante sobre o Pontão e as rochas'],
                  ['🏄', 'Praias vizinhas para todos os perfis — surf, mergulho, trilhas'],
                  ['🛡️', 'Comunidade acolhedora e ambiente seguro para crianças'],
                  ['🏖️', 'A 2 km da mundialmente famosa Guarda do Embaú'],
                ].map(([ic, txt], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: '#f8fafa', borderRadius: 10 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{ic}</span>
                    <span style={{ fontSize: 14, color: '#333', lineHeight: 1.5 }}>{txt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── tab: Atrativos ── */}
        {tab === 'atrativos' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40, alignItems: 'start' }}>
              <div>
                <h3 style={{ fontFamily: F.disp, fontSize: 28, margin: '0 0 8px', color: C.ink }}>Atrativos e Passeios</h3>
                <p style={{ fontSize: 15, color: '#717171', margin: '0 0 24px', lineHeight: 1.6 }}>
                  A Enseada da Pinheira oferece uma variedade impressionante de experiências — da praia deserta para surfistas ao passeio de barco para famílias, tudo a poucos minutos do Residencial.
                </p>
                {/* map image placeholder */}
                <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.line}`, height: 240 }}>
                  <iframe title="mapa-pinheira"
                    src="https://maps.google.com/maps?q=Praia+da+Pinheira,+Palhoça,+SC&output=embed&zoom=13"
                    width="100%" height="240" style={{ border: 0, display: 'block' }}
                    loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
                <p style={{ fontSize: 12.5, color: '#999', marginTop: 8 }}>📍 Enseada da Pinheira — Palhoça, Santa Catarina</p>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                {ATRATIVOS.filter(a => a.destaque).map((a, i) => (
                  <div key={i} style={{ padding: '18px 20px', background: `linear-gradient(135deg,${C.espuma},#fff)`, border: `1px solid ${C.line}`, borderRadius: 14, borderLeft: `4px solid ${C.coral}` }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: C.ink }}>{a.nome} ⭐</div>
                    <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>{a.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 18 }}>
              {ATRATIVOS.filter(a => !a.destaque).map((a, i) => (
                <div key={i} style={{ padding: '16px 18px', background: '#fafafa', border: '1px solid #eee', borderRadius: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: C.ocean }}>{a.nome}</div>
                  <div style={{ fontSize: 13.5, color: '#555', lineHeight: 1.6 }}>{a.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── tab: Como chegar ── */}
        {tab === 'chegar' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 48, alignItems: 'start' }}>
            <div>
              <h3 style={{ fontFamily: F.disp, fontSize: 28, margin: '0 0 22px', color: C.ink }}>Como chegar à Pinheira</h3>
              <div style={{ display: 'grid', gap: 18 }}>
                {[
                  { ic: '✈️', titulo: 'De avião', texto: 'Aeroporto Internacional Hercílio Luz (Florianópolis) — 48 km do Residencial. Aluguer de carro recomendado ou transfer privado.' },
                  { ic: '🚗', titulo: 'De carro', texto: 'BR-101 Sul → SC-282 em direcção a Palhoça → seguir para Praia da Pinheira. GPS: "Residencial PinheiraMar, Praia da Pinheira". Estacionamento gratuito (1 vaga por apartamento).' },
                  { ic: '🚌', titulo: 'De ônibus', texto: 'Terminal Rodoviário de Florianópolis → linha para Palhoça → van/mototáxi para a Pinheira. Tempo total aprox. 1h30.' },
                  { ic: '📍', titulo: 'Distâncias úteis', texto: 'Centro de Florianópolis: 35 km · Palhoça (centro): 22 km · Guarda do Embaú: 2 km · Garopaba: 28 km · Imbituba: 45 km.' },
                ].map((it, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, padding: '16px 18px', background: '#f8f8f8', borderRadius: 14 }}>
                    <span style={{ fontSize: 28, flexShrink: 0 }}>{it.ic}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 5, color: C.ink }}>{it.titulo}</div>
                      <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>{it.texto}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.line}`, marginBottom: 16 }}>
                <iframe title="mapa-como-chegar"
                  src="https://maps.google.com/maps?q=Rua+Dom+Patrício+82+Praia+da+Pinheira+Palhoça+SC&output=embed&zoom=14"
                  width="100%" height="380" style={{ border: 0, display: 'block' }}
                  loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
              <div style={{ padding: '16px 18px', background: C.espuma, borderRadius: 12, fontSize: 14, color: C.ink, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>📍 Endereço completo</div>
                Rua Dom Patrício, 82 — Praia da Pinheira<br />
                Palhoça · Santa Catarina · Brasil · CEP 88.139-427<br />
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={14} color={C.ocean} /> (48) 98476-1800</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}


/* ═══════════════════════════ AptDetailPage ═══════════════════════════ */
const HIGHLIGHTS = [
  { match: /wi.fi|internet/i,       icon: '📶', label: 'Wi-Fi grátis' },
  { match: /estacionamento|garagem/i, icon: '🚗', label: 'Estacionamento' },
  { match: /vista.*mar|mar.*vista|frente.*mar/i, icon: '🌊', label: 'Vista para o mar' },
  { match: /churrasco/i,            icon: '🔥', label: 'Churrasqueira' },
  { match: /ar.condicionado/i,      icon: '❄️',  label: 'Ar condicionado' },
  { match: /cozinha/i,              icon: '🍳', label: 'Cozinha completa' },
  { match: /piscina/i,              icon: '🏊',  label: 'Piscina' },
  { match: /varanda/i,              icon: '🌅', label: 'Varanda' },
];

function AptDetailPage({ apt, data, ci, co, hosp, valid, setCi, setCo, setHosp, liked, setLiked, onBack, onBook, tr }) {
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
function AptCard({ apt, available = true, fits = true, bd = null, valid = false,
  hosp = 0, liked, setLiked, onCard, tr, compact = false }) {
  const nightRate = valid && bd ? Math.round(bd.total / bd.n) : apt.preco;
  const h = compact ? 160 : 220;
  return (
    <article
      onClick={() => available && onCard(apt)}
      style={{ display: 'flex', flexDirection: 'column', opacity: available ? 1 : .55, cursor: available ? 'pointer' : 'default', minWidth: compact ? 200 : 0 }}>
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '20/19', flexShrink: 0 }}>
        <PhotoTile apt={apt} h={h} radius={0} />
        <button onClick={e => { e.stopPropagation(); setLiked(l => ({ ...l, [apt.id]: !l[apt.id] })); }}
          style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <Heart size={20} fill={liked[apt.id] ? C.coral : 'rgba(0,0,0,.45)'} color={liked[apt.id] ? C.coral : '#fff'} strokeWidth={1.8} />
        </button>
        {!available
          ? <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,.62)', color: '#fff', borderRadius: 6, fontSize: 11.5, fontWeight: 700, padding: '4px 9px' }}>{tr('card_unavail')}</span>
          : valid && !fits
            ? <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(232,116,79,.92)', color: '#fff', borderRadius: 6, fontSize: 11.5, fontWeight: 700, padding: '4px 9px' }}>{tr('card_combine')}</span>
            : null}
        {apt.vista === 'Frente Mar' && (
          <span style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(14,74,88,.82)', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
            🌊 Frente Mar
          </span>
        )}
      </div>
      <div style={{ paddingTop: 9 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.3 }}>{apt.nome}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <Star size={12} fill="#222" color="#222" /><span style={{ fontSize: 12.5, fontWeight: 600 }}>4,9</span>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#717171', marginTop: 2 }}>{apt.piso} · {apt.capacidade} pessoas</div>
        {valid && bd && <div style={{ fontSize: 12.5, color: '#717171', marginTop: 1 }}>{tr('card_total')} {money(bd.total)}</div>}
        {valid && !fits && <div style={{ fontSize: 12, color: C.coralDeep, fontWeight: 600, marginTop: 3 }}>{tr('card_combine_hint', hosp)}</div>}
        <div style={{ marginTop: 5 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{money(nightRate)}</span>
          <span style={{ fontSize: 13, color: '#717171' }}> {tr('card_night')}</span>
        </div>
      </div>
    </article>
  );
}

/* ── Section — titled row with horizontal scroll or grid ── */
function Section({ icon, title, sub, apts, liked, setLiked, onCard, tr, highlight = false, grid = false }) {
  const scrollRef = useRef(null);
  const scroll = (dir) => { if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' }); };

  if (!apts.length) return null;

  return (
    <section style={{ marginBottom: 48 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{icon}</span> {title}
          </h2>
          {sub && <p style={{ margin: '4px 0 0', fontSize: 14, color: '#717171' }}>{sub}</p>}
        </div>
        {!grid && apts.length > 3 && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => scroll(-1)} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#333' }}><ChevronLeft size={16} /></button>
            <button onClick={() => scroll(1)}  style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#333' }}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {grid ? (
        /* full grid — "todos os apartamentos" */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '26px 22px' }}>
          {apts.map(apt => (
            <AptCard key={apt.id} apt={apt} liked={liked} setLiked={setLiked} onCard={onCard} tr={tr} />
          ))}
        </div>
      ) : highlight && apts.length >= 2 ? (
        /* highlight layout — big card left + column right (Frente Mar) */
        <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16 }}>
          {/* big featured card */}
          <div onClick={() => onCard(apts[0])} style={{ cursor: 'pointer', position: 'relative', borderRadius: 18, overflow: 'hidden', aspectRatio: '16/10' }}>
            <PhotoTile apt={apts[0]} h={420} radius={0} />
            <button onClick={e => { e.stopPropagation(); setLiked(l => ({ ...l, [apts[0].id]: !l[apts[0].id] })); }}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <Heart size={24} fill={liked[apts[0].id] ? C.coral : 'rgba(0,0,0,.4)'} color="#fff" strokeWidth={1.8} />
            </button>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(10,30,40,.78))', padding: '40px 22px 20px', color: '#fff' }}>
              <div style={{ fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.18)', display: 'inline-block', padding: '3px 10px', borderRadius: 999, marginBottom: 8 }}>🌊 Destaque</div>
              <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-.01em' }}>{apts[0].nome}</div>
              <div style={{ fontSize: 13.5, opacity: .88, marginTop: 3 }}>{apts[0].piso} · até {apts[0].capacidade} pessoas</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginTop: 6 }}>{money(apts[0].preco)} <span style={{ fontWeight: 400, fontSize: 13 }}>/ noite</span></div>
            </div>
          </div>
          {/* right column — remaining 2-4 as smaller cards */}
          <div style={{ display: 'grid', gridTemplateRows: `repeat(${Math.min(apts.length - 1, 2)}, 1fr)`, gap: 16 }}>
            {apts.slice(1, 3).map(apt => (
              <div key={apt.id} onClick={() => onCard(apt)} style={{ cursor: 'pointer', position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
                <PhotoTile apt={apt} h={200} radius={0} />
                <button onClick={e => { e.stopPropagation(); setLiked(l => ({ ...l, [apt.id]: !l[apt.id] })); }}
                  style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <Heart size={19} fill={liked[apt.id] ? C.coral : 'rgba(0,0,0,.4)'} color="#fff" strokeWidth={1.8} />
                </button>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(10,30,40,.72))', padding: '24px 16px 14px', color: '#fff' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{apt.nome}</div>
                  <div style={{ fontSize: 12.5, opacity: .88 }}>{apt.piso} · até {apt.capacidade} pessoas · {money(apt.preco)}/noite</div>
                </div>
              </div>
            ))}
          </div>
          {/* remaining as horizontal scroll if > 3 */}
          {apts.length > 3 && (
            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
              <div ref={scrollRef} style={{ display: 'flex', gap: 18, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                {apts.slice(3).map(apt => (
                  <div key={apt.id} style={{ minWidth: 230, flex: '0 0 230px' }}>
                    <AptCard apt={apt} liked={liked} setLiked={setLiked} onCard={onCard} tr={tr} compact />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* horizontal scroll row — default for capacity groups */
        <div style={{ position: 'relative' }}>
          <div ref={scrollRef} style={{ display: 'flex', gap: 20, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
            {apts.map(apt => (
              <div key={apt.id} style={{ minWidth: 240, flex: '0 0 240px' }}>
                <AptCard apt={apt} liked={liked} setLiked={setLiked} onCard={onCard} tr={tr} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}


function PublicSite({ data, onCreate }) {
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

function BookingModal({ sel, ci, co, hosp, data, onClose, onConfirm }) {
  const { apt, apt2, g1: initG1, g2: initG2 } = sel;
  const hasApt2 = !!apt2;
  const [step, setStep] = useState('extras');

  const taxasOpc = (data.taxasAdicionais || []).filter(tx => tx.tipo === 'opcional');
  const [extrasQty, setExtrasQty] = useState(() => Object.fromEntries(taxasOpc.map(t => [t.id, 0])));
  const [extrasScope, setExtrasScope] = useState(() => Object.fromEntries(taxasOpc.map(t => [t.id, t.por === 'noite' ? 'per_apt' : 'group'])));

  const extrasObrig = mkExtrasObrigatorios(data.taxasAdicionais);
  const extrasOpc1 = taxasOpc.filter(t => extrasQty[t.id] > 0).map(t => ({ ...t, qtd: extrasQty[t.id], subtotal: t.preco * extrasQty[t.id] }));
  const extrasOpc2 = hasApt2 ? taxasOpc.filter(t => extrasQty[t.id] > 0 && extrasScope[t.id] === 'per_apt').map(t => ({ ...t, qtd: extrasQty[t.id], subtotal: t.preco * extrasQty[t.id] })) : [];

  const bd = stayBreakdown(apt, data.seasons, ci, co);
  const bd2 = apt2 ? stayBreakdown(apt2, data.seasons, ci, co) : null;
  const obrigTotal = extrasObrig.reduce((s, e) => s + e.preco * e.qtd, 0);
  const opc1Total = extrasOpc1.reduce((s, e) => s + e.subtotal, 0);
  const opc2Total = extrasOpc2.reduce((s, e) => s + e.subtotal, 0);
  const total1 = bd.total + obrigTotal + opc1Total;
  const total2 = apt2 && bd2 ? bd2.total + obrigTotal + opc2Total : 0;
  const totalComExtras = total1 + total2;
  const sinal = Math.round(totalComExtras * (data.settings.sinalPct / 100));

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [tel, setTel] = useState('');
  const [g, setG] = useState(Math.min(initG1 || hosp, apt.capacidade));
  const [gB, setGB] = useState(Math.min(initG2 || 1, apt2 ? apt2.capacidade : 8));
  const ok = nome.trim() && email.trim();

  const getIcon = (n) => { const s = n.toLowerCase(); if (s.includes('pet') || s.includes('animal')) return '🐾'; if (s.includes('praia') || s.includes('cadeira') || s.includes('guarda')) return '🏖️'; if (s.includes('estacion') || s.includes('vaga')) return '🚗'; return '✨'; };

  const buildR = (aptX, bdX, guests, allExtras, totalVal, isB) => ({
    id: uid(), codigo: isB ? code() + '-B' : code(),
    apartamentoId: aptX.id, checkIn: ci, checkOut: co,
    nome: nome.trim().split(' ')[0], sobrenome: nome.trim().split(' ').slice(1).join(' '),
    hospede: nome.trim(), email: email.trim(), telefone: tel.trim(), pais: 'Brasil',
    adultos: guests, criancas: 0, hospedes: guests,
    precoNoite: Math.round(bdX.total / Math.max(1, bdX.n)), precoTabela: bdX.total,
    extras: allExtras, total: totalVal, sinal: isB ? 0 : sinal,
    status: 'pendente', origem: 'Site', enviarEmail: true,
    nota: isB ? `Reserva conjunta com ${apt.nome}` : hasApt2 ? `Reserva conjunta com ${apt2.nome}` : '',
    criadoEm: ymd(today()),
  });

  const handleConfirm = () => {
    onConfirm(buildR(apt, bd, g, [...extrasObrig, ...extrasOpc1], total1, false));
    if (apt2 && bd2) onConfirm(buildR(apt2, bd2, gB, [...extrasObrig, ...extrasOpc2], total2, true));
  };

  const hasExtras = taxasOpc.length > 0;

  // ── Step 1: Extras opcionais ──────────────────────────────────────────────
  if (step === 'extras' && hasExtras) return (
    <Modal title="Serviços extras opcionais" subtitle="Adicione serviços à sua estadia (pode pular)"
      onClose={onClose} wide
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" onClick={() => setStep('dados')}>Continuar →</Btn>
      </>}>
      <div style={{ display: 'grid', gap: 12 }}>
        {taxasOpc.map(taxa => {
          const qty = extrasQty[taxa.id] || 0;
          return (
            <div key={taxa.id} style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 14, alignItems: 'center', background: C.espuma, borderRadius: 12, padding: '14px 16px', border: qty > 0 ? `2px solid ${C.coral}` : `2px solid transparent` }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: '#e8f4f1', display: 'grid', placeItems: 'center', fontSize: 26 }}>{getIcon(taxa.nome)}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{taxa.nome}</div>
                <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>{money(taxa.preco)} por {taxa.por}</div>
                {hasApt2 && qty > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {['group','per_apt'].map(sc => (
                      <button key={sc} onClick={() => setExtrasScope(s => ({ ...s, [taxa.id]: sc }))}
                        style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, background: extrasScope[taxa.id] === sc ? C.coral : '#ddd', color: extrasScope[taxa.id] === sc ? '#fff' : '#444' }}>
                        {sc === 'group' ? '👥 Grupo (1×)' : '🏠 Por apto (2×)'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setExtrasQty(q => ({ ...q, [taxa.id]: Math.max(0, (q[taxa.id]||0)-1) }))} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #bbb', background: '#fff', cursor: 'pointer', fontSize: 18, display: 'grid', placeItems: 'center' }}>−</button>
                <b style={{ minWidth: 20, textAlign: 'center', fontSize: 16 }}>{qty}</b>
                <button onClick={() => setExtrasQty(q => ({ ...q, [taxa.id]: (q[taxa.id]||0)+1 }))} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #bbb', background: '#fff', cursor: 'pointer', fontSize: 18, display: 'grid', placeItems: 'center' }}>+</button>
              </div>
            </div>
          );
        })}
        {(opc1Total + opc2Total) > 0 && <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, color: C.ocean }}>Extras: {money(opc1Total + opc2Total)}</div>}
      </div>
    </Modal>
  );

  // ── Step 2: Dados do hóspede + resumo ─────────────────────────────────────
  return (
    <Modal title={hasApt2 ? `Reservar ${apt.nome} + ${apt2.nome}` : `Reservar ${apt.nome}`}
      subtitle={`${apt.piso} · ${apt.vista}`} onClose={onClose} wide
      footer={<>
        {hasExtras && <Btn variant="ghost" onClick={() => setStep('extras')}>← Extras</Btn>}
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="accent" disabled={!ok} style={{ opacity: ok ? 1 : .5 }} onClick={handleConfirm}>Confirmar reserva</Btn>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24 }} className="pm-book-grid">
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Check-in"><div style={readBox}>{fmtShort(ci)}</div></Field>
            <Field label="Check-out"><div style={readBox}>{fmtShort(co)}</div></Field>
          </div>
          <Field label="Nome completo" required><TextInput value={nome} onChange={e => setNome(e.target.value)} placeholder="Como no documento" /></Field>
          <Field label="Email" required><TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" /></Field>
          <Field label="Telefone"><TextInput value={tel} onChange={e => setTel(e.target.value)} placeholder="(00) 00000-0000" /></Field>
          {!hasApt2 ? (
            <Field label="Hóspedes" hint={`Máx. ${apt.capacidade}`}>
              <NumberInput min={1} max={apt.capacidade} value={g} onChange={e => setG(Math.min(apt.capacidade, Math.max(1, +e.target.value || 1)))} />
            </Field>
          ) : (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#666', marginBottom: 8 }}>Hóspedes por apartamento</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: C.espuma, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{apt.nome}</div>
                  <NumberInput min={1} max={apt.capacidade} value={g} onChange={e => setG(Math.min(apt.capacidade, Math.max(1, +e.target.value || 1)))} />
                </div>
                <div style={{ background: C.espuma, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{apt2.nome}</div>
                  <NumberInput min={1} max={apt2.capacidade} value={gB} onChange={e => setGB(Math.min(apt2.capacidade, Math.max(1, +e.target.value || 1)))} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 5, textAlign: 'right' }}>Total: {g + gB} pessoas</div>
            </div>
          )}
        </div>
        <div style={{ background: C.espuma, borderRadius: 14, padding: 18, alignSelf: 'start' }}>
          <PhotoTile apt={apt} h={100} />
          <div style={{ marginTop: 14, fontSize: 13.5 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Resumo de preços</div>
            {hasApt2 && <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: '#555', marginBottom: 5 }}>{apt.nome}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: C.inkSoft }}>
              <span>Acomodação ({bd.n} noites)</span><span>{money(bd.total)}</span>
            </div>
            {extrasObrig.map(e => <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13, color: C.inkSoft }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 9, fontWeight: 800, background: '#1C7A5B', color: '#fff', borderRadius: 3, padding: '1px 4px' }}>OBR</span>{e.nome}</span>
              <span>{money(e.preco)}</span>
            </div>)}
            {extrasOpc1.map(e => <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13, color: C.inkSoft }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 9, fontWeight: 800, background: C.ocean, color: '#fff', borderRadius: 3, padding: '1px 4px' }}>OPC</span>{e.nome}{e.qtd > 1 ? ` ×${e.qtd}` : ''}{hasApt2 && extrasScope[e.id] === 'group' ? ' (grupo)' : ''}</span>
              <span>{money(e.subtotal)}</span>
            </div>)}
            {hasApt2 && bd2 && <>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: '#555', margin: '10px 0 5px' }}>{apt2.nome}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: C.inkSoft }}>
                <span>Acomodação ({bd2.n} noites)</span><span>{money(bd2.total)}</span>
              </div>
              {extrasObrig.map(e => <div key={e.id+'_2'} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13, color: C.inkSoft }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 9, fontWeight: 800, background: '#1C7A5B', color: '#fff', borderRadius: 3, padding: '1px 4px' }}>OBR</span>{e.nome}</span>
                <span>{money(e.preco)}</span>
              </div>)}
              {extrasOpc2.map(e => <div key={e.id+'_o2'} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13, color: C.inkSoft }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 9, fontWeight: 800, background: C.ocean, color: '#fff', borderRadius: 3, padding: '1px 4px' }}>OPC</span>{e.nome}{e.qtd > 1 ? ` ×${e.qtd}` : ''}</span>
                <span>{money(e.subtotal)}</span>
              </div>)}
            </>}
            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
              <span>Total{hasApt2 ? ' combinado' : ''}</span><span>{money(totalComExtras)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: C.coralDeep, fontWeight: 600 }}>
              <span>Sinal ({data.settings.sinalPct}%)</span><span>{money(sinal)}</span>
            </div>
            {hasApt2 && <p style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 8, marginBottom: 0, background: '#e8f4ff', borderRadius: 8, padding: '6px 10px' }}>Serão geradas 2 reservas vinculadas ao mesmo hóspede.</p>}
            <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 8, marginBottom: 0 }}>O pagamento do sinal confirma a reserva.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
const readBox = { padding: '10px 12px', borderRadius: 10, background: C.areiaSoft, border: `1px solid ${C.areia}`, fontSize: 14, fontWeight: 600 };

function ConfirmationModal({ info, settings, onClose }) {
  const { reserva, apt } = info;
  return (
    <Modal title="Reserva recebida!" onClose={onClose}
      footer={<Btn variant="primary" onClick={onClose}>Fazer nova pesquisa</Btn>}>
      <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#E1F0EC', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><Check size={30} color="#1C7A5B" /></div>
        <p style={{ margin: 0, color: C.inkSoft, fontSize: 14 }}>O seu código de reserva</p>
        <div style={{ fontFamily: F.disp, fontSize: 30, letterSpacing: '.06em', margin: '4px 0 18px', color: C.ocean }}>{reserva.codigo}</div>
      </div>
      <div style={{ background: C.espuma, borderRadius: 12, padding: 16, fontSize: 14, display: 'grid', gap: 8 }}>
        <Row k="Apartamento" v={`${apt.nome} · ${apt.vista}`} />
        <Row k="Estadia" v={`${fmtShort(reserva.checkIn)} → ${fmtShort(reserva.checkOut)} (${nights(reserva.checkIn, reserva.checkOut)} noites)`} />
        <Row k="Hóspede" v={reserva.hospede} />
        <Row k="Total" v={money(reserva.total)} strong />
        <Row k={`Sinal a pagar (${settings.sinalPct}%)`} v={money(reserva.sinal)} accent />
      </div>
      <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 16, marginBottom: 0 }}>
        Enviámos os detalhes para <b>{reserva.email}</b>. Para confirmar, efetue o pagamento do sinal — entraremos em contacto com as instruções. A reserva fica como <b>pendente</b> no painel de gestão até à confirmação.
      </p>
    </Modal>
  );
}
const Row = ({ k, v, strong, accent }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
    <span style={{ color: C.inkSoft }}>{k}</span>
    <span style={{ fontWeight: strong || accent ? 700 : 500, color: accent ? C.coralDeep : C.ink, textAlign: 'right' }}>{v}</span>
  </div>
);

/* ═══════════════════════════ ADMIN — GESTÃO ═══════════════════════════ */
const TABS = [
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

function Admin({ data, update }) {
  const [tab, setTab] = useState('painel');
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: F.sans, color: C.ink, background: C.espuma }}>
      {/* sidebar (md+) */}
      <aside className="pm-sidebar" style={{ width: 240, background: C.ocean, color: 'rgba(255,255,255,.78)', flexShrink: 0, padding: '22px 14px', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 22px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', color: '#fff' }}><Waves size={19} /></div>
          <div><div style={{ fontFamily: F.disp, fontSize: 17, color: '#fff', lineHeight: 1 }}>PinheiraMar</div><div style={{ fontSize: 10.5, letterSpacing: '.1em' }}>GESTÃO</div></div>
        </div>
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
          {tab === 'painel' && <Dashboard data={data} go={setTab} />}
          {tab === 'reservas' && <Reservations data={data} update={update} />}
          {tab === 'financeiro' && <Financeiro data={data} go={setTab} />}
          {tab === 'apartamentos' && <Apartments data={data} update={update} />}
          {tab === 'temporadas' && <Seasons data={data} update={update} />}
          {tab === 'taxas' && <TaxasView data={data} update={update} />}
          {tab === 'cupons' && <CuponsView data={data} update={update} />}
          {tab === 'politicas' && <PoliticasView data={data} update={update} />}
          {tab === 'idiomas' && <IdiomasView data={data} update={update} />}
          {tab === 'configuracoes' && <SettingsView data={data} update={update} />}
          {tab === 'pagamentos' && <PaymentsView data={data} update={update} />}
        </main>
      </div>
    </div>
  );
}

const PageHead = ({ title, sub, action }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
    <div>
      <h1 style={{ fontFamily: F.disp, fontSize: 30, margin: 0, color: C.ink }}>{title}</h1>
      {sub && <p style={{ margin: '4px 0 0', color: C.inkSoft, fontSize: 14 }}>{sub}</p>}
    </div>
    {action}
  </div>
);
const Card = ({ children, style, ...rest }) => <div {...rest} style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.line}`, ...style }}>{children}</div>;

// Reordenação por arrastar-e-soltar para qualquer lista de gestão.
function useReorder(list, commit) {
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  return {
    grip: (idx) => ({
      draggable: true,
      onDragStart: (e) => { setDrag(idx); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(idx)); } catch (_) {} },
      onDragEnd: () => { setDrag(null); setOver(null); },
      title: 'Arraste para reordenar',
      style: { cursor: 'grab', display: 'grid', placeItems: 'center', color: C.inkSoft, flexShrink: 0, alignSelf: 'stretch', padding: '0 2px' },
    }),
    zone: (idx) => ({
      onDragOver: (e) => { e.preventDefault(); if (over !== idx) setOver(idx); },
      onDrop: (e) => { e.preventDefault(); if (drag != null && drag !== idx) { const a = [...list]; const [m] = a.splice(drag, 1); a.splice(idx, 0, m); commit(a); } setDrag(null); setOver(null); },
    }),
    deco: (idx) => ({ opacity: drag === idx ? .45 : 1, outline: over === idx && drag !== idx ? `2px dashed ${C.brisa}` : 'none', outlineOffset: -2 }),
  };
}
// Insere um clone logo após o original numa lista de objetos com id.
function duplicateInList(list, id, makeCopy) {
  const idx = list.findIndex(x => x.id === id);
  if (idx < 0) return list;
  const copy = makeCopy(list[idx]);
  const a = [...list]; a.splice(idx + 1, 0, copy); return a;
}
const DragGrip = (props) => <span {...props}><GripVertical size={18} /></span>;

/* ── Dashboard ── */
function Dashboard({ data, go }) {
  const t = today();
  const ativas = data.reservas.filter(r => r.status !== 'cancelada');
  const horizon = 30;
  const totalNoites = data.apartamentos.filter(a => a.ativo).length * horizon;
  let ocupadas = 0;
  data.apartamentos.filter(a => a.ativo).forEach(a => {
    for (let i = 0; i < horizon; i++) { const d = addDays(t, i); if (ativas.some(r => r.apartamentoId === a.id && parseYMD(r.checkIn) <= d && d < parseYMD(r.checkOut))) ocupadas++; }
  });
  const ocup = totalNoites ? Math.round((ocupadas / totalNoites) * 100) : 0;
  const aptName = (id) => data.apartamentos.find(a => a.id === id)?.nome || '—';
  const season = seasonForDate(data.seasons, t);

  const proxCheckins  = ativas.filter(r => parseYMD(r.checkIn)  >= t).sort((a, b) => parseYMD(a.checkIn)  - parseYMD(b.checkIn)).slice(0, 6);
  const proxCheckouts = ativas.filter(r => parseYMD(r.checkOut) >= t).sort((a, b) => parseYMD(a.checkOut) - parseYMD(b.checkOut)).slice(0, 6);

  const perApt = data.apartamentos.filter(a => a.ativo).map(a => {
    let n = 0; for (let i = 0; i < horizon; i++) { const d = addDays(t, i); if (ativas.some(r => r.apartamentoId === a.id && parseYMD(r.checkIn) <= d && d < parseYMD(r.checkOut))) n++; }
    return { nome: a.nome, n, pct: Math.round((n / horizon) * 100) };
  }).sort((a, b) => b.n - a.n);

  const disponiveisHoje = data.apartamentos.filter(a => a.ativo).filter(a =>
    !ativas.some(r => r.apartamentoId === a.id && parseYMD(r.checkIn) <= t && t < parseYMD(r.checkOut))
  ).length;
  const totalAtivos = data.apartamentos.filter(a => a.ativo).length;

  const stats = [
    { label: 'Reservas ativas',        value: ativas.length,          icon: CalendarDays, sub: `${data.reservas.filter(r => r.status === 'pendente').length} pendentes`,              click: () => go('reservas') },
    { label: 'Ocupação (30 dias)',      value: ocup + '%',             icon: Home,         sub: `${ocupadas} de ${totalNoites} noites`,                                               click: null },
    { label: 'Temporada atual',         value: season ? season.nome : 'Tarifa base', icon: Tag, sub: season ? `${fmtShort(season.inicio)} – ${fmtShort(season.fim)}` : '—',          click: () => go('temporadas') },
    { label: 'Disponíveis hoje',        value: `${disponiveisHoje} / ${totalAtivos}`, icon: Building2, sub: `${totalAtivos - disponiveisHoje} ocupado(s) agora`,                   click: () => go('reservas') },
  ];

  const EventRow = ({ r, dateField }) => {
    const d = parseYMD(r[dateField]);
    const isToday = ymd(d) === ymd(t);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 11px', background: isToday ? '#FBF1E6' : C.espuma, borderRadius: 10, border: isToday ? `1px solid #EBD9C0` : '1px solid transparent' }}>
        <div style={{ textAlign: 'center', minWidth: 40, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: F.disp, lineHeight: 1, color: isToday ? C.coralDeep : C.ink }}>{d.getDate()}</div>
          <div style={{ fontSize: 10, color: C.inkSoft, textTransform: 'uppercase' }}>{d.toLocaleDateString('pt-BR', { month: 'short' })}</div>
          {isToday && <div style={{ fontSize: 9, fontWeight: 700, color: C.coralDeep }}>HOJE</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.status === 'bloqueio' ? 'Bloqueio' : (r.hospede || '—')}</div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>{aptName(r.apartamentoId)} · {nights(r.checkIn, r.checkOut)} noite(s)</div>
        </div>
        <Badge status={r.status} />
      </div>
    );
  };

  return (
    <div>
      <PageHead title="Painel de controle" sub={`Hoje, ${fmtLong(ymd(t))}`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 22 }}>
        {stats.map((s, i) => (
          <Card key={i} onClick={s.click || undefined} style={{ padding: 18, cursor: s.click ? 'pointer' : 'default' }}
            onMouseEnter={s.click ? e => e.currentTarget.style.boxShadow = '0 4px 18px rgba(10,40,46,.10)' : undefined}
            onMouseLeave={s.click ? e => e.currentTarget.style.boxShadow = '' : undefined}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>{s.label}</div>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: C.espuma, display: 'grid', placeItems: 'center', color: C.brisa }}><s.icon size={18} /></div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, margin: '8px 0 2px', fontFamily: F.disp, color: C.ink }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: s.click ? C.brisa : C.inkSoft }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }} className="pm-dash-grid">
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
            <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowRight size={15} color={C.brisa} /> Próximos check-ins
            </h3>
            <Btn size="sm" variant="ghost" onClick={() => go('reservas')}>Ver todas</Btn>
          </div>
          {proxCheckins.length === 0
            ? <p style={{ color: C.inkSoft, fontSize: 14, margin: 0 }}>Sem chegadas agendadas.</p>
            : <div style={{ display: 'grid', gap: 7 }}>{proxCheckins.map(r => <EventRow key={r.id} r={r} dateField="checkIn" />)}</div>}
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
            <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChevronLeft size={15} color={C.coral} /> Próximos check-outs
            </h3>
            <Btn size="sm" variant="ghost" onClick={() => go('reservas')}>Ver todas</Btn>
          </div>
          {proxCheckouts.length === 0
            ? <p style={{ color: C.inkSoft, fontSize: 14, margin: 0 }}>Sem saídas agendadas.</p>
            : <div style={{ display: 'grid', gap: 7 }}>{proxCheckouts.map(r => <EventRow key={r.id} r={r} dateField="checkOut" />)}</div>}
        </Card>
      </div>

      <Card style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: 0 }}>
            Ocupação por apartamento <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 400 }}>· próx. {horizon} dias</span>
          </h3>
          <Btn size="sm" variant="ghost" onClick={() => go('financeiro')}>Relatório financeiro</Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px 28px' }}>
          {perApt.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 64, fontSize: 13, color: C.inkSoft, flexShrink: 0 }}>{p.nome}</div>
              <div style={{ flex: 1, height: 10, background: C.espuma, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${p.pct}%`, height: '100%', borderRadius: 6, background: p.pct >= 70 ? `linear-gradient(90deg,${C.coral},${C.coralDeep})` : `linear-gradient(90deg,${C.brisa},${C.ocean})` }} />
              </div>
              <div style={{ width: 36, fontSize: 12.5, textAlign: 'right', color: C.inkSoft, flexShrink: 0 }}>{p.pct}%</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ── Financeiro ── */
function Financeiro({ data, go }) {
  const t = today();
  const [periodo, setPeriodo] = useState('all');

  const PERIODOS = [
    { id: 'all',  label: 'Todo período' },
    { id: 'year', label: 'Este ano' },
    { id: 'month', label: 'Este mês' },
    { id: '30d',  label: 'Últimos 30 dias' },
    { id: '90d',  label: 'Últimos 90 dias' },
  ];
  const inPeriodo = (r) => {
    const d = parseYMD(r.checkIn);
    const y = t.getFullYear(), m = t.getMonth();
    if (periodo === 'year')  return d.getFullYear() === y;
    if (periodo === 'month') return d.getFullYear() === y && d.getMonth() === m;
    if (periodo === '30d')   return (t - d) / (1000*60*60*24) <= 30;
    if (periodo === '90d')   return (t - d) / (1000*60*60*24) <= 90;
    return true;
  };

  const filtradas = data.reservas.filter(r => r.status !== 'cancelada' && inPeriodo(r));
  const confirmadas = filtradas.filter(r => r.status === 'confirmada');
  const pendentes   = filtradas.filter(r => r.status === 'pendente');
  const bloqueios   = filtradas.filter(r => r.status === 'bloqueio');

  const recConf  = confirmadas.reduce((s, r) => s + r.total, 0);
  const recPend  = pendentes.reduce((s, r)   => s + r.total, 0);
  const recTotal = recConf + recPend;
  const ticketMedio = (confirmadas.length + pendentes.length) > 0 ? Math.round(recTotal / (confirmadas.length + pendentes.length)) : 0;
  const mediaNoites = filtradas.length > 0 ? (filtradas.reduce((s, r) => s + nights(r.checkIn, r.checkOut), 0) / filtradas.length).toFixed(1) : '—';

  // receita por apartamento
  const porApt = data.apartamentos.map(a => {
    const rs = filtradas.filter(r => r.apartamentoId === a.id && r.status !== 'bloqueio');
    const receita = rs.reduce((s, r) => s + r.total, 0);
    const qtd = rs.length;
    const noites = rs.reduce((s, r) => s + nights(r.checkIn, r.checkOut), 0);
    return { nome: a.nome, receita, qtd, noites };
  }).sort((a, b) => b.receita - a.receita);
  const maxReceita = porApt.length ? Math.max(...porApt.map(p => p.receita)) : 1;

  // receita por mês (últimos 12 meses)
  const porMes = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const rs = data.reservas.filter(r => r.status === 'confirmada' && parseYMD(r.checkIn).getFullYear() === y && parseYMD(r.checkIn).getMonth() === m);
    porMes.push({ label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), v: rs.reduce((s, r) => s + r.total, 0) });
  }
  const maxMes = Math.max(...porMes.map(m => m.v), 1);

  // reservas por origem
  const origens = {};
  filtradas.filter(r => r.status !== 'bloqueio').forEach(r => { const o = r.origem || 'Direto'; origens[o] = (origens[o] || 0) + 1; });
  const origensList = Object.entries(origens).sort((a, b) => b[1] - a[1]);
  const totalOrig = origensList.reduce((s, [, v]) => s + v, 0);

  const KPI = ({ label, value, sub, accent }) => (
    <Card style={{ padding: 18 }}>
      <div style={{ fontSize: 12.5, color: C.inkSoft, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: F.disp, color: accent ? C.coralDeep : C.ink, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>{sub}</div>}
    </Card>
  );

  return (
    <div>
      <PageHead title="Financeiro" sub="Receitas, estatísticas e desempenho por apartamento."
        action={
          <div style={{ display: 'flex', background: C.espuma, borderRadius: 10, padding: 3 }}>
            {PERIODOS.map(p => (
              <button key={p.id} onClick={() => setPeriodo(p.id)} style={{ padding: '7px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: periodo === p.id ? '#fff' : 'transparent', color: periodo === p.id ? C.ocean : C.inkSoft, boxShadow: periodo === p.id ? '0 1px 3px rgba(0,0,0,.08)' : 'none', whiteSpace: 'nowrap' }}>
                {p.label}
              </button>
            ))}
          </div>
        } />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 22 }}>
        <KPI label="Receita confirmada" value={money(recConf)} sub={`${confirmadas.length} reservas`} accent />
        <KPI label="Receita prevista" value={money(recPend)} sub={`${pendentes.length} pendentes`} />
        <KPI label="Receita total" value={money(recTotal)} sub="confirmada + prevista" />
        <KPI label="Ticket médio" value={ticketMedio > 0 ? money(ticketMedio) : '—'} sub="por reserva" />
        <KPI label="Média de noites" value={mediaNoites} sub="por estadia" />
        <KPI label="Bloqueios" value={bloqueios.length} sub="no período" />
      </div>

      {/* gráfico de receita mensal (12 meses) */}
      <Card style={{ padding: 20, marginBottom: 18 }}>
        <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: '0 0 18px' }}>Receita por mês <span style={{ fontSize: 12.5, color: C.inkSoft, fontWeight: 400 }}>(reservas confirmadas · últimos 12 meses)</span></h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, overflowX: 'auto', paddingBottom: 4 }}>
          {porMes.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 42 }}>
              <div style={{ fontSize: 10.5, color: C.inkSoft, marginBottom: 3, whiteSpace: 'nowrap' }}>{m.v > 0 ? money(m.v).replace('R$\u00a0', '') : ''}</div>
              <div title={money(m.v)} style={{ width: '100%', borderRadius: '5px 5px 0 0', background: m.v > 0 ? `linear-gradient(180deg,${C.brisa},${C.ocean})` : C.espuma, height: `${Math.max(4, Math.round((m.v / maxMes) * 100))}px`, minHeight: 4, transition: 'height .3s' }} />
              <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 4, textTransform: 'uppercase' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginBottom: 18 }} className="pm-dash-grid">
        {/* receita por apartamento */}
        <Card style={{ padding: 20 }}>
          <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: '0 0 16px' }}>Desempenho por apartamento</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.line}` }}>
                  {['Apartamento', 'Reservas', 'Noites', 'Receita', 'Participação'].map(h => (
                    <th key={h} style={{ padding: '6px 10px 10px', textAlign: h === 'Apartamento' ? 'left' : 'right', color: C.inkSoft, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porApt.map((p, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
                    <td style={{ padding: '9px 10px', fontWeight: 600 }}>{p.nome}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: C.inkSoft }}>{p.qtd}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: C.inkSoft }}>{p.noites}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700 }}>{money(p.receita)}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <div style={{ width: 64, height: 7, background: C.espuma, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${maxReceita > 0 ? Math.round((p.receita / maxReceita) * 100) : 0}%`, height: '100%', background: `linear-gradient(90deg,${C.brisa},${C.ocean})`, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12, color: C.inkSoft, minWidth: 30, textAlign: 'right' }}>{maxReceita > 0 ? Math.round((p.receita / maxReceita) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {recTotal > 0 && (
                <tfoot>
                  <tr style={{ background: C.espuma }}>
                    <td style={{ padding: '9px 10px', fontWeight: 700 }}>Total</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700 }}>{filtradas.filter(r => r.status !== 'bloqueio').length}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700 }}>{filtradas.filter(r => r.status !== 'bloqueio').reduce((s, r) => s + nights(r.checkIn, r.checkOut), 0)}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: C.coralDeep }}>{money(recTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>

        {/* origem das reservas */}
        <Card style={{ padding: 20 }}>
          <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: '0 0 16px' }}>Origem das reservas</h3>
          {origensList.length === 0
            ? <p style={{ color: C.inkSoft, fontSize: 14, margin: 0 }}>Sem dados no período.</p>
            : <div style={{ display: 'grid', gap: 10 }}>
              {origensList.map(([o, v]) => (
                <div key={o}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{o}</span>
                    <span style={{ color: C.inkSoft }}>{v} ({totalOrig > 0 ? Math.round((v / totalOrig) * 100) : 0}%)</span>
                  </div>
                  <div style={{ height: 8, background: C.espuma, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${totalOrig > 0 ? Math.round((v / totalOrig) * 100) : 0}%`, height: '100%', background: `linear-gradient(90deg,${C.coral},${C.coralDeep})`, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>}

          <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 18, paddingTop: 14 }}>
            <h4 style={{ fontFamily: F.disp, fontSize: 15, margin: '0 0 10px', color: C.inkSoft }}>Reservas por status</h4>
            {[['confirmada', 'Confirmadas'], ['pendente', 'Pendentes'], ['bloqueio', 'Bloqueios']].map(([st, label]) => {
              const n = filtradas.filter(r => r.status === st).length;
              return (
                <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Badge status={st} />
                  <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{n}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* tabela de reservas recentes */}
      <Card style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: 0 }}>Reservas no período <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 400 }}>· {filtradas.filter(r => r.status !== 'bloqueio').length} registos</span></h3>
          <Btn size="sm" variant="ghost" onClick={() => go('reservas')}>Gerir reservas</Btn>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.line}` }}>
                {['Código', 'Hóspede', 'Apartamento', 'Check-in', 'Check-out', 'Noites', 'Total', 'Status'].map(h => (
                  <th key={h} style={{ padding: '6px 10px 10px', textAlign: 'left', color: C.inkSoft, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.filter(r => r.status !== 'bloqueio').sort((a, b) => parseYMD(b.checkIn) - parseYMD(a.checkIn)).slice(0, 40).map(r => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12, color: C.inkSoft }}>{r.codigo}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.hospede || '—'}</td>
                  <td style={{ padding: '8px 10px', color: C.inkSoft }}>{data.apartamentos.find(a => a.id === r.apartamentoId)?.nome || '—'}</td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmtShort(r.checkIn)}</td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmtShort(r.checkOut)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{nights(r.checkIn, r.checkOut)}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{money(r.total)}</td>
                  <td style={{ padding: '8px 10px' }}><Badge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.filter(r => r.status !== 'bloqueio').length > 40 && (
            <div style={{ padding: '12px 10px', fontSize: 13, color: C.inkSoft, textAlign: 'center' }}>A mostrar 40 de {filtradas.filter(r => r.status !== 'bloqueio').length} registos. Use filtros de período para refinar.</div>
          )}
        </div>
      </Card>
    </div>
  );
}


/* ── Reservations (calendar + list) ── */
function Reservations({ data, update }) {
  const [view, setView] = useState('calendario');
  const [start, setStart] = useState(today());
  const [showPrices, setShowPrices] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const monthPickerRef = useRef(null);

  const DAYS = 21, COLW = 46, NAMEW = 188;
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(start, i)), [start]);
  const aptName = (id) => data.apartamentos.find(a => a.id === id)?.nome || '—';
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
  /* advance/retreat by whole months */
  const shiftMonth = (delta) => {
    const d = new Date(start.getFullYear(), start.getMonth() + delta, 1);
    setStart(d);
  };

  /* close picker on outside click */
  useEffect(() => {
    if (!monthPickerOpen) return;
    const handler = (e) => { if (monthPickerRef.current && !monthPickerRef.current.contains(e.target)) setMonthPickerOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [monthPickerOpen]);

  const openNew = (aptId, dObj) => { setPrefill(aptId ? { apartamentoId: aptId, checkIn: ymd(dObj), checkOut: ymd(addDays(dObj, 1)) } : null); setEditing('new'); };

  const save = (r) => {
    update(prev => {
      const exists = prev.reservas.some(x => x.id === r.id);
      return { ...prev, reservas: exists ? prev.reservas.map(x => x.id === r.id ? r : x) : [...prev.reservas, r] };
    });
    setEditing(null); setPrefill(null);
  };
  const remove = (id) => { update(prev => ({ ...prev, reservas: prev.reservas.filter(x => x.id !== id) })); setEditing(null); };
  const duplicate = (id) => update(prev => ({ ...prev, reservas: duplicateInList(prev.reservas, id, r => ({ ...r, id: uid(), codigo: code(), status: 'pendente', extras: (r.extras || []).map(e => ({ ...e, id: uid() })) })) }));

  // ── Base de dados: exportar / importar ──
  const fileRef = useRef(null);
  const [dbOpen, setDbOpen] = useState(false);
  const [importMsg, setImportMsg] = useState(null); // { ok, text }

  const exportCSV = () => downloadBlob(buildCSV(data.reservas, data.apartamentos), 'reservas-pinheiramar.csv', 'text/csv;charset=utf-8');
  const exportJSON = () => downloadBlob(JSON.stringify(data, null, 2), 'pinheiramar-backup.json', 'application/json');
  const exportXLSX = () => {
    try {
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
          const obj = JSON.parse(reader.result);
          if (!obj || !Array.isArray(obj.apartamentos) || !Array.isArray(obj.reservas)) throw new Error('estrutura não reconhecida');
          update(() => obj);
          setImportMsg({ ok: true, text: `Backup restaurado — ${obj.reservas.length} reservas e ${obj.apartamentos.length} apartamentos.` });
        } catch (err) { setImportMsg({ ok: false, text: 'JSON inválido: ' + err.message }); }
      };
      reader.readAsText(file); return;
    }
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
        const existing = new Set(data.reservas.map(r => r.codigo));
        const obrig = mkExtrasObrigatorios(data.taxasAdicionais);
        const obrigTotal = obrig.reduce((s, e) => s + e.preco, 0);
        const novos = []; let skipped = 0;
        rows.forEach(row => {
          const r = rowToReserva(row, data.apartamentos);
          if (!r || existing.has(r.codigo)) { skipped++; return; }
          // Attach mandatory extras; adjust total if extras were empty
          r.extras = obrig.map(e => ({ ...e, id: uid() }));
          r.total = r.total + obrigTotal;
          r.sinal = Math.round(r.total * 0.5);
          existing.add(r.codigo); novos.push(r);
        });
        if (novos.length) update(prev => ({ ...prev, reservas: [...prev.reservas, ...novos] }));
        setImportMsg({ ok: novos.length > 0, text: `Importação concluída — ${novos.length} reserva(s) adicionada(s)${skipped ? `, ${skipped} ignorada(s) (duplicadas ou apartamento não encontrado)` : ''}.` });
      } catch (err) { setImportMsg({ ok: false, text: 'Não foi possível ler o ficheiro: ' + err.message }); }
    })();
  };

  const DB_ACTIONS = [
    ['Importar (Excel / CSV / JSON)', () => { fileRef.current?.click(); }, Upload],
    ['Exportar Excel (.xlsx)', () => { exportXLSX(); setDbOpen(false); }, Download],
    ['Exportar CSV', () => { exportCSV(); setDbOpen(false); }, Download],
    ['Backup completo (JSON)', () => { exportJSON(); setDbOpen(false); }, Database],
  ];

  const [manualOrder, setManualOrder] = useState(false);
  const dndRes = useReorder(data.reservas, arr => update(prev => ({ ...prev, reservas: arr })));
  const listSorted = manualOrder
    ? data.reservas
    : [...data.reservas].sort((a, b) => parseYMD(b.checkIn) - parseYMD(a.checkIn));
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

      <Card style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: C.espuma, borderRadius: 10, padding: 3 }}>
          {['calendario', 'lista'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, background: view === v ? '#fff' : 'transparent', color: view === v ? C.ocean : C.inkSoft, boxShadow: view === v ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>{v === 'calendario' ? 'Calendário' : 'Lista'}</button>
          ))}
        </div>
        {view === 'calendario' && <>
          {/* ── mês/ano clicável com dropdown picker ── */}
          <div style={{ position: 'relative', marginLeft: 8 }} ref={monthPickerRef}>
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
                          const isCurrent = pickerYear === pickerMonth + 1 && idx === pickerMonth; // highlight active
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

          {/* ── navegação ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
            {/* mês anterior */}
            <button onClick={() => shiftMonth(-1)} title="Mês anterior"
              style={{ height: 32, padding: '0 8px', border: `1px solid ${C.line}`, borderRadius: '8px 0 0 8px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', color: C.inkSoft }}>
              <ChevronLeft size={14} /><ChevronLeft size={14} style={{ marginLeft: -6 }} />
            </button>
            {/* semana anterior */}
            <button onClick={() => setStart(addDays(start, -7))} title="Semana anterior"
              style={{ height: 32, padding: '0 8px', border: `1px solid ${C.line}`, borderLeft: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', color: C.inkSoft }}>
              <ChevronLeft size={14} />
            </button>
            {/* hoje */}
            <button onClick={() => setStart(today())} title="Ir para hoje"
              style={{ height: 32, padding: '0 12px', border: `1px solid ${C.line}`, borderLeft: 'none', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.ink }}>
              Hoje
            </button>
            {/* próxima semana */}
            <button onClick={() => setStart(addDays(start, 7))} title="Próxima semana"
              style={{ height: 32, padding: '0 8px', border: `1px solid ${C.line}`, borderLeft: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', color: C.inkSoft }}>
              <ChevronRight size={14} />
            </button>
            {/* próximo mês */}
            <button onClick={() => shiftMonth(1)} title="Próximo mês"
              style={{ height: 32, padding: '0 8px', border: `1px solid ${C.line}`, borderLeft: 'none', borderRadius: '0 8px 8px 0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', color: C.inkSoft }}>
              <ChevronRight size={14} /><ChevronRight size={14} style={{ marginLeft: -6 }} />
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: C.inkSoft, cursor: 'pointer' }}>
            <input type="checkbox" checked={showPrices} onChange={e => setShowPrices(e.target.checked)} /> Mostrar preços
          </label>
        </>}
      </Card>

      {view === 'calendario' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: NAMEW + DAYS * COLW }}>
              {/* header */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${C.line}`, background: C.espuma, position: 'sticky', top: 0 }}>
                <div style={{ width: NAMEW, flexShrink: 0, padding: '10px 14px', fontSize: 12.5, fontWeight: 700, color: C.inkSoft, borderRight: `1px solid ${C.line}` }}>Apartamento</div>
                {days.map((d, i) => {
                  const we = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = ymd(d) === ymd(today());
                  const hol = holidaysOn(d);
                  return (
                    <div key={i} title={hol ? hol.map(h => `${h.nome} — ${HOLIDAY_LABELS[h.tipo]}`).join(' · ') : ''}
                      style={{ width: COLW, flexShrink: 0, textAlign: 'center', padding: '6px 0 4px', background: isToday ? '#DCEBE9' : (hol ? 'rgba(62,124,177,.10)' : (we ? 'rgba(231,215,182,.25)' : 'transparent')) }}>
                      <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: 'uppercase' }}>{WD[d.getDay()]}</div>
                      <div style={{ fontSize: 14, fontWeight: isToday ? 700 : 500, color: isToday ? C.ocean : C.ink }}>{d.getDate()}</div>
                      <div style={{ height: 6, marginTop: 1, display: 'flex', justifyContent: 'center', gap: 2 }}>
                        {hol && [...new Set(hol.map(h => h.tipo))].map(tp => <span key={tp} style={{ width: 5, height: 5, borderRadius: '50%', background: HOLIDAY_COLORS[tp] }} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* rows */}
              {data.apartamentos.map(apt => {
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
                    <div style={{ width: NAMEW, flexShrink: 0, padding: '10px 14px', borderRight: `1px solid ${C.line}`, background: '#fff' }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{apt.nome}</div>
                      <div style={{ fontSize: 11.5, color: C.inkSoft }}>{apt.vista} · {apt.capacidade}p</div>
                    </div>
                    <div style={{ position: 'relative', width: DAYS * COLW, flexShrink: 0, height: 50 }}>
                      {/* day cells */}
                      <div style={{ display: 'flex', height: '100%' }}>
                        {days.map((d, i) => {
                          const we = d.getDay() === 0 || d.getDay() === 6;
                          const hol = holidaysOn(d);
                          return (
                            <div key={i} onClick={() => openNew(apt.id, d)} title="Criar reserva"
                              style={{ width: COLW, height: '100%', borderRight: `1px solid ${C.line}`, background: hol ? 'rgba(62,124,177,.07)' : (we ? 'rgba(231,215,182,.13)' : '#fff'), cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 10.5, color: C.inkSoft }}>
                              {showPrices ? money(nightlyRate(apt, data.seasons, d)).replace('R$', '').trim() : ''}
                            </div>
                          );
                        })}
                      </div>
                      {/* reservation bars */}
                      {segs.map(({ r, left, right }) => {
                        const st = STATUS[r.status];
                        return (
                          <button key={r.id} onClick={() => setEditing(r)} title={`${r.hospede || 'Bloqueio'} · ${fmtShort(r.checkIn)} (13h) → ${fmtShort(r.checkOut)} (10h)`}
                            style={{ position: 'absolute', top: 7, height: 36, left: left + 2, width: Math.max(10, right - left - 4), background: st.bar, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '0 8px', textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', boxShadow: '0 1px 4px rgba(0,0,0,.12)' }}>
                            {r.status === 'bloqueio' ? '⛔ Bloqueio' : (r.hospede || 'Reserva')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, padding: '12px 16px', fontSize: 12.5, color: C.inkSoft, flexWrap: 'wrap', alignItems: 'center', borderTop: `1px solid ${C.line}` }}>
            {Object.entries(STATUS).filter(([k]) => k !== 'cancelada').map(([k, s]) =>
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: s.bar }} /> {s.label}</span>)}
            <span style={{ width: 1, height: 16, background: C.line }} />
            {Object.entries(HOLIDAY_LABELS).map(([tp, label]) =>
              <span key={tp} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: HOLIDAY_COLORS[tp] }} /> {label}</span>)}
            <span style={{ marginLeft: 'auto' }}>Check-out 10h · check-in 13h — turnover no mesmo dia permitido.</span>
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

      {view === 'lista' && (
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '8px 14px', borderBottom: `1px solid ${C.line}`, gap: 8 }}>
            <span style={{ fontSize: 12, color: C.inkSoft }}>Ordenação:</span>
            <button onClick={() => setManualOrder(false)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, background: !manualOrder ? C.ocean : C.espuma, color: !manualOrder ? '#fff' : C.inkSoft }}>Por data</button>
            <button onClick={() => setManualOrder(true)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, background: manualOrder ? C.ocean : C.espuma, color: manualOrder ? '#fff' : C.inkSoft }}>Manual ⠿</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 720 }}>
              <thead><tr style={{ background: C.espuma, textAlign: 'left', color: C.inkSoft }}>
                {[manualOrder ? '⠿' : '', 'Código', 'Apartamento', 'Hóspede', 'Estadia', 'Origem', 'Total', 'Estado', ''].map((h, i) => <th key={i} style={{ padding: '12px 14px', fontWeight: 700, fontSize: 12.5 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {listSorted.slice(0, listCap).map((r, idx) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${C.line}`, opacity: dndRes.dragging === r.id ? 0.4 : 1, outline: dndRes.over === r.id ? `2px dashed ${C.coral}` : 'none' }}
                    draggable={manualOrder} onDragStart={manualOrder ? () => dndRes.onDragStart(r.id) : undefined}
                    onDragOver={manualOrder ? e => { e.preventDefault(); dndRes.onDragOver(r.id); } : undefined}
                    onDrop={manualOrder ? () => dndRes.onDrop() : undefined}>
                    <td style={{ padding: '11px 10px', color: C.inkSoft, cursor: manualOrder ? 'grab' : 'default', fontSize: 16 }}>{manualOrder ? '⠿' : ''}</td>
                    <td style={{ padding: '11px 14px', fontFamily: F.disp, color: C.ocean }}>{r.codigo}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600 }}>{aptName(r.apartamentoId)}</td>
                    <td style={{ padding: '11px 14px' }}>{r.status === 'bloqueio' ? <span style={{ color: C.inkSoft }}>—</span> : r.hospede}</td>
                    <td style={{ padding: '11px 14px', color: C.inkSoft }}>{fmtShort(r.checkIn)} → {fmtShort(r.checkOut)}</td>
                    <td style={{ padding: '11px 14px', color: C.inkSoft }}>{r.origem}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600 }}>{money(r.total)}</td>
                    <td style={{ padding: '11px 14px' }}><Badge status={r.status} /></td>
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => duplicate(r.id)} title="Duplicar" style={iconBtn}><Copy size={15} /></button>
                      <button onClick={() => setEditing(r)} title="Editar" style={{ ...iconBtn, marginLeft: 6 }}><Pencil size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '11px 16px', fontSize: 12.5, color: C.inkSoft, borderTop: `1px solid ${C.line}` }}>
            {listSorted.length > listCap ? `A mostrar as ${listCap} reservas mais recentes de ${listSorted.length}. Use a exportação para ver todas.` : `${listSorted.length} reserva(s) no total.`}
          </div>
        </Card>
      )}

      {editing && <ReservationForm data={data} initial={editing === 'new' ? prefill : editing} isNew={editing === 'new'}
        onSave={save} onRemove={remove} onClose={() => { setEditing(null); setPrefill(null); }} />}
    </div>
  );
}
const iconBtn = { background: C.espuma, border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.inkSoft };

const secTitle = { fontFamily: F.disp, fontSize: 16, color: C.ink, margin: '2px 0 10px', display: 'flex', alignItems: 'center', gap: 8 };
const cellInput = { width: '100%', padding: '7px 9px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: F.sans, outline: 'none', background: '#fff', color: C.ink };

function Stepper({ value, set, min = 0, max = 99, disabled }) {
  const btn = { width: 36, height: 40, border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.ocean };
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden', opacity: disabled ? 0.5 : 1, background: '#fff' }}>
      <button type="button" disabled={disabled || value <= min} onClick={() => set(Math.max(min, value - 1))} style={{ ...btn, borderRight: `1px solid ${C.line}` }}><Minus size={15} /></button>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 600, minWidth: 44 }}>{value}</div>
      <button type="button" disabled={disabled || value >= max} onClick={() => set(Math.min(max, value + 1))} style={{ ...btn, borderLeft: `1px solid ${C.line}` }}><Plus size={15} /></button>
    </div>
  );
}
const MoneyInput = ({ value, onChange, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 8px', background: '#fff', ...style }}>
    <span style={{ fontSize: 12, color: C.inkSoft }}>R$</span>
    <input className="pmf" type="number" step="1" value={value} onChange={onChange}
      style={{ width: '100%', border: 'none', outline: 'none', padding: '7px 0', fontSize: 13, fontFamily: F.sans, background: 'transparent', color: C.ink }} />
  </div>
);

function ReservationForm({ data, initial, isNew, onSave, onRemove, onClose }) {
  const i = initial || {};
  const firstApt = data.apartamentos[0];
  const [aptId, setAptId] = useState(i.apartamentoId || firstApt.id);
  const [ci, setCi] = useState(i.checkIn || ymd(today()));
  const [co, setCo] = useState(i.checkOut || ymd(addDays(today(), 1)));
  const [status, setStatus] = useState(i.status || 'confirmada');
  const [origem, setOrigem] = useState(i.origem || 'Manual');
  const [adultos, setAdultos] = useState(i.adultos ?? (i.hospedes || 2));
  const [criancas, setCriancas] = useState(i.criancas ?? 0);
  const [nome, setNome] = useState(i.nome ?? (i.hospede ? i.hospede.split(' ')[0] : ''));
  const [sobrenome, setSobrenome] = useState(i.sobrenome ?? (i.hospede ? i.hospede.split(' ').slice(1).join(' ') : ''));
  const [tel, setTel] = useState(i.telefone || '');
  const [pais, setPais] = useState(i.pais || 'Brasil');
  const [email, setEmail] = useState(i.email || '');
  const [enviarEmail, setEnviarEmail] = useState(i.enviarEmail || false);
  const [nota, setNota] = useState(i.nota || '');
  const [extras, setExtras] = useState(() => {
    if (!isNew && i.extras && i.extras.length > 0) {
      // Edição: preservar extras existentes (já tinham as obrigatórias quando foram criadas)
      return i.extras.map(e => ({ id: e.id || uid(), nome: e.nome, qtd: e.qtd, preco: e.preco }));
    }
    // Nova reserva: pré-carregar as taxas obrigatórias
    return mkExtrasObrigatorios(data.taxasAdicionais);
  });

  const apt = data.apartamentos.find(a => a.id === aptId) || firstApt;
  const validDates = nights(ci, co) >= 1;
  const n = Math.max(1, nights(ci, co));
  const bd = stayBreakdown(apt, data.seasons, ci, co);
  const suggested = Math.round(bd.total / n);
  const ciSeason = seasonForDate(data.seasons, parseYMD(ci));
  const seasonRates = aptRates(ciSeason, apt.id) || {};
  const adultoExtra = Number(seasonRates.adultoExtra) || 0;

  const [precoNoite, setPrecoNoite] = useState(() => {
    // Sempre parte do valor calculado pela temporada — mesmo em edição.
    // O utilizador pode sobrepor manualmente depois.
    const a = data.apartamentos.find(x => x.id === (i.apartamentoId || firstApt.id)) || firstApt;
    const bdi = stayBreakdown(a, data.seasons, i.checkIn || ymd(today()), i.checkOut || ymd(addDays(today(), 1)));
    const ni = Math.max(1, nights(i.checkIn || ymd(today()), i.checkOut || ymd(addDays(today(), 1))));
    return Math.round(bdi.total / ni) || (a.preco || 0);
  });
  const [precoEdited, setPrecoEdited] = useState(false); // só true quando o gestor digita manualmente

  // Sempre que muda apartamento OU datas: recalcula pelo valor de temporada do apartamento escolhido.
  // Ignora se o gestor editou manualmente E não mudou o apartamento nem as datas.
  useEffect(() => {
    if (status === 'bloqueio') { setPrecoNoite(0); return; }
    if (nights(ci, co) < 1) return;
    const a = data.apartamentos.find(x => x.id === aptId) || firstApt;
    const newBd = stayBreakdown(a, data.seasons, ci, co);
    setPrecoNoite(Math.round(newBd.total / Math.max(1, nights(ci, co))) || a.preco || 0);
    setPrecoEdited(false); // reset: troca de apt/data cancela override manual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aptId, ci, co, status]);

  const acomod = status === 'bloqueio' ? 0 : Math.round(precoNoite * n);
  const extrasVal = status === 'bloqueio' ? 0 : extras.reduce((s, e) => s + (Number(e.qtd) || 0) * (Number(e.preco) || 0), 0);
  const total = acomod + extrasVal;
  const sinal = Math.round(total * (data.settings.sinalPct / 100));
  const totalGuests = adultos + criancas;
  const free = isAvailable(data.reservas, aptId, ci, co, i.id);
  const overCap = status !== 'bloqueio' && totalGuests > apt.capacidade;
  const canSave = validDates && free && (status === 'bloqueio' || (nome.trim() && sobrenome.trim()));

  const addExtra = (preset) => setExtras(x => [...x, { id: uid(), nome: preset?.nome || '', qtd: 1, preco: preset?.preco ?? 0 }]);
  const updExtra = (id, patch) => setExtras(x => x.map(e => e.id === id ? { ...e, ...patch } : e));
  const delExtra = (id) => setExtras(x => x.filter(e => e.id !== id));
  const ORIGENS = [...new Set([origem, 'Manual', 'Site', 'Telefone', 'WhatsApp', 'Booking', 'Airbnb'])];

  return (
    <Modal title={isNew ? 'Criar nova reserva' : `Reserva ${i.codigo || ''}`} subtitle={`${apt.nome} · ${apt.piso} · ${apt.vista}`} onClose={onClose} wide
      footer={<>
        {!isNew && <Btn variant="danger" icon={Trash2} onClick={() => onRemove(i.id)} style={{ marginRight: 'auto' }}>Eliminar</Btn>}
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={!canSave} style={{ opacity: canSave ? 1 : .5 }}
          onClick={() => onSave({
            id: i.id || uid(), codigo: i.codigo || code(), apartamentoId: aptId, checkIn: ci, checkOut: co,
            status, origem,
            nome: status === 'bloqueio' ? '' : nome.trim(), sobrenome: status === 'bloqueio' ? '' : sobrenome.trim(),
            hospede: status === 'bloqueio' ? '' : `${nome.trim()} ${sobrenome.trim()}`.trim(),
            email: email.trim(), telefone: tel.trim(), pais,
            adultos: status === 'bloqueio' ? 0 : adultos, criancas: status === 'bloqueio' ? 0 : criancas,
            hospedes: status === 'bloqueio' ? 0 : totalGuests,
            precoNoite: status === 'bloqueio' ? 0 : Math.round((Number(precoNoite) || 0) * 100) / 100,
            precoTabela: status === 'bloqueio' ? 0 : bd.total,
            extras: status === 'bloqueio' ? [] : extras.map(e => ({ id: e.id, nome: e.nome, qtd: Number(e.qtd) || 0, preco: Number(e.preco) || 0 })),
            total, sinal, enviarEmail, nota, criadoEm: i.criadoEm || ymd(today()),
          })}>{isNew ? 'Salvar reserva' : 'Guardar alterações'}</Btn>
      </>}>
      <div style={{ display: 'grid', gap: 20 }}>

        {/* Status */}
        <div>
          <div style={secTitle}><Tag size={16} color={C.brisa} /> Status da reserva</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Estado">
              <Select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="confirmada">Reservado / Confirmada</option><option value="pendente">Pendente</option>
                <option value="bloqueio">Bloqueio</option><option value="cancelada">Cancelada</option>
              </Select>
            </Field>
            <Field label="Origem"><Select value={origem} onChange={e => setOrigem(e.target.value)}>{ORIGENS.map(o => <option key={o}>{o}</option>)}</Select></Field>
          </div>
        </div>

        {/* Detalhes da reserva */}
        <div>
          <div style={secTitle}><CalendarDays size={16} color={C.brisa} /> Detalhes da reserva</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Check-in" required><DateInput value={ci} onChange={e => { setCi(e.target.value); if (nights(e.target.value, co) < 1) setCo(ymd(addDays(parseYMD(e.target.value), 1))); }} /></Field>
            <Field label="Check-out" required><DateInput value={co} min={ymd(addDays(parseYMD(ci), 1))} onChange={e => setCo(e.target.value)} /></Field>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: C.inkSoft, margin: '8px 2px 0' }}>
            <Clock size={14} color={C.brisa} /> Check-in a partir das <b style={{ color: C.ink }}>{data.settings.checkInHora}</b> · check-out até às <b style={{ color: C.ink }}>{data.settings.checkOutHora}</b>. Pode terminar e iniciar reservas no mesmo dia.
          </div>
          {status !== 'bloqueio' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              <Field label="Adultos"><Stepper value={adultos} set={setAdultos} min={1} max={apt.capacidade} /></Field>
              <Field label="Crianças"><Stepper value={criancas} set={setCriancas} min={0} max={Math.max(0, apt.capacidade - 1)} /></Field>
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <Field label="Apartamento (tipo / acomodação)" required>
              <Select value={aptId} onChange={e => setAptId(e.target.value)}>{data.apartamentos.map(a => <option key={a.id} value={a.id}>{roomFullName(a)}</option>)}</Select>
            </Field>
          </div>
          {!free && <div style={{ marginTop: 12 }}><Note color="#B23B3B" bg="#F7E9E9"><AlertCircle size={15} /> Conflito: já existe uma reserva neste apartamento nestas datas.</Note></div>}
          {overCap && <div style={{ marginTop: 10 }}><Note color="#9A6A14" bg="#FBEFD9"><AlertCircle size={15} /> {totalGuests} hóspedes excede a capacidade do apartamento ({apt.capacidade}).</Note></div>}
        </div>

        {/* Hóspede */}
        {status !== 'bloqueio' && <div>
          <div style={secTitle}><Users size={16} color={C.brisa} /> Detalhes do hóspede</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Nome" required><TextInput value={nome} onChange={e => setNome(e.target.value)} placeholder="Primeiro nome" /></Field>
              <Field label="Sobrenome" required><TextInput value={sobrenome} onChange={e => setSobrenome(e.target.value)} placeholder="Apelido" /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Telefone"><TextInput value={tel} onChange={e => setTel(e.target.value)} placeholder="(00) 00000-0000" /></Field>
              <Field label="País"><Select value={pais} onChange={e => setPais(e.target.value)}>{[...new Set([pais, ...PAISES])].map(p => <option key={p}>{p}</option>)}</Select></Field>
            </div>
            <Field label="Email"><TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" /></Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: C.ink, cursor: 'pointer' }}>
              <input type="checkbox" checked={enviarEmail} onChange={e => setEnviarEmail(e.target.checked)} /> Enviar um email de confirmação para o hóspede
            </label>
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
            <div style={{ overflowX: 'auto' }}>
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
            <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => addExtra()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: `1px dashed ${C.line}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.ocean, fontWeight: 600, fontSize: 12.5 }}><Plus size={14} /> Adicionar item</button>
              {adultoExtra > 0 && (
                <button type="button" onClick={() => addExtra({ nome: 'Adulto extra', preco: adultoExtra })} title="Adicionar adulto extra (tarifa da temporada)"
                  style={{ background: '#E1F0EC', border: '1px solid #BFE0D6', borderRadius: 999, padding: '5px 11px', cursor: 'pointer', color: '#1C7A5B', fontSize: 11.5, fontWeight: 600 }}>
                  Adulto extra ({money(adultoExtra)})
                </button>
              )}
              {(data.taxasAdicionais || []).map(tx => (
                <button key={tx.id} type="button" onClick={() => addExtra({ nome: tx.nome, preco: tx.preco })} title={`Adicionar: ${tx.nome} — ${tx.tipo === 'obrigatoria' ? 'Obrigatória' : 'Opcional'}`}
                  style={{ background: tx.tipo === 'obrigatoria' ? '#E1F0EC' : C.areiaSoft, border: `1px solid ${tx.tipo === 'obrigatoria' ? '#BFE0D6' : C.areia}`, borderRadius: 999, padding: '5px 11px', cursor: 'pointer', color: tx.tipo === 'obrigatoria' ? '#1C7A5B' : C.ink, fontSize: 11.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {tx.tipo === 'obrigatoria' && <span title="Obrigatória" style={{ fontSize: 9, fontWeight: 800, background: '#1C7A5B', color: '#fff', borderRadius: 3, padding: '1px 4px' }}>OBR</span>}
                  {tx.nome.length > 26 ? tx.nome.slice(0, 24) + '…' : tx.nome} · {money(tx.preco)}
                </button>
              ))}
            </div>
            <div style={{ background: C.oceanDeep, color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.82)' }}>Sinal {data.settings.sinalPct}%: <b style={{ color: C.areia }}>{money(sinal)}</b></div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.82)' }}>Total:</span>
                <span style={{ fontSize: 24, fontWeight: 700, fontFamily: F.disp }}>{money(total)}</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: C.inkSoft, margin: '8px 2px 0' }}>Ajuste o preço por noite ou adicione itens/descontos para negociar o valor final livremente.</p>
        </div>}
      </div>
    </Modal>
  );
}
const Note = ({ children, color, bg }) => <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: bg, color, padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{children}</div>;

/* ── Apartments ── */
function Apartments({ data, update }) {
  const [editing, setEditing] = useState(null);
  const save = (a) => {
    update(prev => {
      const exists = prev.apartamentos.some(x => x.id === a.id);
      return { ...prev, apartamentos: exists ? prev.apartamentos.map(x => x.id === a.id ? a : x) : [...prev.apartamentos, a] };
    });
    setEditing(null);
  };
  const remove = (id) => { update(prev => ({ ...prev, apartamentos: prev.apartamentos.filter(x => x.id !== id) })); setEditing(null); };
  const duplicate = (id) => update(prev => ({ ...prev, apartamentos: duplicateInList(prev.apartamentos, id, a => ({ ...a, id: 'a' + uid(), nome: a.nome + ' (cópia)' })) }));
  const dnd = useReorder(data.apartamentos, (arr) => update(prev => ({ ...prev, apartamentos: arr })));

  return (
    <div>
      <PageHead title="Apartamentos" sub={`${data.apartamentos.length} unidades · arraste para ordenar`}
        action={<Btn icon={Plus} onClick={() => setEditing('new')}>Adicionar</Btn>} />
      <div style={{ display: 'grid', gap: 12 }}>
        {data.apartamentos.map((a, idx) => (
          <Card key={a.id} {...dnd.zone(idx)} style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, ...dnd.deco(idx) }}>
            <DragGrip {...dnd.grip(idx)} />
            <div style={{ width: 96, flexShrink: 0 }}><PhotoTile apt={a} h={64} radius={10} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.disp, fontSize: 18 }}>{a.nome} <span style={{ fontSize: 13, color: C.inkSoft, fontFamily: F.sans }}>— {a.piso} · {a.vista}</span></div>
              <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2, display: 'flex', gap: 14 }}>
                <span>Até {a.capacidade} pessoas</span><span>{money(a.preco)} / noite (base)</span>
                {!a.ativo && <span style={{ color: '#B23B3B', fontWeight: 600 }}>Inativo</span>}
              </div>
            </div>
            <button onClick={() => duplicate(a.id)} title="Duplicar" style={iconBtn}><Copy size={16} /></button>
            <button onClick={() => setEditing(a)} title="Editar" style={iconBtn}><Pencil size={16} /></button>
            <button onClick={() => remove(a.id)} title="Eliminar" style={{ ...iconBtn, color: '#B23B3B' }}><Trash2 size={16} /></button>
          </Card>
        ))}
      </div>
      {editing && <ApartmentForm initial={editing === 'new' ? null : editing} isNew={editing === 'new'} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}
/* ── ApartmentForm ── */
const AMENIDADES_LIST = [
  'Ar Condicionado', 'Internet (Wi-Fi)', 'TV', 'Ducha', 'Cozinha', '1 Quarto + Sofá Cama',
  'Área com Churrasco', 'Área de Serviço', 'Fogão', 'Geladeira', 'Microondas', 'Máquina de Lavar',
  'Secador de Cabelo', 'Ferro de Passar', 'Estacionamento', 'Piscina', 'Academia', 'Churrasqueira',
  'Varanda', 'Vista para o Mar', 'Acessível', 'Berço disponível', 'Animais permitidos',
];
const CAMA_TIPOS = ['Casal', 'Solteiro', 'Queen', 'King', 'Beliche', 'Sofá Cama', 'Colchão Extra'];

function ApartmentForm({ initial, isNew, onSave, onClose }) {
  const i = initial || {};

  /* ── Visão geral ── */
  const [titulo, setTitulo] = useState(i.tipo || i.nome || '');
  const [hospedes, setHospedes] = useState(i.capacidade || 4);
  const [criancas, setCriancas] = useState(i.criancas || 0);
  const [tamanho, setTamanho] = useState(i.tamanho || '');
  const [piso, setPiso] = useState(i.piso || 'Térreo');
  const [vista, setVista] = useState(i.vista || 'Frente Mar');
  const [ativo, setAtivo] = useState(i.ativo !== false);

  /* ── Camas ── */
  const [camas, setCamas] = useState(i.camas || [{ id: uid(), tipo: 'Casal', qtd: 1 }]);
  const addCama = () => setCamas(c => [...c, { id: uid(), tipo: 'Solteiro', qtd: 1 }]);
  const updCama = (id, patch) => setCamas(c => c.map(x => x.id === id ? { ...x, ...patch } : x));
  const delCama = (id) => setCamas(c => c.filter(x => x.id !== id));

  /* ── Amenidades ── */
  const defaultAmen = new Set(i.amenidades || ['Ar Condicionado', 'Internet (Wi-Fi)', 'TV', 'Ducha', 'Cozinha', 'Geladeira']);
  const [amenidades, setAmenidades] = useState(defaultAmen);
  const [showAllAmen, setShowAllAmen] = useState(false);
  const toggleAmen = (a) => setAmenidades(prev => { const s = new Set(prev); s.has(a) ? s.delete(a) : s.add(a); return s; });
  const amenList = showAllAmen ? AMENIDADES_LIST : AMENIDADES_LIST.slice(0, 9);

  /* ── Fotos ── */
  const [fotos, setFotos] = useState(i.fotos || (i.foto ? [i.foto] : []));
  const [fotoInput, setFotoInput] = useState('');
  const addFoto = () => { const u = fotoInput.trim(); if (u) { setFotos(f => [...f, u]); setFotoInput(''); } };
  const delFoto = (idx) => setFotos(f => f.filter((_, j) => j !== idx));

  /* ── Descrição ── */
  const [descricao, setDescricao] = useState(i.descricao || '');

  /* ── Endereço ── */
  const [cidade, setCidade] = useState(i.cidade || 'Palhoça - State of Santa Catarina, Brazil');
  const [endereco, setEndereco] = useState(i.endereco || 'Rua Dom Patrício n.92 - Praia da Pinheira');
  const [cep, setCep] = useState(i.cep || '88135-427');
  const [mostrarMapa, setMostrarMapa] = useState(i.mostrarMapa !== false);

  /* ── Preço ── */
  const [preco, setPreco] = useState(i.preco || 0);
  const [precoFimSemana, setPrecoFimSemana] = useState(i.precoFimSemana || '');

  const nome = titulo.trim().split(' ').slice(0, 2).join(' ') || 'Apto';
  const ok = titulo.trim();

  /* ── Section wrapper ── */
  const Sec = ({ label, children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
      <div style={{ paddingTop: 2 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{label}</div>
      </div>
      <div>{children}</div>
    </div>
  );

  const SpinField = ({ label, value, onChange, min = 0, hint }) => (
    <div>
      <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 4 }}>
        {label} {hint && <span style={{ color: C.brisa, fontSize: 11 }}>ⓘ</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden', width: 90 }}>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          style={{ width: 28, height: 36, background: C.espuma, border: 'none', cursor: 'pointer', fontSize: 16, color: C.inkSoft, display: 'grid', placeItems: 'center' }}>−</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{value}</div>
        <button type="button" onClick={() => onChange(value + 1)}
          style={{ width: 28, height: 36, background: C.espuma, border: 'none', cursor: 'pointer', fontSize: 16, color: C.inkSoft, display: 'grid', placeItems: 'center' }}>+</button>
      </div>
    </div>
  );

  return (
    <Modal
      title={isNew ? 'Adicionar apartamento' : 'Editar seu apartamento'}
      subtitle={isNew ? '' : titulo}
      onClose={onClose} wide
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" disabled={!ok} style={{ opacity: ok ? 1 : .5 }}
            onClick={() => onSave({
              id: i.id || ('a' + uid()),
              nome,
              tipo: titulo.trim(),
              piso, vista, ativo,
              capacidade: Number(hospedes),
              criancas: Number(criancas),
              tamanho: tamanho ? String(tamanho) : '',
              camas,
              amenidades: [...amenidades],
              fotos,
              foto: fotos[0] || '',
              descricao: descricao.trim(),
              cidade: cidade.trim(),
              endereco: endereco.trim(),
              cep: cep.trim(),
              mostrarMapa,
              preco: Number(preco) || 0,
              precoFimSemana: Number(precoFimSemana) || 0,
            })}>
            Salvar
          </Btn>
        </>
      }>

      <div style={{ padding: '0 2px' }}>

        {/* ── 1. Visão geral ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ paddingTop: 2 }}><div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Visão geral</div></div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
              <Field label="Título do apartamento" required>
                <TextInput value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Apto 102 - Térreo Frente Mar, 4 pessoas" />
              </Field>
              <Field label="Unidades" hint="ⓘ">
                <NumberInput value={1} readOnly style={{ background: C.espuma }} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'end' }}>
              <SpinField label="Hóspedes" hint value={hospedes} onChange={setHospedes} min={1} />
              <SpinField label="Crianças" hint value={criancas} onChange={setCriancas} min={0} />
              <Field label="Tamanho" hint="m²">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <NumberInput min={0} value={tamanho} onChange={e => setTamanho(e.target.value)} style={{ width: '100%' }} placeholder="38" />
                  <span style={{ fontSize: 13, color: C.inkSoft, flexShrink: 0 }}>m²</span>
                </div>
              </Field>
              <Field label="Ativo">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 8 }}>
                  <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>Visível no site</span>
                </label>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Piso">
                <Select value={piso} onChange={e => setPiso(e.target.value)}>
                  {['Térreo', '1º Piso', '2º Piso', '3º Piso'].map(o => <option key={o}>{o}</option>)}
                </Select>
              </Field>
              <Field label="Vista">
                <Select value={vista} onChange={e => setVista(e.target.value)}>
                  {['Frente Mar', 'Beira-mar', 'Lateral', 'Interior'].map(o => <option key={o}>{o}</option>)}
                </Select>
              </Field>
            </div>
          </div>
        </div>

        {/* ── 2. Camas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ paddingTop: 2 }}><div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Camas</div></div>
          <div style={{ display: 'grid', gap: 10 }}>
            {camas.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>Tipo de cama</div>
                  <Select value={c.tipo} onChange={e => updCama(c.id, { tipo: e.target.value })} style={{ width: '100%' }}>
                    {CAMA_TIPOS.map(t => <option key={t}>{t}</option>)}
                  </Select>
                </div>
                <div style={{ width: 90 }}>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>Quantidade</div>
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
                    <button type="button" onClick={() => updCama(c.id, { qtd: Math.max(1, c.qtd - 1) })} style={{ width: 28, height: 36, background: C.espuma, border: 'none', cursor: 'pointer', fontSize: 16, color: C.inkSoft, display: 'grid', placeItems: 'center' }}>−</button>
                    <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{c.qtd}</div>
                    <button type="button" onClick={() => updCama(c.id, { qtd: c.qtd + 1 })} style={{ width: 28, height: 36, background: C.espuma, border: 'none', cursor: 'pointer', fontSize: 16, color: C.inkSoft, display: 'grid', placeItems: 'center' }}>+</button>
                  </div>
                </div>
                <button type="button" onClick={() => delCama(c.id)} style={{ ...iconBtn, marginTop: 18, color: '#B23B3B' }}><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" onClick={addCama}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: `1px dashed ${C.line}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: C.brisa, fontWeight: 600, fontSize: 13, alignSelf: 'flex-start' }}>
              <Plus size={14} /> Escolha o tipo
            </button>
          </div>
        </div>

        {/* ── 3. Amenidades ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ paddingTop: 2 }}><div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Amenidades</div></div>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 12px' }}>
              {amenList.map(a => (
                <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13.5 }}>
                  <input type="checkbox" checked={amenidades.has(a)} onChange={() => toggleAmen(a)}
                    style={{ accentColor: C.brisa, width: 15, height: 15, flexShrink: 0 }} />
                  {a}
                </label>
              ))}
            </div>
            <button type="button" onClick={() => setShowAllAmen(s => !s)}
              style={{ background: 'none', border: 'none', color: C.brisa, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginTop: 10, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              {showAllAmen ? '− Menos amenidades' : '+ Mais amenidades'}
            </button>
          </div>
        </div>

        {/* ── 4. Fotos ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ paddingTop: 2 }}><div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Fotos</div></div>
          <div>
            {fotos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, marginBottom: 12 }}>
                {fotos.map((f, idx) => (
                  <div key={idx} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3', background: C.espuma }}>
                    <img src={f} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }} />
                    <button type="button" onClick={() => delFoto(idx)}
                      style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,.55)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12, display: 'grid', placeItems: 'center', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <TextInput value={fotoInput} onChange={e => setFotoInput(e.target.value)}
                placeholder="Cole o URL de uma foto (https://...)" style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFoto())} />
              <Btn variant="soft" onClick={addFoto} icon={Plus}>Adicionar</Btn>
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}>
              {fotos.length}/10 fotos · A primeira foto é a imagem principal do apartamento.
            </div>
          </div>
        </div>

        {/* ── 5. Descrição ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ paddingTop: 2 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Descrição</div>
            <div style={{ fontSize: 12, color: C.brisa, marginTop: 8, cursor: 'pointer', fontWeight: 600 }}>Encontre Ideias</div>
          </div>
          <div>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value.slice(0, 2000))}
              placeholder={`Acomodação para até ${hospedes} pessoas.\n\nDescreva o apartamento, a vista, a localização e os destaques...`}
              style={{ minHeight: 120, resize: 'vertical' }} />
            <div style={{ fontSize: 11.5, color: C.inkSoft, textAlign: 'right', marginTop: 4 }}>{descricao.length}/2000</div>
          </div>
        </div>

        {/* ── 6. Endereço ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ paddingTop: 2 }}><div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Endereço</div></div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.inkSoft }}>Mostrar mapa de localização</span>
              <div onClick={() => setMostrarMapa(m => !m)} style={{ width: 42, height: 24, borderRadius: 12, background: mostrarMapa ? C.brisa : C.line, cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: mostrarMapa ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left .2s' }} />
              </div>
            </div>
            <Field label="Cidade, Estado, País" hint="ⓘ">
              <TextInput value={cidade} onChange={e => setCidade(e.target.value)} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
              <Field label="Endereço"><TextInput value={endereco} onChange={e => setEndereco(e.target.value)} /></Field>
              <Field label="Código postal (CEP)"><TextInput value={cep} onChange={e => setCep(e.target.value)} /></Field>
            </div>
            {mostrarMapa && (
              <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.line}`, height: 180, background: C.espuma, display: 'grid', placeItems: 'center' }}>
                <iframe title="mapa" width="100%" height="180" style={{ border: 0, display: 'block' }}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(endereco + ', ' + cidade)}&output=embed&zoom=15`}
                  loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            )}
          </div>
        </div>

        {/* ── 7. Preço ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0 8px' }}>
          <div style={{ paddingTop: 2 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Preço</div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>(antes de impostos)</div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 12, alignItems: 'end' }}>
              <Field label="Tipo de cobrança">
                <Select value="Por noite" readOnly style={{ background: C.espuma }}>
                  <option>Por noite</option>
                </Select>
              </Field>
              <Field label="Preço durante a semana" hint="ⓘ">
                <MoneyInput value={preco} onChange={e => setPreco(e.target.value === '' ? '' : Number(e.target.value))} />
              </Field>
              <Field label="Preço de fim de semana" hint="ⓘ">
                <MoneyInput value={precoFimSemana} onChange={e => setPrecoFimSemana(e.target.value === '' ? '' : Number(e.target.value))} />
              </Field>
            </div>
            <div style={{ fontSize: 12, color: C.brisa, cursor: 'pointer', fontWeight: 600 }}>+ Mais opções de preço</div>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
              O preço base é usado como referência quando não há temporada activa. Para tarifas diferenciadas por período use <b>Opções de preços</b>.
            </p>
          </div>
        </div>

      </div>
    </Modal>
  );
}

/* ── Seasons ── */
function Seasons({ data, update }) {
  const [editing, setEditing] = useState(null);
  const t = today();
  const save = (s) => {
    update(prev => { const ex = prev.seasons.some(x => x.id === s.id); return { ...prev, seasons: ex ? prev.seasons.map(x => x.id === s.id ? s : x) : [...prev.seasons, s] }; });
    setEditing(null);
  };
  const remove = (id) => { update(prev => ({ ...prev, seasons: prev.seasons.filter(x => x.id !== id) })); setEditing(null); };
  const duplicate = (id) => update(prev => ({ ...prev, seasons: duplicateInList(prev.seasons, id, s => ({ ...s, id: 's' + uid(), nome: s.nome + ' (cópia)', precos: Object.fromEntries(Object.entries(s.precos || {}).map(([k, v]) => [k, { ...v }])) })) }));
  const dnd = useReorder(data.seasons, (arr) => update(prev => ({ ...prev, seasons: arr })));
  const priceRange = (s) => {
    const vals = data.apartamentos.map(a => Number(s.precos?.[a.id]?.diaSemana) || 0).filter(Boolean);
    if (!vals.length) return '—';
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`;
  };

  return (
    <div>
      <PageHead title="Opções de preços por temporada" sub="Defina a tarifa de cada apartamento por período · arraste para ordenar."
        action={<Btn icon={Plus} onClick={() => setEditing('new')}>Nova temporada</Btn>} />
      <div style={{ display: 'grid', gap: 10 }}>
        {data.seasons.map((s, idx) => {
          const ativa = s.ativa !== false && parseYMD(s.inicio) <= t && t <= parseYMD(s.fim);
          return (
            <Card key={s.id} {...dnd.zone(idx)} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', ...dnd.deco(idx) }}>
              <DragGrip {...dnd.grip(idx)} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: F.disp, fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {s.nome}
                  {ativa && <span style={{ fontSize: 11.5, fontWeight: 700, color: C.coralDeep, background: '#FBE6DD', padding: '2px 9px', borderRadius: 999, fontFamily: F.sans }}>● Em vigor</span>}
                  {s.ativa === false && <span style={{ fontSize: 11.5, color: C.inkSoft, fontFamily: F.sans }}>(desativada)</span>}
                </div>
                <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>{fmtLong(s.inicio)} – {fmtLong(s.fim)} · mín. {s.minNoites || 1} noite(s){s.maxNoites ? ` · máx. ${s.maxNoites}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{priceRange(s)}</div>
                <div style={{ fontSize: 11.5, color: C.inkSoft }}>diária / apartamento</div>
              </div>
              <button onClick={() => duplicate(s.id)} title="Duplicar" style={iconBtn}><Copy size={16} /></button>
              <button onClick={() => setEditing(s)} title="Editar" style={iconBtn}><Pencil size={16} /></button>
              <button onClick={() => remove(s.id)} title="Eliminar" style={{ ...iconBtn, color: '#B23B3B' }}><Trash2 size={16} /></button>
            </Card>
          );
        })}
      </div>
      {editing && <SeasonForm initial={editing === 'new' ? null : editing} isNew={editing === 'new'} apartamentos={data.apartamentos} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

const PRICE_FIELDS = [['diaSemana', 'Dia da semana'], ['fimSemana', 'Fim de semana'], ['semanal', 'Semanal'], ['mensal', 'Mensal'], ['adultoExtra', 'Adulto extra']];
function SeasonForm({ initial, isNew, apartamentos, onSave, onClose }) {
  const i = initial || {};
  const [nome, setNome] = useState(i.nome || '');
  const [inicio, setInicio] = useState(i.inicio || ymd(today()));
  const [fim, setFim] = useState(i.fim || ymd(addDays(today(), 30)));
  const [minN, setMinN] = useState(i.minNoites ?? 2);
  const [maxN, setMaxN] = useState(i.maxNoites ?? '');
  const [ativa, setAtiva] = useState(i.ativa !== false);
  const defFor = (a) => ({ diaSemana: a.preco, fimSemana: Math.round(a.preco * 1.15), semanal: 0, mensal: 0, adultoExtra: 0 });
  const [precos, setPrecos] = useState(() => {
    const base = {};
    apartamentos.forEach(a => { base[a.id] = { ...defFor(a), ...(i.precos && i.precos[a.id] ? i.precos[a.id] : {}) }; });
    return base;
  });
  const setP = (aid, field, val) => setPrecos(p => ({ ...p, [aid]: { ...p[aid], [field]: val === '' ? '' : Number(val) } }));
  const ok = nome.trim() && parseYMD(fim) >= parseYMD(inicio);

  return (
    <Modal title={isNew ? 'Nova regra sazonal' : `Editar ${i.nome}`} subtitle="Defina o valor de cada apartamento dentro deste período." onClose={onClose} wide
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={!ok} style={{ opacity: ok ? 1 : .5 }}
          onClick={() => onSave({
            id: i.id || ('s' + uid()), nome: nome.trim(), inicio, fim, ativa,
            minNoites: Number(minN) || 1, maxNoites: maxN === '' ? null : Number(maxN),
            precos: Object.fromEntries(apartamentos.map(a => [a.id, {
              diaSemana: Number(precos[a.id]?.diaSemana) || 0, fimSemana: Number(precos[a.id]?.fimSemana) || 0,
              semanal: Number(precos[a.id]?.semanal) || 0, mensal: Number(precos[a.id]?.mensal) || 0, adultoExtra: Number(precos[a.id]?.adultoExtra) || 0,
            }])),
          })}>{isNew ? 'Salvar' : 'Guardar alterações'}</Btn></>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Field label="Nomeie sua temporada" required><TextInput value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Alta 2027-2028" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Início da temporada" required><DateInput value={inicio} onChange={e => setInicio(e.target.value)} /></Field>
          <Field label="Fim da temporada" required><DateInput value={fim} min={inicio} onChange={e => setFim(e.target.value)} /></Field>
          <Field label="Mín. de noites"><NumberInput min={1} value={minN} onChange={e => setMinN(e.target.value)} /></Field>
          <Field label="Máx. de noites" hint="Deixe vazio para sem limite"><NumberInput min={0} value={maxN} onChange={e => setMaxN(e.target.value)} /></Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={ativa} onChange={e => setAtiva(e.target.checked)} /> Temporada ativa (aplicar estes preços)
        </label>

        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
          <div style={secTitle}><Wallet size={16} color={C.brisa} /> Encargos por acomodação</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {apartamentos.map(a => (
              <div key={a.id} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 76, flexShrink: 0 }}><PhotoTile apt={a} h={50} radius={9} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{roomFullName(a)}</div>
                    <div style={{ fontSize: 11.5, color: C.inkSoft }}>Encargos por acomodação · 1 unidade</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 10 }}>
                  {PRICE_FIELDS.map(([key, label]) => (
                    <div key={key}>
                      <div style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 4 }}>{label}</div>
                      <MoneyInput value={precos[a.id]?.[key] ?? ''} onChange={e => setP(a.id, key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: C.inkSoft, margin: '10px 2px 0' }}>A diária usa o valor de <b>dia da semana</b>; nas noites de sexta e sábado usa <b>fim de semana</b> (quando preenchido). Semanal, mensal e adulto extra ficam disponíveis como referência na criação da reserva.</p>
        </div>
      </div>
    </Modal>
  );
}

/* ── Settings ── */
/* ── PoliticasView ── */
const POLITICAS_SEED = {
  reservas: {
    titulo: 'Termos e Políticas de Hospedagem',
    texto: `IMPORTANTE

• Por questões de segurança e privacidade dos demais hóspedes, visitas e convidados só serão permitidos mediante autorização prévia. As dependências do residencial — incluindo áreas internas e apartamentos — são de uso exclusivo dos hóspedes registados.

• Mínimo de 2 (duas) diárias em períodos regulares. Em feriados e datas festivas, o mínimo varia conforme o pacote — consulte nossos canais de atendimento.

• O Residencial oferece apartamentos mobiliados para locação de temporada. Não estão incluídos: café da manhã, roupas de cama/mesa/banho, itens de higiene pessoal nem utensílios de praia.

CHECK-IN: 13h00 | CHECK-OUT: 10h00

---

1. PAGAMENTO

• Para pagamento via cartão de crédito ou Pix/transferência bancária: 50% do valor total antecipado para confirmar a reserva; os 50% restantes + taxas devem ser pagos no check-in.
• Tarifas Promocionais: pagamento de 100% no acto da reserva. Não reembolsável.
• A confirmação da reserva é efectuada somente após a recepção do sinal de 50%.

---

2. HOSPEDAGEM

• Lei do silêncio: das 22h às 7h (excepto Réveillon e Carnaval).
• O acesso aos apartamentos é restrito exclusivamente aos hóspedes registados.
• A chave é retirada no check-in e devolvida no check-out. Perda da chave ou controle de portão: R$ 50,00.
• Danos ou extravios do patrimônio do residencial serão cobrados pelo valor de reposição.
• É proibido pendurar roupas em áreas comuns.

---

3. POLÍTICA DE PETS

• Aceitos cães e gatos com mais de 6 meses e até 10 kg (máximo 2 pets por apartamento).
• Taxa única de R$ 150,00 por pet.
• O proprietário é responsável pela limpeza, silêncio e uso de tapete higiênico dentro do apartamento.

---

4. ESTACIONAMENTO

• Cada apartamento tem direito a 1 vaga de garagem.
• Vaga adicional: taxa única de R$ 50,00 por automóvel (sujeito a disponibilidade).

---

5. LOCAÇÕES DISPONÍVEIS

Jogo de lençol R$ 28,00 · Manta R$ 30,00 · Toalha (banho + rosto) R$ 13,00 · Rede R$ 15,00 · Cooler R$ 25,00 · Cadeira de praia R$ 10,00/dia.`,
  },
  cancelamento: {
    titulo: 'Política de Cancelamento',
    texto: `Solicitações de cancelamento são aceitas exclusivamente por ligação ou WhatsApp: (48) 98476-1800, pelo titular da reserva.

PRAZOS E CONDIÇÕES

• Mais de 31 dias de antecedência do check-in:
  Emissão de Voucher no valor já antecipado, válido para nova reserva.

• Entre 16 e 30 dias de antecedência do check-in:
  Cobrança de 50% do valor total da estadia. Sem reembolso do restante.

• Menos de 15 dias de antecedência do check-in:
  Cobrança de 100% do valor total da estadia. Sem reembolso.

• No-show (não comparecimento sem aviso prévio):
  Cobrança de 100% do valor total da hospedagem. Sem reembolso.

• Cancelamentos ou alterações após o check-in:
  Cobrança de 100% do valor total da hospedagem. Sem reembolso.

• Tarifas Promocionais:
  Não reembolsáveis em nenhuma situação.

NOTA: A contagem de dias é feita em relação à data de check-in, em dias corridos.`,
  },
};

/* PolicyBlock defined outside PoliticasView so React keeps a stable component identity
   across re-renders and the textarea never loses focus on keystroke */
function PolicyBlock({ label, hint, value, onChange, titleValue, onTitleChange }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', minHeight: 200 }}>
        {/* left */}
        <div style={{ background: '#f9fafa', borderRight: `1px solid ${C.line}`, padding: '28px 22px' }}>
          <div style={{ fontFamily: F.disp, fontSize: 16, fontWeight: 600, color: C.ocean, marginBottom: 8 }}>{label}</div>
          {hint && <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.55 }}>{hint}</div>}
        </div>
        {/* right */}
        <div style={{ padding: '24px 26px', display: 'grid', gap: 14 }}>
          <Field label="Título">
            <TextInput
              value={titleValue}
              onChange={e => onTitleChange(e.target.value)}
              placeholder="Ex.: Política de Reservas"
            />
          </Field>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              Conteúdo <span style={{ color: C.brisa, fontSize: 11.5 }}>ⓘ Suportado: texto simples, listas com •, separadores ---</span>
            </div>
            {/* toolbar simulation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: C.espuma, border: `1px solid ${C.line}`, borderBottom: 'none', borderRadius: '8px 8px 0 0' }}>
              {[['B', 'bold', 'font-weight:700'], ['I', 'italic', 'font-style:italic']].map(([lbl]) => (
                <button key={lbl} type="button" title={lbl}
                  style={{ width: 28, height: 26, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 5, cursor: 'pointer', fontWeight: lbl === 'B' ? 700 : 400, fontStyle: lbl === 'I' ? 'italic' : 'normal', fontSize: 13, color: C.ink }}>
                  {lbl}
                </button>
              ))}
              <div style={{ width: 1, height: 20, background: C.line, margin: '0 4px' }} />
              {[['•−', 'Lista bullets'], ['1.', 'Lista numerada']].map(([lbl, title]) => (
                <button key={lbl} type="button" title={title}
                  style={{ height: 26, padding: '0 8px', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 5, cursor: 'pointer', fontSize: 12, color: C.inkSoft }}>
                  {lbl}
                </button>
              ))}
            </div>
            <textarea
              className="pmf"
              value={value}
              onChange={e => onChange(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                minHeight: 320, padding: '14px', fontSize: 13.5, lineHeight: 1.65,
                border: `1px solid ${C.line}`, borderRadius: '0 0 8px 8px',
                fontFamily: F.sans, color: C.ink, background: '#fff',
                resize: 'vertical', outline: 'none',
              }}
              placeholder="Escreva a política aqui..."
            />
            <div style={{ fontSize: 11, color: C.inkSoft, textAlign: 'right', marginTop: 4 }}>{value.length}/8000</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PoliticasView({ data, update }) {
  // Merge saved data on top of seed — so text always appears even when storage has an older version
  const merge = (key) => ({
    titulo: data.settings.politicas?.[key]?.titulo || POLITICAS_SEED[key].titulo,
    texto: data.settings.politicas?.[key]?.texto || POLITICAS_SEED[key].texto,
  });

  const [reservas, setReservas] = useState(() => merge('reservas'));
  const [cancelamento, setCancelamento] = useState(() => merge('cancelamento'));
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    update(prev => ({ ...prev, settings: { ...prev.settings, politicas: { reservas, cancelamento } } }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  };

  return (
    <div>
      <PageHead
        title="Políticas"
        sub="Defina os termos que os hóspedes aceitam ao fazer uma reserva."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" onClick={() => {
              setReservas(saved0.reservas || defaultPoliticas.reservas);
              setCancelamento(saved0.cancelamento || defaultPoliticas.cancelamento);
              setSaved(false);
            }}>Cancelar</Btn>
            <Btn variant="primary" icon={saved ? Check : undefined} onClick={onSave}>
              {saved ? 'Guardado ✓' : 'Salvar'}
            </Btn>
          </div>
        }
      />

      <PolicyBlock
        label="Política de Reservas"
        hint="Será solicitado que seus hóspedes aceitem estes termos no checkout."
        titleValue={reservas.titulo}
        onTitleChange={v => { setReservas(p => ({ ...p, titulo: v })); setSaved(false); }}
        value={reservas.texto}
        onChange={v => { setReservas(p => ({ ...p, texto: v })); setSaved(false); }}
      />

      <PolicyBlock
        label="Política de Cancelamento"
        hint="Apresentada ao hóspede durante a reserva e no e-mail de confirmação."
        titleValue={cancelamento.titulo}
        onTitleChange={v => { setCancelamento(p => ({ ...p, titulo: v })); setSaved(false); }}
        value={cancelamento.texto}
        onChange={v => { setCancelamento(p => ({ ...p, texto: v })); setSaved(false); }}
      />

      {/* Preview card */}
      <Card style={{ padding: 22, marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: 0 }}>Pré-visualização</h3>
          <span style={{ fontSize: 12.5, color: C.inkSoft }}>Como ficará visível para o hóspede no site</span>
        </div>
        {[
          { pol: reservas, accent: C.ocean },
          { pol: cancelamento, accent: C.coralDeep },
        ].map(({ pol, accent }) => (
          <div key={pol.titulo} style={{ marginBottom: 22, padding: '18px 20px', background: C.espuma, borderRadius: 12, border: `1px solid ${C.line}` }}>
            <div style={{ fontFamily: F.disp, fontSize: 17, color: accent, marginBottom: 12 }}>{pol.titulo}</div>
            <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.72, whiteSpace: 'pre-wrap' }}>
              {pol.texto.split('\n').map((line, idx) => {
                if (line.trim().startsWith('•') || line.trim().startsWith('*') || line.trim().startsWith('-')) {
                  return <div key={idx} style={{ paddingLeft: 14, position: 'relative' }}><span style={{ position: 'absolute', left: 0 }}>•</span>{line.replace(/^[\s•*\-→]+/, '')}</div>;
                }
                if (line.trim() === '---') return <hr key={idx} style={{ border: 'none', borderTop: `1px solid ${C.line}`, margin: '10px 0' }} />;
                if (!line.trim()) return <div key={idx} style={{ height: 8 }} />;
                return <div key={idx}>{line}</div>;
              })}
            </div>
          </div>
        ))}
      </Card>

      {/* reminder */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px', background: '#EEF6FF', border: '1px solid #BDD9F8', borderRadius: 12, marginTop: 16, fontSize: 13.5, color: '#1A4A7A' }}>
        <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>As políticas são apresentadas ao hóspede na página de reserva do site e podem ser incluídas no e-mail de confirmação. Clique em <b>Salvar</b> para que as alterações entrem em vigor.</span>
      </div>
    </div>
  );
}

function SettingsView({ data, update }) {
  const [s, setS] = useState(data.settings);
  const [saved, setSaved] = useState(false);
  const set = (k, v) => { setS(p => ({ ...p, [k]: v })); setSaved(false); };
  const onSave = () => { update(prev => ({ ...prev, settings: s })); setSaved(true); };
  return (
    <div>
      <PageHead title="Configurações gerais" sub="Dados do residencial usados no site e nas reservas"
        action={<Btn variant="primary" icon={saved ? Check : undefined} onClick={onSave}>{saved ? 'Guardado' : 'Guardar'}</Btn>} />
      <Card style={{ padding: 22, marginBottom: 16 }}>
        <h3 style={{ fontFamily: F.disp, fontSize: 19, margin: '0 0 16px' }}>Informações de negócio</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Nome da propriedade" required><TextInput value={s.nome} onChange={e => set('nome', e.target.value)} /></Field>
          <Field label="Tipo"><Select value={s.tipo} onChange={e => set('tipo', e.target.value)}>{['Apartamento', 'Pousada', 'Hotel', 'Casa'].map(o => <option key={o}>{o}</option>)}</Select></Field>
          <Field label="Email de contacto" required><TextInput value={s.email} onChange={e => set('email', e.target.value)} /></Field>
          <Field label="Telefone" required><TextInput value={s.telefone} onChange={e => set('telefone', e.target.value)} /></Field>
        </div>
      </Card>
      <Card style={{ padding: 22, marginBottom: 16 }}>
        <h3 style={{ fontFamily: F.disp, fontSize: 19, margin: '0 0 16px' }}>Endereço</h3>
        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="Cidade, Estado, País"><TextInput value={s.cidade} onChange={e => set('cidade', e.target.value)} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <Field label="Endereço"><TextInput value={s.endereco} onChange={e => set('endereco', e.target.value)} /></Field>
            <Field label="Código postal (CEP)"><TextInput value={s.cep} onChange={e => set('cep', e.target.value)} /></Field>
          </div>
        </div>
      </Card>
      <Card style={{ padding: 22 }}>
        <h3 style={{ fontFamily: F.disp, fontSize: 19, margin: '0 0 16px' }}>Configurações regionais e reservas</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Fuso horário"><TextInput value={s.fuso} onChange={e => set('fuso', e.target.value)} /></Field>
          <Field label="Moeda"><Select value={s.moeda} onChange={e => set('moeda', e.target.value)}>{['Real Brasileiro (R$)', 'Euro (€)', 'Dólar (US$)'].map(o => <option key={o}>{o}</option>)}</Select></Field>
          <Field label="Hora de check-in" hint="Entrada a partir desta hora."><TextInput value={s.checkInHora} onChange={e => set('checkInHora', e.target.value)} /></Field>
          <Field label="Hora de check-out" hint="Saída até esta hora — permite turnover no mesmo dia."><TextInput value={s.checkOutHora} onChange={e => set('checkOutHora', e.target.value)} /></Field>
          <Field label="Sinal exigido (% do total)"><NumberInput min={0} max={100} value={s.sinalPct} onChange={e => set('sinalPct', Number(e.target.value))} /></Field>
        </div>
      </Card>
    </div>
  );
}

/* ── Payments ── */
function PaymentsView({ data, update }) {
  const toggle = (id) => update(prev => ({ ...prev, pagamentos: prev.pagamentos.map(p => p.id === id ? { ...p, conectado: !p.conectado } : p) }));
  const remove = (id) => update(prev => ({ ...prev, pagamentos: prev.pagamentos.filter(p => p.id !== id) }));
  const duplicate = (id) => update(prev => ({ ...prev, pagamentos: duplicateInList(prev.pagamentos, id, p => ({ ...p, id: 'pay' + uid(), nome: p.nome + ' (cópia)', conectado: false })) }));
  const dnd = useReorder(data.pagamentos, (arr) => update(prev => ({ ...prev, pagamentos: arr })));

  const RECOMENDADO = ['mercadopago', 'pix'];

  return (
    <div>
      <PageHead title="Pagamentos" sub="Configure como os hóspedes pagam o sinal e o saldo da reserva · arraste para reordenar." />

      {/* recommendation banner */}
      <div style={{ background: 'linear-gradient(135deg,#E8F4FD,#EEF6FF)', border: '1px solid #BDD9F8', borderRadius: 14, padding: '16px 20px', marginBottom: 22, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1A56DB', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Star size={18} color="#fff" fill="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1A3A6B', marginBottom: 4 }}>Recomendação para o PinheiraMar</div>
          <div style={{ fontSize: 13.5, color: '#1e3a5f', lineHeight: 1.6 }}>
            <b>Mercado Pago + Pix</b> é a combinação mais vantajosa para aluguel de temporada no Brasil. O Pix cobre o sinal de 50% (taxa zero, confirmação imediata) e o Mercado Pago oferece parcelamento em até 12x sem juros para o hóspede — aumentando a conversão em alta temporada. O saldo de 50% no check-in fica com <b>Pagamento presencial</b> (maquininha ou Pix directo).
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {data.pagamentos.map((p, idx) => (
          <Card key={p.id} {...dnd.zone(idx)} style={{ padding: '16px 18px', ...dnd.deco(idx) }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <DragGrip {...dnd.grip(idx)} style={{ marginTop: 4 }} />

              {/* colour badge */}
              <div style={{ width: 44, height: 44, borderRadius: 11, background: p.cor, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '-.02em' }}>{p.nome.slice(0, 2).toUpperCase()}</span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>{p.nome}</span>
                  {RECOMENDADO.includes(p.id) && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#FFF3CD', color: '#7B5600', border: '1px solid #F5C542', borderRadius: 999, padding: '2px 8px' }}>★ Recomendado</span>
                  )}
                  {p.conectado && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7', borderRadius: 999, padding: '2px 8px' }}>● Activo</span>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: p.cor, marginBottom: 6 }}>{p.taxa}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '3px 16px' }}>
                  {p.desc.map((d, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: C.inkSoft, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                      <span style={{ color: C.brisa, flexShrink: 0, marginTop: 1 }}>✓</span> {d}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                <Btn variant={p.conectado ? 'accent' : 'soft'} size="sm" icon={p.conectado ? Check : undefined} onClick={() => toggle(p.id)}>
                  {p.conectado ? 'Activo' : 'Activar'}
                </Btn>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: C.brisa, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Abrir site ↗
                  </a>
                )}
                <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                  <button onClick={() => duplicate(p.id)} title="Duplicar" style={iconBtn}><Copy size={14} /></button>
                  <button onClick={() => remove(p.id)} title="Eliminar" style={{ ...iconBtn, color: '#B23B3B' }}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* integration guide */}
      <Card style={{ padding: 22, marginTop: 18 }}>
        <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={17} color={C.brisa} /> Guia de integração
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {[
            { step: '1', title: 'Crie uma conta Business', desc: 'Abra uma conta no Mercado Pago em mercadopago.com.br. Use CNPJ para ter acesso à API completa e melhores taxas.', cor: C.brisa },
            { step: '2', title: 'Obtenha o Access Token', desc: 'Em "Credenciais" no painel Mercado Pago, copie o Access Token de produção. Este código liga o motor de reservas à sua conta.', cor: C.ocean },
            { step: '3', title: 'Configure o webhook', desc: 'Registe o URL do seu servidor para receber confirmações automáticas de pagamento e actualizar o estado da reserva em tempo real.', cor: C.coral },
            { step: '4', title: 'Fluxo no motor de reservas', desc: 'Reserva criada → Mercado Pago gera link de pagamento (50%) → Hóspede paga → Webhook confirma → Reserva muda para "Confirmada".', cor: '#7C3AED' },
          ].map(s => (
            <div key={s.step} style={{ padding: '14px 16px', background: C.espuma, borderRadius: 12, borderLeft: `4px solid ${s.cor}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: s.cor, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{s.step}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{s.title}</div>
              </div>
              <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '12px 14px', background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 10, fontSize: 13, color: '#7B5600', lineHeight: 1.55 }}>
          <b>Nota:</b> A integração automática de pagamentos requer um servidor backend (Node.js / PHP) com acesso à internet para receber os webhooks do gateway. O motor actual funciona em modo offline — para produção em <b>pinheiramar.com.br</b> será necessário configurar o servidor e as credenciais da API.
        </div>
      </Card>

      {/* pricing summary */}
      <Card style={{ padding: 20, marginTop: 14 }}>
        <h3 style={{ fontFamily: F.disp, fontSize: 17, margin: '0 0 12px' }}>Configuração de sinal</h3>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 14 }}>
          <div><div style={{ color: C.inkSoft, fontSize: 12.5 }}>Moeda</div><div style={{ fontWeight: 700, fontSize: 16 }}>{data.settings.moeda}</div></div>
          <div><div style={{ color: C.inkSoft, fontSize: 12.5 }}>Sinal antecipado</div><div style={{ fontWeight: 700, fontSize: 16, color: C.coralDeep }}>{data.settings.sinalPct}% do total</div></div>
          <div><div style={{ color: C.inkSoft, fontSize: 12.5 }}>Saldo restante</div><div style={{ fontWeight: 700, fontSize: 16 }}>{100 - data.settings.sinalPct}% no check-in</div></div>
          <div><div style={{ color: C.inkSoft, fontSize: 12.5 }}>Gateways activos</div><div style={{ fontWeight: 700, fontSize: 16 }}>{data.pagamentos.filter(p => p.conectado).length} de {data.pagamentos.length}</div></div>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 12.5, color: C.inkSoft }}>Altere a percentagem do sinal em <b>Configurações → Sinal exigido</b>.</p>
      </Card>
    </div>
  );
}

/* ═══════════════════════════ APP SHELL ═══════════════════════════ */
/* ───────────────────────── Auth gate ───────────────────────── */
const ADMIN_PIN = '1234'; // altere aqui o PIN de acesso ao painel

function LoginScreen({ onLogin }) {
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
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.coral, display: 'grid', placeItems: 'center', marginBottom: 14 }}>
            <Waves size={28} color="#fff" />
          </div>
          <div style={{ fontFamily: F.disp, fontSize: 22, fontWeight: 600, color: C.ink }}>PinheiraMar</div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2, letterSpacing: '.06em', textTransform: 'uppercase' }}>Painel de Gestão</div>
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
