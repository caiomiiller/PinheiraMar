import React, { useState, useMemo, useRef } from 'react';
import { Plus, Search, Download, Upload, Database, Pencil, Trash2, Copy,
  ChevronDown, GripVertical, X, Check, AlertCircle, CalendarDays } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { money, nights, ymd, today, parseYMD, fmtLong, fmtShort, uid, code,
  isAvailable, stayBreakdown, nightlyRate } from '../../lib/helpers';
import { mkExtrasObrigatorios, buildCSV, downloadBlob, rowToReserva,
  EXTRA_PRESETS, PAISES } from '../../lib/csvUtils';
import { Card, PageHead, Badge, Btn, Modal, Field, TextInput, DateInput,
  NumberInput, Select, Textarea, DragGrip, duplicateInList } from '../../components/ui';
import { useReorder } from '../../hooks/useReorder';
import * as XLSX from 'xlsx';

export function Reservations({ data, update }) {
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

export function ReservationForm({ data, initial, isNew, onSave, onRemove, onClose }) {
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
