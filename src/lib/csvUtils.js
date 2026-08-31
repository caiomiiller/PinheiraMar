import { C } from './constants';
import { uid, code, nights, today, ymd, MS } from './helpers';

/* ───────────────────────── Apartamentos · serviços · países ───────────────────────── */
export const vistaLabel = (v) => {
  if (v === 'Frente Mar') return 'Frente Mar';
  if (v === 'Beira-mar') return 'à beira mar';
  return v || '';
};
// Nome completo do tipo no formato usado na base de dados (ex.: "Apto 102 - Térreo Frente Mar, 4 pessoas")
export const roomFullName = (apt) => apt.tipo || `${apt.nome} - ${apt.piso} ${vistaLabel(apt.vista)}, ${apt.capacidade} pessoas`;

export const EXTRA_PRESETS = [
  { nome: 'Vaga de Estacionamento p/ 1 Automóvel', preco: 50 },
  { nome: 'Higienização e Serviços de Hospedagem', preco: 175 },
  { nome: 'Taxa de limpeza', preco: 120 },
  { nome: 'Roupa de cama / banho extra', preco: 60 },
  { nome: 'Desconto de negociação', preco: -100 },
];

/* Gera os extras obrigatórios a incluir em cada nova reserva não-bloqueio */
export const mkExtrasObrigatorios = (taxasAdicionais = []) =>
  taxasAdicionais
    .filter(tx => tx.tipo === 'obrigatoria')
    .map(tx => ({ id: uid(), nome: tx.nome, qtd: 1, preco: tx.preco }));

export const PAISES = ['Brasil', 'Argentina', 'Uruguai', 'Paraguai', 'Chile', 'Portugal', 'Estados Unidos', 'Outro'];

/* ───────────────────────── Base de dados · exportar / importar ───────────────────────── */
export const CSV_COLS = ['Reservation No', 'Guest First Name', 'Guest Last Name', 'Email', 'Country',
  'Check-In date', 'Check-Out date', 'Room', 'Unit No', 'Subtotal', 'Revenue', 'Currency', 'Create Date'];

export function reservaToRow(r, apartamentos) {
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
export const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export function buildCSV(reservas, apartamentos) {
  const lines = [CSV_COLS.join(',')];
  reservas.forEach(r => { const row = reservaToRow(r, apartamentos); lines.push(CSV_COLS.map(c => csvCell(row[c])).join(',')); });
  return '\uFEFF' + lines.join('\r\n'); // BOM p/ acentos no Excel
}
export function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
// Aceita datas em ISO (YYYY-MM-DD), número de série do Excel ou texto reconhecível.
export const serialToYMD = (serial) => {
  const d = new Date(Math.floor(serial) * MS + Date.UTC(1899, 11, 30));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};
export function parseAnyDate(v) {
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
export function rowToReserva(row, apartamentos) {
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
