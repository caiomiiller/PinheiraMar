import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { C, F } from '../lib/constants';
import { ymd, parseYMD, addDays, isAvailable } from '../lib/helpers';
import { hojeISO } from '../lib/reservas';
import { useIdioma } from '../lib/i18n';

// Cor de fundo de cada dia antes de qualquer seleção: verde-claro disponível,
// vermelho-claro ocupado (a mesma linguagem do painel).
const DIA_DISPONIVEL = '#E1F0EC';
const DIA_INDISPONIVEL = '#F3E3E3';

function buildMonthCells(year, month) {
  const startWeekday = new Date(year, month, 1).getDay(); // 0 = domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

const navBtnStyle = {
  width: 40, height: 40, borderRadius: '50%', border: `1px solid ${C.line}`, background: '#fff',
  color: C.ink, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
};

// Calendário de disponibilidade — dois meses lado a lado (empilham no telemóvel).
// Um dia fica ocupado apenas se pertencer à NOITE de uma reserva (checkIn <=
// dia < checkOut): o dia de saída de uma reserva aparece livre para a próxima
// entrar (sai às 10h, entra às 13h).
// `ate` = última noite que se pode reservar (fim da última temporada
// cadastrada) — depois disso não há preço definido e o site não aceita datas.
// "Hoje" é o de Brasília (o mesmo que o servidor usa para validar).
export function AvailabilityCalendar({ apt, reservas, ci, co, onChange, initialMonth, ate }) {
  const { tr, fmtCurta, nomeMes, diasSemana } = useIdioma();
  const hoje = hojeISO();
  const td = parseYMD(hoje);
  const base = initialMonth ? parseYMD(initialMonth) : (ci ? parseYMD(ci) : td);
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  const [hoverDay, setHoverDay] = useState(null);

  const selCi = ci ? parseYMD(ci) : null;
  const selCo = co ? parseYMD(co) : null;
  const escolhendoSaida = !!(selCi && !selCo);

  const isBlockedNight = (d) => (apt ? !isAvailable(reservas || [], apt.id, ymd(d), ymd(addDays(d, 1))) : false);
  const isPast = (d) => ymd(d) < hoje;
  // para a entrada, a própria noite tem de estar dentro do limite; para a
  // saída, basta a noite anterior estar
  const foraDoLimite = (d) => !!ate && (escolhendoSaida ? ymd(addDays(d, -1)) > ate : ymd(d) > ate);

  const pendingEnd = (escolhendoSaida && hoverDay && hoverDay > selCi) ? hoverDay : null;
  const rangeEnd = selCo || pendingEnd;
  const inRange = (d) => selCi && rangeEnd && d > selCi && d < rangeEnd;

  const hasBlockedBetween = (from, to) => {
    for (let c = from; c < to; c = addDays(c, 1)) if (isBlockedNight(c)) return true;
    return false;
  };

  const handleClick = (d) => {
    if (isPast(d) || foraDoLimite(d)) return;
    if (!selCi || selCo) { onChange(ymd(d), ''); return; }
    if (ymd(d) <= ymd(selCi)) { onChange(ymd(d), ''); return; }
    if (hasBlockedBetween(selCi, d)) { onChange(ymd(d), ''); return; }
    onChange(ymd(selCi), ymd(d));
  };

  const goPrev = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const goNext = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };
  const idx = (y, m) => y * 12 + m;
  const noPrimeiroMes = idx(viewYear, viewMonth) <= idx(td.getFullYear(), td.getMonth());
  const limite = ate ? addDays(parseYMD(ate), 1) : null; // último dia possível de saída
  const noUltimoMes = !!limite && idx(viewYear, viewMonth) + 1 >= idx(limite.getFullYear(), limite.getMonth());

  const monthsToShow = [
    { y: viewYear, m: viewMonth },
    { y: viewMonth === 11 ? viewYear + 1 : viewYear, m: viewMonth === 11 ? 0 : viewMonth + 1 },
  ];
  const semana = diasSemana();

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 14px 16px', background: '#fff', fontFamily: F.sans }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={goPrev} disabled={noPrimeiroMes} style={{ ...navBtnStyle, opacity: noPrimeiroMes ? .35 : 1 }} aria-label={tr('cal_mes_anterior')}><ChevronLeft size={18} /></button>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, textAlign: 'center' }} aria-live="polite">
          {escolhendoSaida ? tr('cal_escolha_saida') : (!selCi ? tr('cal_escolha_entrada') : `${fmtCurta(ymd(selCi))} → ${fmtCurta(ymd(rangeEnd))}`)}
        </div>
        <button type="button" onClick={goNext} disabled={noUltimoMes} style={{ ...navBtnStyle, opacity: noUltimoMes ? .35 : 1 }} aria-label={tr('cal_proximo_mes')}><ChevronRight size={18} /></button>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {monthsToShow.map(({ y, m }) => (
          <div key={`${y}-${m}`} style={{ flex: '1 1 230px', minWidth: 230 }}>
            <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 6, textTransform: 'capitalize' }}>{nomeMes(y, m)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 2 }}>
              {semana.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: 12.5, color: C.inkSoft, fontWeight: 700, textTransform: 'capitalize' }}>{w}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {buildMonthCells(y, m).map((d, i) => {
                if (!d) return <div key={i} />;
                const past = isPast(d);
                const fechado = !past && foraDoLimite(d);
                const blocked = !past && !fechado && isBlockedNight(d);
                const disabled = past || blocked || fechado;
                const isStart = selCi && ymd(d) === ymd(selCi);
                const isEnd = rangeEnd && ymd(d) === ymd(rangeEnd);
                const within = inRange(d);
                const baseBg = (past || fechado) ? 'transparent' : (blocked ? DIA_INDISPONIVEL : DIA_DISPONIVEL);
                const rotulo = `${fmtCurta(ymd(d))}${blocked ? ` — ${tr('cal_ocupado')}` : fechado ? ` — ${tr('cal_fechado')}` : ''}`;
                return (
                  <button type="button" key={i}
                    disabled={disabled && !isStart && !isEnd}
                    onMouseEnter={() => setHoverDay(d)}
                    onClick={() => handleClick(d)}
                    aria-label={rotulo} aria-pressed={!!(isStart || isEnd)}
                    title={blocked ? tr('cal_ocupado') : fechado ? tr('cal_fechado') : undefined}
                    style={{
                      aspectRatio: '1', minHeight: 44, border: 'none', borderRadius: '50%', padding: 0,
                      fontSize: 14, cursor: disabled ? 'default' : 'pointer', fontFamily: F.sans,
                      background: (isStart || isEnd) ? C.ocean : (within ? C.espuma : baseBg),
                      color: (isStart || isEnd) ? '#fff' : (disabled ? '#8E9895' : C.ink),
                      textDecoration: blocked ? 'line-through' : 'none',
                      fontWeight: (isStart || isEnd) ? 700 : 500,
                    }}>{d.getDate()}</button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {noUltimoMes && ate && <div style={{ marginTop: 10, fontSize: 14, color: C.inkSoft }}>{tr('cal_abertas_ate', fmtCurta(ate))}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
        <button type="button" onClick={() => onChange('', '')} style={{ background: 'none', border: 'none', textDecoration: 'underline', fontSize: 14.5, color: C.ink, cursor: 'pointer', minHeight: 40, padding: 0 }}>
          {tr('cal_desmarcar')}
        </button>
        {apt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13.5, color: C.inkSoft }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: DIA_DISPONIVEL, border: `1px solid ${C.line}`, display: 'inline-block' }} /> {tr('cal_legenda_livre')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: DIA_INDISPONIVEL, border: `1px solid ${C.line}`, display: 'inline-block' }} /> {tr('cal_legenda_ocupado')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
