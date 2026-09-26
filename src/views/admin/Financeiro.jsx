import React, { useState } from 'react';
import { C, F } from '../../lib/constants';
import { money, nights, parseYMD, ymd, today, fmtShort, holdExpirado } from '../../lib/helpers';
import { Card, PageHead, Badge, Btn, DateInput, STATUS } from '../../components/ui';

export function Financeiro({ data, go }) {
  const t = today();
  const [periodo, setPeriodo] = useState('all');
  // período "Personalizado" — datas escolhidas livremente pelo utilizador
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const selectPeriodo = (id) => {
    setPeriodo(id);
    // ao entrar em "Personalizado" pela primeira vez, sugere o mês atual como
    // ponto de partida em vez de deixar os campos vazios (o que filtraria tudo)
    if (id === 'custom' && !customFrom && !customTo) {
      setCustomFrom(ymd(new Date(t.getFullYear(), t.getMonth(), 1)));
      setCustomTo(ymd(t));
    }
  };

  const PERIODOS = [
    { id: 'all',  label: 'Todo período' },
    { id: 'year', label: 'Este ano' },
    { id: 'month', label: 'Este mês' },
    { id: '30d',  label: 'Últimos 30 dias' },
    { id: '90d',  label: 'Últimos 90 dias' },
    { id: 'custom', label: 'Personalizado' },
  ];
  const inPeriodo = (r) => {
    const d = parseYMD(r.checkIn);
    const y = t.getFullYear(), m = t.getMonth();
    // "Últimos N dias" olha para trás a partir de hoje — check-in tem de estar
    // entre (hoje - N dias) e hoje, inclusive. Sem o limite inferior (>= 0),
    // qualquer reserva com check-in FUTURO entrava sempre (t - d ficava
    // negativo, que é sempre <= 30/90), fazendo o filtro incluir reservas de
    // daqui a meses em vez de só as dos últimos N dias.
    const diffDias = (t - d) / (1000*60*60*24);
    if (periodo === 'year')  return d.getFullYear() === y;
    if (periodo === 'month') return d.getFullYear() === y && d.getMonth() === m;
    if (periodo === '30d')   return diffDias >= 0 && diffDias <= 30;
    if (periodo === '90d')   return diffDias >= 0 && diffDias <= 90;
    if (periodo === 'custom') {
      if (customFrom && d < parseYMD(customFrom)) return false;
      if (customTo && d > parseYMD(customTo)) return false;
      return true;
    }
    return true;
  };

  // Para o Financeiro refletir a realidade, uma reserva cujo check-out já
  // passou é tratada aqui como concluída — Confirmado + Check-out realizado —
  // mesmo que ninguém tenha atualizado manualmente o status. Isto é só um
  // cálculo de exibição nesta página (mesmo princípio do displayStatus em
  // ui.jsx): não altera o status nem o checkoutRealizado guardados na
  // reserva, então o resto do sistema (calendário, lista de reservas, etc.)
  // continua mostrando o status real até alguém atualizá-lo lá.
  const comoRealizada = (r) => {
    if ((r.status === 'reservado' || r.status === 'pendente') && parseYMD(r.checkOut) < t) {
      return { ...r, status: 'confirmado', checkoutRealizado: true };
    }
    return r;
  };

  // Fora as canceladas e as reservas provisórias que expiraram sem pagamento
  // (ver holdExpirado): essas nunca chegaram a ser reservas, não podem
  // aparecer como receita prevista.
  const agoraMs = Date.now();
  const reservasEfetivas = data.reservas
    .filter(r => r.status !== 'cancelada' && !holdExpirado(r, agoraMs))
    .map(comoRealizada);
  const filtradas = reservasEfetivas.filter(inPeriodo);
  const bloqueios = filtradas.filter(r => r.status === 'bloqueio');

  // Base única de tudo o que gera receita no período: as canceladas já
  // ficaram de fora acima, aqui saem os bloqueios (não são estadias nem
  // dinheiro). "Receita total", ticket médio, média de noites, tabela por
  // apartamento e origens partem TODOS deste mesmo conjunto — quando cada
  // número olhava para um conjunto diferente, uma reserva com um status
  // inesperado entrava na tabela mas não no total, e a participação
  // disparava para milhares de por cento.
  const comReceita = filtradas.filter(r => r.status !== 'bloqueio');
  const confirmadas = comReceita.filter(r => r.status === 'confirmado');
  const reservadas  = comReceita.filter(r => r.status === 'reservado');
  const pendentes   = comReceita.filter(r => r.status === 'pendente');
  // Rede de segurança: qualquer status fora do modelo atual (dados antigos
  // por converter, uma importação futura) cai aqui e continua a contar na
  // receita, em vez de desaparecer silenciosamente das contas.
  const outras = comReceita.filter(r => !['confirmado', 'reservado', 'pendente'].includes(r.status));

  const soma = (rs) => rs.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const recConf  = soma(confirmadas);
  const recTotal = soma(comReceita);
  // "prevista" é tudo o que ainda não é receita garantida: reservado (50%
  // confirmado), pendente (sem pagamento) e o que caia em `outras`.
  const recPend  = recTotal - recConf;
  const ticketMedio = comReceita.length > 0 ? Math.round(recTotal / comReceita.length) : 0;
  const mediaNoites = comReceita.length > 0 ? (comReceita.reduce((s, r) => s + nights(r.checkIn, r.checkOut), 0) / comReceita.length).toFixed(1) : '—';

  // receita por apartamento
  // Ordenação por coluna (a pedido do Caio, 2026-09-24) — 'receita' desc é o
  // padrão (comportamento antigo, fixo).
  const [aptSortKey, setAptSortKey] = useState('receita');
  const [aptSortDir, setAptSortDir] = useState('desc');
  const aptSortByColumn = (key) => {
    if (aptSortKey === key) { setAptSortDir(d => d === 'asc' ? 'desc' : 'asc'); return; }
    setAptSortKey(key);
    setAptSortDir(key === 'nome' ? 'asc' : 'desc');
  };
  const porApt = data.apartamentos.map(a => {
    const rs = comReceita.filter(r => r.apartamentoId === a.id);
    const receita = soma(rs);
    const qtd = rs.length;
    const noites = rs.reduce((s, r) => s + nights(r.checkIn, r.checkOut), 0);
    return { nome: a.nome, receita, qtd, noites };
  }).sort((a, b) => {
    const av = a[aptSortKey], bv = b[aptSortKey];
    const r = typeof av === 'string' ? av.localeCompare(bv, 'pt') : av - bv;
    return aptSortDir === 'asc' ? r : -r;
  });

  // receita por mês (últimos 12 meses)
  const porMes = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const rs = reservasEfetivas.filter(r => r.status === 'confirmado' && parseYMD(r.checkIn).getFullYear() === y && parseYMD(r.checkIn).getMonth() === m);
    porMes.push({ label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), v: soma(rs) });
  }
  const maxMes = Math.max(...porMes.map(m => m.v), 1);

  // reservas por origem
  const origens = {};
  comReceita.forEach(r => { const o = r.origem || 'Direto'; origens[o] = (origens[o] || 0) + 1; });
  const origensList = Object.entries(origens).sort((a, b) => b[1] - a[1]);
  const totalOrig = origensList.reduce((s, [, v]) => s + v, 0);

  // Ordenação por coluna na tabela "Reservas no período" (a pedido do Caio,
  // 2026-09-24) — 'checkIn' desc é o padrão (comportamento antigo, fixo).
  const [resSortKey, setResSortKey] = useState('checkIn');
  const [resSortDir, setResSortDir] = useState('desc');
  const RES_SORT_ACCESSORS = {
    codigo: r => r.codigo || '',
    hospede: r => r.hospede || '',
    apartamento: r => data.apartamentos.find(a => a.id === r.apartamentoId)?.nome || '',
    checkIn: r => parseYMD(r.checkIn).getTime(),
    checkOut: r => parseYMD(r.checkOut).getTime(),
    noites: r => nights(r.checkIn, r.checkOut),
    total: r => Number(r.total) || 0,
    status: r => r.status || '',
  };
  const resSortByColumn = (key) => {
    if (resSortKey === key) { setResSortDir(d => d === 'asc' ? 'desc' : 'asc'); return; }
    setResSortKey(key);
    setResSortDir(key === 'total' || key === 'checkIn' || key === 'checkOut' || key === 'noites' ? 'desc' : 'asc');
  };
  // Filtro por status na tabela "Reservas no período" (a pedido do Caio,
  // 2026-09-24) — usa as mesmas categorias do quadro "Reservas por status"
  // ao lado. 'Todas' mantém o comportamento de sempre (comReceita, sem
  // bloqueios); um status específico — incluindo Bloqueio, que não faz
  // parte de comReceita — vem de `filtradas` (o mesmo conjunto que o quadro
  // "Reservas por status" usa para contar), para os números baterem certo.
  const [resStatusFilter, setResStatusFilter] = useState('todas');
  const resBase = resStatusFilter === 'todas' ? comReceita : filtradas.filter(r => r.status === resStatusFilter);
  const resSorted = [...resBase].sort((a, b) => {
    const av = RES_SORT_ACCESSORS[resSortKey](a), bv = RES_SORT_ACCESSORS[resSortKey](b);
    const r = typeof av === 'string' ? av.localeCompare(bv, 'pt') : av - bv;
    return resSortDir === 'asc' ? r : -r;
  });

  const KPI = ({ label, value, sub, accent }) => (
    <Card style={{ padding: 18 }}>
      <div style={{ fontSize: 12.5, color: C.inkSoft, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div className="pm-fin-kpi-value" style={{ fontSize: 'clamp(14px, 1.3vw, 19px)', fontWeight: 700, fontFamily: F.sans, color: accent ? C.coralDeep : C.ink, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>{sub}</div>}
    </Card>
  );

  return (
    <div>
      <PageHead title="Financeiro" sub="Receitas, estatísticas e desempenho por apartamento."
        action={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', background: C.espuma, borderRadius: 10, padding: 3 }}>
              {PERIODOS.map(p => (
                <button key={p.id} onClick={() => selectPeriodo(p.id)} style={{ padding: '7px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: periodo === p.id ? '#fff' : 'transparent', color: periodo === p.id ? C.ocean : C.inkSoft, boxShadow: periodo === p.id ? '0 1px 3px rgba(0,0,0,.08)' : 'none', whiteSpace: 'nowrap' }}>
                  {p.label}
                </button>
              ))}
            </div>
            {periodo === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.inkSoft, fontWeight: 600 }}>
                  De
                  <DateInput value={customFrom} max={customTo || undefined}
                    onChange={e => setCustomFrom(e.target.value)} style={{ width: 150, padding: '6px 9px', fontSize: 12.5 }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.inkSoft, fontWeight: 600 }}>
                  até
                  <DateInput value={customTo} min={customFrom || undefined}
                    onChange={e => setCustomTo(e.target.value)} style={{ width: 150, padding: '6px 9px', fontSize: 12.5 }} />
                </label>
              </div>
            )}
          </div>
        } />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 22 }}>
        <KPI label="Receita confirmada" value={money(recConf)} sub={`${confirmadas.length} reservas`} accent />
        <KPI label="Receita prevista" value={money(recPend)} sub={`${reservadas.length} reservadas · ${pendentes.length} pendentes${outras.length ? ` · ${outras.length} sem estado` : ''}`} />
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
          <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: '0 0 16px' }}>Desempenho por apartamento <span style={{ fontSize: 12.5, color: C.inkSoft, fontWeight: 400 }}>(participação de cada um na receita total do período)</span></h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.line}` }}>
                  {[['Apartamento', 'nome'], ['Reservas', 'qtd'], ['Noites', 'noites'], ['Receita', 'receita'], ['Participação', 'receita']].map(([h, key]) => (
                    <th key={h} onClick={() => aptSortByColumn(key)} title="Ordenar por esta coluna"
                      style={{ padding: '6px 10px 10px', textAlign: h === 'Apartamento' ? 'left' : 'right', color: C.inkSoft, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                      {h}{aptSortKey === key ? (aptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
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
                          <div style={{ width: `${recTotal > 0 ? Math.round((p.receita / recTotal) * 100) : 0}%`, height: '100%', background: `linear-gradient(90deg,${C.brisa},${C.ocean})`, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12, color: C.inkSoft, minWidth: 30, textAlign: 'right' }}>{recTotal > 0 ? Math.round((p.receita / recTotal) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {recTotal > 0 && (
                <tfoot>
                  <tr style={{ background: C.espuma }}>
                    <td style={{ padding: '9px 10px', fontWeight: 700 }}>Total</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700 }}>{comReceita.length}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700 }}>{comReceita.reduce((s, r) => s + nights(r.checkIn, r.checkOut), 0)}</td>
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
            {[['confirmado', 'Confirmadas'], ['reservado', 'Reservadas'], ['pendente', 'Pendentes'], ['bloqueio', 'Bloqueios']].map(([st, label]) => {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: 0 }}>Reservas no período <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 400 }}>· {resBase.length} registos</span></h3>
          <Btn size="sm" variant="ghost" onClick={() => go('reservas')}>Gerir reservas</Btn>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: C.inkSoft }}>Status:</span>
          <button onClick={() => setResStatusFilter('todas')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, background: resStatusFilter === 'todas' ? C.ocean : C.espuma, color: resStatusFilter === 'todas' ? '#fff' : C.inkSoft }}>Todas</button>
          {['confirmado', 'reservado', 'pendente', 'bloqueio'].map(st => (
            <button key={st} onClick={() => setResStatusFilter(st)}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, background: resStatusFilter === st ? STATUS[st].fg : C.espuma, color: resStatusFilter === st ? '#fff' : C.inkSoft }}>
              {STATUS[st].label}
            </button>
          ))}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.line}` }}>
                {[['Código', 'codigo'], ['Hóspede', 'hospede'], ['Apartamento', 'apartamento'], ['Check-in', 'checkIn'], ['Check-out', 'checkOut'], ['Noites', 'noites'], ['Total', 'total'], ['Status', 'status']].map(([h, key]) => (
                  <th key={h} onClick={() => resSortByColumn(key)} title="Ordenar por esta coluna"
                    style={{ padding: '6px 10px 10px', textAlign: 'left', color: C.inkSoft, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                    {h}{resSortKey === key ? (resSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resSorted.slice(0, 40).map(r => (
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
          {resBase.length > 40 && (
            <div style={{ padding: '12px 10px', fontSize: 13, color: C.inkSoft, textAlign: 'center' }}>A mostrar 40 de {resBase.length} registos. Use filtros de período{resStatusFilter === 'todas' ? '' : ' ou de status'} para refinar.</div>
          )}
          {resBase.length === 0 && (
            <div style={{ padding: '20px 10px', fontSize: 13.5, color: C.inkSoft, textAlign: 'center' }}>Nenhuma reserva com este status no período.</div>
          )}
        </div>
      </Card>
    </div>
  );
}


/* ── Reservations (calendar + list) ── */
