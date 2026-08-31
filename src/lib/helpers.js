// Helpers de data, dinheiro, disponibilidade e feriados
export const MS = 86400000;
export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYMD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const nights = (ci, co) => Math.round((parseYMD(co) - parseYMD(ci)) / MS);
export const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
export const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const fmtShort = (s) => parseYMD(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
export const fmtLong = (s) => parseYMD(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (v) => brl.format(v || 0);
export const uid = () => Math.random().toString(36).slice(2, 9);
export const code = () => 'PM-' + Math.random().toString(36).slice(2, 6).toUpperCase();

export const isWeekendNight = (d) => { const g = d.getDay(); return g === 5 || g === 6; }; // noites de sexta e sábado
export function seasonForDate(seasons, dObj) {
  const t = dObj.getTime();
  return seasons.find(s => s.ativa !== false && parseYMD(s.inicio).getTime() <= t && t <= parseYMD(s.fim).getTime()) || null;
}
export const aptRates = (season, aptId) => (season && season.precos && season.precos[aptId]) || null;
export function nightlyRate(apt, seasons, dObj) {
  const p = aptRates(seasonForDate(seasons, dObj), apt.id);
  if (p) {
    const r = isWeekendNight(dObj) ? (Number(p.fimSemana) || Number(p.diaSemana) || 0) : (Number(p.diaSemana) || 0);
    if (r > 0) return Math.round(r);
  }
  return Math.round(apt.preco || 0); // tarifa base do apartamento (fallback)
}
export function stayBreakdown(apt, seasons, ci, co) {
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
export const overlaps = (aCi, aCo, bCi, bCo) => parseYMD(aCi) < parseYMD(bCo) && parseYMD(aCo) > parseYMD(bCi);
export function isAvailable(reservations, aptId, ci, co, ignoreId) {
  return !reservations.some(r =>
    r.apartamentoId === aptId && r.status !== 'cancelada' && r.id !== ignoreId && overlaps(ci, co, r.checkIn, r.checkOut));
}

/* ───────────────────────── Feriados (nacionais + SC + RS) ───────────────────────── */
// Páscoa pelo algoritmo de Computus (Meeus/Jones/Butcher) — base dos feriados móveis.
export function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
export const _holCache = {};
export function holidaysForYear(year) {
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
export const holidaysOn = (dObj) => holidaysForYear(dObj.getFullYear())[ymd(dObj)] || null;
export const HOLIDAY_COLORS = { Nacional: '#3E7CB1', SC: '#1C7A5B', RS: '#B26A2E' };
export const HOLIDAY_LABELS = { Nacional: 'Nacional', SC: 'Santa Catarina', RS: 'Rio Grande do Sul' };

/* ───────────────────────── Apartamentos · serviços · países ───────────────────────── */
export const vistaLabel = (v) => {
  if (v === 'Frente Mar') return 'Frente Mar';
  if (v === 'Beira-mar') return 'à beira mar';
  return v || '';
};
// Nome completo do tipo no formato usado na base de dados (ex.: "Apto 102 - Térreo Frente Mar, 4 pessoas")
export const roomFullName = (apt) => apt.tipo || `${apt.nome} - ${apt.piso} ${vistaLabel(apt.vista)}, ${apt.capacidade} pessoas`;

