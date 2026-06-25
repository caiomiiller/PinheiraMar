import React from 'react';
import { CalendarDays, Users, Wallet, BedDouble, ArrowRight, ChevronLeft, Home, Tag, Building2 } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { money, nights, parseYMD, ymd, today, addDays, seasonForDate, fmtShort, fmtLong } from '../../lib/helpers';
import { Card, PageHead, Badge, Btn } from '../../components/ui';

export function Dashboard({ data, go }) {
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
