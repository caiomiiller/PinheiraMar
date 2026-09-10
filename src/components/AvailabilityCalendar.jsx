import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { C, F } from '../lib/constants';
import { ymd, parseYMD, addDays, today, isAvailable, fmtShort, WD } from '../lib/helpers';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function buildMonthCells(year, month) {
  const startWeekday = new Date(year, month, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

const navBtnStyle = {
  width: 28, height: 28, borderRadius: '50%', border: `1px solid ${C.line}`, background: '#fff',
  color: C.ink, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
};

// Calendário de disponibilidade — dois meses lado a lado (empilham no telemóvel).
// Um dia fica indisponível (riscado) apenas se pertencer à noite de uma reserva
// existente, isto é, checkIn <= dia < checkOut: por isso o dia de saída de uma
// reserva aparece sempre disponível, mesmo que no mesmo dia entre outra reserva
// (ex.: sai às 10h, entra às 13h) — o intervalo é meia-aberto, à semelhança do
// resto da aplicação (ver isAvailable em lib/helpers.js).
export function AvailabilityCalendar({ apt, reservas, ci, co, onChange }) {
  // apt/reservas são opcionais: sem um apartamento concreto (ex.: pesquisa
  // inicial, antes de escolher unidade) o calendário não bloqueia nenhum dia.
  const td = today();
  const base = ci ? parseYMD(ci) : td;
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  const [hoverDay, setHoverDay] = useState(null);

  const selCi = ci ? parseYMD(ci) : null;
  const selCo = co ? parseYMD(co) : null;

  const isBlockedNight = (d) => apt ? !isAvailable(reservas, apt.id, ymd(d), ymd(addDays(d, 1))) : false;
  const isPast = (d) => d < td;

  const pendingEnd = (selCi && !selCo && hoverDay && hoverDay > selCi) ? hoverDay : null;
  const rangeEnd = selCo || pendingEnd;
  const inRange = (d) => selCi && rangeEnd && d > selCi && d < rangeEnd;

  const hasBlockedBetween = (from, to) => {
    let cursor = from;
    while (cursor < to) {
      if (isBlockedNight(cursor)) return true;
      cursor = addDays(cursor, 1);
    }
    return false;
  };

  const handleClick = (d) => {
    if (isPast(d)) return;
    if (!selCi || selCo) { onChange(ymd(d), ''); return; }
    if (ymd(d) <= ymd(selCi)) { onChange(ymd(d), ''); return; }
    if (hasBlockedBetween(selCi, d)) { onChange(ymd(d), ''); return; }
    onChange(ymd(selCi), ymd(d));
  };

  const goPrev = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const goNext = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  const monthsToShow = [
    { y: viewYear, m: viewMonth },
    { y: viewMonth === 11 ? viewYear + 1 : viewYear, m: viewMonth === 11 ? 0 : viewMonth + 1 },
  ];

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 14px 16px', background: '#fff', fontFamily: F.sans }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={goPrev} style={navBtnStyle} aria-label="Mês anterior"><ChevronLeft size={15} /></button>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>
          {selCi && !selCo ? 'Escolha a data de saída' : (!selCi ? 'Escolha a data de entrada' : `${fmtShort(ymd(selCi))} → ${fmtShort(ymd(rangeEnd))}`)}
        </div>
        <button onClick={goNext} style={navBtnStyle} aria-label="Próximo mês"><ChevronRight size={15} /></button>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {monthsToShow.map(({ y, m }) => (
          <div key={`${y}-${m}`} style={{ flex: '1 1 210px', minWidth: 210 }}>
            <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{MESES[m]} {y}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 2 }}>
              {WD.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9.5, color: C.inkSoft, fontWeight: 700 }}>{w}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {buildMonthCells(y, m).map((d, i) => {
                if (!d) return <div key={i} />;
                const past = isPast(d);
                const blocked = !past && isBlockedNight(d);
                const disabled = past || blocked;
                const isStart = selCi && ymd(d) === ymd(selCi);
                const isEnd = rangeEnd && ymd(d) === ymd(rangeEnd);
                const within = inRange(d);
                return (
                  <button key={i}
                    disabled={disabled && !isStart && !isEnd}
                    onMouseEnter={() => setHoverDay(d)}
                    onClick={() => handleClick(d)}
                    title={blocked ? 'Indisponível' : undefined}
                    style={{
                      aspectRatio: '1', border: 'none', borderRadius: '50%', padding: 0,
                      fontSize: 11.5, cursor: disabled ? 'default' : 'pointer',
                      background: (isStart || isEnd) ? C.ocean : (within ? C.espuma : 'transparent'),
                      color: (isStart || isEnd) ? '#fff' : (disabled ? '#C7CFCC' : C.ink),
                      textDecoration: blocked ? 'line-through' : 'none',
                      fontWeight: (isStart || isEnd) ? 700 : 500,
                    }}>{d.getDate()}</button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
        <button onClick={() => onChange('', '')} style={{ background: 'none', border: 'none', textDecoration: 'underline', fontSize: 12.5, color: C.ink, cursor: 'pointer', padding: 0 }}>
          Desmarcar datas
        </button>
        {apt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: C.inkSoft }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: C.espuma, border: `1px solid ${C.line}`, display: 'inline-block' }} /> disponível
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff', border: `1px solid ${C.line}`, textDecoration: 'line-through', display: 'inline-block' }} /> ocupado
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
