import React, { useState, useMemo } from 'react';
import { Download, CreditCard, Wallet, ChevronDown } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { money, nights, parseYMD, ymd, today, fmtLong } from '../../lib/helpers';
import { buildCSV, downloadBlob } from '../../lib/csvUtils';
import { Card, PageHead, Badge, Select, Field } from '../../components/ui';
import * as XLSX from 'xlsx';

export function Financeiro({ data, go }) {
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
