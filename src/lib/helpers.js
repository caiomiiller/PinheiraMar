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
// Tarifas rápidas (QuickRateModal, em Reservations.jsx) ficam marcadas
// `rapida: true` — são um ajuste pontual de preço para um apartamento e
// período específicos, não uma temporada real. `isTarifaRapida` é a mesma
// checagem usada em Seasons.jsx para escondê-las de "Opções de preços por
// temporada"; o teste pelo nome cobre as tarifas rápidas já existentes,
// criadas antes de a marcação existir.
export const isTarifaRapida = (s) => s?.rapida === true || (typeof s?.nome === 'string' && s.nome.startsWith('Tarifa rápida — '));
// `includeRapida: true` inclui as tarifas rápidas na busca — necessário
// para o cálculo de preço (nightlyRate/stayBreakdown abaixo), que é
// exatamente para o que elas existem. Qualquer outro uso (ex.: "qual é a
// temporada atual" no Painel) quer a temporada real, então o padrão é
// excluí-las — sem isso, uma tarifa rápida entra na frente da lista e
// "ganha" de uma temporada de verdade para as mesmas datas.
export function seasonForDate(seasons, dObj, { includeRapida = false } = {}) {
  const t = dObj.getTime();
  const list = includeRapida ? seasons : seasons.filter(s => !isTarifaRapida(s));
  return list.find(s => s.ativa !== false && parseYMD(s.inicio).getTime() <= t && t <= parseYMD(s.fim).getTime()) || null;
}
export const aptRates = (season, aptId) => (season && season.precos && season.precos[aptId]) || null;
// Hóspedes incluídos na tarifa base do apartamento antes de cobrar qualquer
// extra por pessoa (ver `guests` abaixo) — 4 por defeito, mas configurável
// por apartamento (Apartments.jsx) para o caso de algum precisar de outro valor.
export const capacidadeBaseOf = (apt) => Number(apt?.capacidadeBase) || 4;
export function nightlyRate(apt, seasons, dObj, guests) {
  const season = seasonForDate(seasons, dObj, { includeRapida: true });
  const p = aptRates(season, apt.id);
  let rate;
  if (p) {
    const r = isWeekendNight(dObj) ? (Number(p.fimSemana) || Number(p.diaSemana) || 0) : (Number(p.diaSemana) || 0);
    rate = r > 0 ? Math.round(r) : Math.round(apt.preco || 0);
  } else {
    rate = Math.round(apt.preco || 0); // tarifa base do apartamento (fallback)
  }
  // Hóspede extra: só quando `guests` é indicado (reservas concretas — não a
  // pré-visualização genérica do calendário, que não sabe para quantas
  // pessoas é) soma o "Adulto extra" da temporada (Opções de preços) por
  // cada hóspede acima da ocupação base do apartamento, respeitando sempre
  // o limite máximo do próprio apartamento — a pedido do Caio, 2026-09-17.
  if (guests) {
    const extra = p ? (Number(p.adultoExtra) || 0) : 0;
    const limite = Math.min(Number(guests) || 0, Number(apt.capacidade) || Infinity);
    const hospedesExtra = Math.max(0, limite - capacidadeBaseOf(apt));
    rate += hospedesExtra * extra;
  }
  return rate;
}
export function stayBreakdown(apt, seasons, ci, co, guests) {
  const n = nights(ci, co);
  let total = 0; const perNight = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(parseYMD(ci), i);
    const s = seasonForDate(seasons, d, { includeRapida: true });
    const rate = nightlyRate(apt, seasons, d, guests);
    total += rate;
    perNight.push({ date: ymd(d), rate, season: s ? s.nome : 'Tarifa base', weekend: isWeekendNight(d) });
  }
  return { total, n, perNight };
}
// Intervalo meia-aberto [check-in, check-out): o dia de check-out (saída até às 10h)
// pode coincidir com o dia de check-in de outra reserva (entrada a partir das 13h),
// permitindo terminar e iniciar reservas no mesmo dia sem conflito.
export const overlaps = (aCi, aCo, bCi, bCo) => parseYMD(aCi) < parseYMD(bCo) && parseYMD(aCo) > parseYMD(bCi);

/* ── Reservas provisórias (à espera do pagamento) ──────────────────────────
   Uma reserva feita pelo site nasce provisória: segura as datas enquanto o
   hóspede paga o sinal no Mercado Pago, e larga-as sozinha se o pagamento
   falhar ou se ele desistir a meio do checkout. Sem este prazo, qualquer
   pagamento recusado ou separador fechado deixava as datas presas para
   sempre — e o pagamento recusado nem sequer dá sinal nenhum de volta.

   Segurar as datas durante o checkout é de propósito: sem isso, dois
   hóspedes podiam pagar o mesmo apartamento para as mesmas noites ao mesmo
   tempo, o que é bem pior do que umas datas presas por meia hora.

   `expiraEm` só existe em reservas nascidas do site com pagamento a
   caminho: as criadas no painel (telefone/WhatsApp) nunca o têm, e editar
   uma reserva no painel também o descarta — o formulário reconstrói o
   objeto — o que a promove a reserva normal, sem prazo. */
/* Dois prazos, e é a relação entre eles que evita conflitos — não o valor de
   nenhum deles isoladamente:

   JANELA: quanto tempo o link de pagamento do Mercado Pago aceita pagamento.
   É imposto no próprio Mercado Pago (`expires`/`expiration_date_to` em
   api/mp-create-preference.js), não só do nosso lado — passado esse tempo,
   ele deixa de aceitar, e um pagamento feito à mesma é devolvido ao pagador.

   HOLD: quanto tempo a reserva provisória segura as datas.

   O HOLD é maior do que a JANELA de propósito. Era este o buraco real: antes,
   o link não expirava nunca, por isso um pagamento podia ser aprovado horas
   depois de as datas terem sido libertadas e já estarem com outra pessoa —
   e nenhum valor de prazo resolvia isso sozinho. Com a janela fechada no
   Mercado Pago, um pagamento só pode ser aprovado dentro dela, e os 10
   minutos a mais do HOLD cobrem a folga até o aviso do webhook chegar.

   Fica a detecção de conflito no webhook como última rede (ver
   `datasEmConflito`), mas passa a ser um caso que não devia acontecer, em vez
   de a única proteção.

   O preço disto é a indisponibilidade provisória ser mais longa do que os 5
   minutos que o Caio tinha proposto — decisão dele, depois de ver o risco:
   não haver conflito vale mais do que libertar as datas depressa. */
export const MIN_JANELA_PAGAMENTO = 20;
export const MIN_HOLD_PAGAMENTO = 30;
export const novoPrazoPagamento = (min = MIN_HOLD_PAGAMENTO) => new Date(Date.now() + min * 60000).toISOString();

// Uma reserva provisória cujo prazo passou nunca chegou a ser uma reserva:
// não bloqueia datas nem entra nas contas do Financeiro. Data inválida ou
// ausente conta como "não expirada", para nunca libertar datas por engano.
export const holdExpirado = (r, agora = Date.now()) =>
  r.status === 'pendente' && !!r.expiraEm && Date.parse(r.expiraEm) <= agora;

export function isAvailable(reservations, aptId, ci, co, ignoreId) {
  const agora = Date.now();
  return !reservations.some(r =>
    r.apartamentoId === aptId && r.status !== 'cancelada' && !holdExpirado(r, agora)
    && r.id !== ignoreId && overlaps(ci, co, r.checkIn, r.checkOut));
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

