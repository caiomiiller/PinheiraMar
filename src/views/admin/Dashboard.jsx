import React from 'react';
import { CalendarDays, Users, Wallet, ArrowRight, ChevronLeft, Home, Tag, Building2 } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { nights, parseYMD, ymd, today, addDays, seasonForDate, fmtShort, fmtLong, holdExpirado, money } from '../../lib/helpers';
import { Card, PageHead, Badge, Btn, CheckinBadge, CheckoutBadge, displayStatus } from '../../components/ui';

export function Dashboard({ data, go, openReservation }) {
  const t = today();
  const hojeY = ymd(t);
  const agoraMs = Date.now();
  const horizon = 30;

  // Uma reserva só conta enquanto for real: canceladas nunca contam, e uma
  // reserva do site à espera de pagamento cujo prazo já passou também não
  // (holdExpirado) — senão o painel mostrava como ocupadas datas que o site
  // já está a oferecer como livres.
  const reais = data.reservas.filter(r => r.status !== 'cancelada' && !holdExpirado(r, agoraMs));
  const estadias = reais.filter(r => r.status !== 'bloqueio');   // hóspedes
  const bloqueios = reais.filter(r => r.status === 'bloqueio');  // indisponibilizados pela casa

  // "Ativas" são as que ainda estão por acontecer ou a decorrer (check-out de
  // hoje em diante). O arquivo histórico completo tem cartão próprio: somar
  // tudo num número só fazia "Reservas ativas" mostrar milhares de estadias
  // terminadas há anos, escondendo o que é preciso acompanhar esta semana.
  const ativasFuturas = estadias.filter(r => (r.checkOut || '') >= hojeY);

  // Procura nova que entrou nos últimos 30 dias. A importação do sistema
  // antigo fica de fora de propósito: é um arquivo carregado todo de uma vez,
  // não são reservas novas, e contá-las mostrava milhares no primeiro mês.
  const desdeY = ymd(addDays(t, -horizon));
  const novas = estadias.filter(r => r.origem !== 'Importado' && (r.criadoEm || '') >= desdeY);

  const aptsAtivos = data.apartamentos.filter(a => a.ativo);
  const cobre = (lista, aptId, d) => lista.some(r => r.apartamentoId === aptId && parseYMD(r.checkIn) <= d && d < parseYMD(r.checkOut));

  // Ocupação hoteleira: noites vendidas sobre as noites que estavam mesmo à
  // venda. Uma noite bloqueada (manutenção, uso da família) nunca esteve
  // disponível, por isso sai das duas pontas da conta — antes entrava como
  // "ocupada", o que inflacionava a ocupação sempre que houvesse bloqueios.
  let noitesVendidas = 0, noitesBloqueadas = 0;
  const porApt = aptsAtivos.map(a => {
    let vend = 0, bloq = 0;
    for (let i = 0; i < horizon; i++) {
      const d = addDays(t, i);
      if (cobre(estadias, a.id, d)) vend++;
      else if (cobre(bloqueios, a.id, d)) bloq++;
    }
    noitesVendidas += vend; noitesBloqueadas += bloq;
    const disponiveis = horizon - bloq;
    return { nome: a.nome, capacidade: a.capacidade || 0, n: vend, pct: disponiveis > 0 ? Math.round((vend / disponiveis) * 100) : 0 };
  });
  const noitesDisponiveis = aptsAtivos.length * horizon - noitesBloqueadas;
  const ocup = noitesDisponiveis > 0 ? Math.round((noitesVendidas / noitesDisponiveis) * 100) : 0;

  // Ordenado por lotação (e depois por nome): põe lado a lado os
  // apartamentos que acomodam o mesmo número de pessoas, que é como se
  // compara o desempenho de unidades equivalentes.
  const perApt = [...porApt].sort((a, b) => (a.capacidade - b.capacidade) || a.nome.localeCompare(b.nome, 'pt'));

  const aptName = (id) => data.apartamentos.find(a => a.id === id)?.nome || '—';
  const season = seasonForDate(data.seasons, t);

  const proxCheckins  = reais.filter(r => parseYMD(r.checkIn)  >= t).sort((a, b) => parseYMD(a.checkIn)  - parseYMD(b.checkIn)).slice(0, 10);
  const proxCheckouts = reais.filter(r => parseYMD(r.checkOut) >= t).sort((a, b) => parseYMD(a.checkOut) - parseYMD(b.checkOut)).slice(0, 10);

  const disponiveisHoje = aptsAtivos.filter(a => !cobre(reais, a.id, t)).length;
  const totalAtivos = aptsAtivos.length;

  // Pagamento aprovado para datas que entretanto já tinham sido ocupadas por
  // outra reserva (ver api/mp-webhook.js) — precisa de decisão humana.
  const conflitos = data.reservas.filter(r => r.conflitoDatas && r.status !== 'cancelada');
  // Pagamentos que precisam de alguém (ver api/mp-webhook.js): pago a menos
  // do que o sinal (a reserva não foi confirmada, mas as datas ficaram
  // seguras) e estornos/contestações depois de pago.
  const avisosPagamento = data.reservas.filter(r => r.status !== 'cancelada'
    && ((r.pagamentoDivergente && r.status === 'pendente') || r.pagamentoEstornado));

  const stats = [
    { label: 'Reservas ativas',   value: ativasFuturas.length,   icon: CalendarDays, sub: `${ativasFuturas.filter(r => r.status === 'pendente').length} pendentes · ${ativasFuturas.filter(r => r.status === 'reservado').length} reservadas`, click: () => go('reservas') },
    { label: `Novas reservas (${horizon} dias)`, value: novas.length, icon: Users,  sub: novas.length ? `entraram desde ${fmtShort(desdeY)}` : 'nenhuma no período',                                  click: () => go('reservas') },
    { label: `Ocupação (${horizon} dias)`, value: ocup + '%',     icon: Home,         sub: `${noitesVendidas} de ${noitesDisponiveis} noites à venda${noitesBloqueadas ? ` · ${noitesBloqueadas} bloqueadas` : ''}`, click: null },
    { label: 'Disponíveis hoje',  value: `${disponiveisHoje} / ${totalAtivos}`, icon: Building2, sub: `${totalAtivos - disponiveisHoje} ocupado(s) agora`,                                            click: () => go('reservas') },
    { label: 'Temporada atual',   value: season ? season.nome : 'Tarifa base', icon: Tag, sub: season ? `${fmtShort(season.inicio)} – ${fmtShort(season.fim)}` : '—',                                  click: () => go('temporadas') },
    { label: 'Total de reservas', value: estadias.length,        icon: Wallet,       sub: 'arquivo completo, desde sempre',                                                                            click: () => go('reservas') },
  ];

  const EventRow = ({ r, dateField }) => {
    const d = parseYMD(r[dateField]);
    const isToday = ymd(d) === ymd(t);
    return (
      <div onClick={() => openReservation?.(r.id)} title="Abrir reserva"
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 11px', background: isToday ? '#FBF1E6' : C.espuma, borderRadius: 10, border: isToday ? `1px solid #EBD9C0` : '1px solid transparent', cursor: openReservation ? 'pointer' : 'default' }}
        onMouseEnter={openReservation ? e => e.currentTarget.style.boxShadow = '0 2px 10px rgba(10,40,46,.10)' : undefined}
        onMouseLeave={openReservation ? e => e.currentTarget.style.boxShadow = '' : undefined}>
        <div style={{ textAlign: 'center', minWidth: 40, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: F.disp, lineHeight: 1, color: isToday ? C.coralDeep : C.ink }}>{d.getDate()}</div>
          <div style={{ fontSize: 10, color: C.inkSoft, textTransform: 'uppercase' }}>{d.toLocaleDateString('pt-BR', { month: 'short' })}</div>
          {isToday && <div style={{ fontSize: 9, fontWeight: 700, color: C.coralDeep }}>HOJE</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.status === 'bloqueio' ? 'Bloqueio' : (r.hospede || '—')}</span>
            {r.checkinRealizado && <CheckinBadge compact />}
            {r.checkoutRealizado && <CheckoutBadge compact />}
          </div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>{aptName(r.apartamentoId)} · {nights(r.checkIn, r.checkOut)} noite(s)</div>
        </div>
        <Badge status={displayStatus(r)} />
      </div>
    );
  };

  return (
    <div>
      <PageHead title="Painel de controle" sub={`Hoje, ${fmtLong(ymd(t))}`} />

      {avisosPagamento.length > 0 && (
        <Card style={{ padding: 16, marginBottom: 18, background: '#FDECEC', border: '1px solid #F2C4C4' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#A23B3B', marginBottom: 8 }}>
            {avisosPagamento.length} pagamento(s) do Mercado Pago precisa(m) de atenção
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {avisosPagamento.map(r => (
              <button key={r.id} onClick={() => openReservation?.(r.id)}
                style={{ textAlign: 'left', background: 'rgba(255,255,255,.7)', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 13, color: C.ink, fontFamily: F.sans }}>
                <b>{r.codigo}</b> · {r.hospede || '—'} · {aptName(r.apartamentoId)} —{' '}
                {r.pagamentoEstornado
                  ? `pagamento ${r.pagamentoEstornado.status === 'charged_back' ? 'contestado (chargeback)' : 'estornado'} em ${fmtShort(String(r.pagamentoEstornado.em || '').slice(0, 10) || ymd(t))}`
                  : `pagou ${money(r.pagamentoDivergente.pago)} de ${money(r.pagamentoDivergente.esperado)} do sinal: não foi confirmada, as datas estão seguras`}
              </button>
            ))}
          </div>
        </Card>
      )}

      {conflitos.length > 0 && (
        <Card style={{ padding: 16, marginBottom: 18, background: '#FBEFD9', border: '1px solid #EBD9C0' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#9A6A14', marginBottom: 4 }}>
            {conflitos.length} reserva(s) paga(s) para datas que já estavam ocupadas
          </div>
          <div style={{ fontSize: 13, color: C.inkSoft }}>
            O pagamento foi aprovado depois de o prazo da reserva provisória expirar e outra pessoa ter ficado com as mesmas noites.
            O hóspede pagou, por isso a reserva foi mantida — {conflitos.map(r => r.codigo).join(', ')} — mas precisa de ser resolvida à mão.
          </div>
        </Card>
      )}

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
            Ocupação por apartamento <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 400 }}>· próx. {horizon} dias · por lotação</span>
          </h3>
          <Btn size="sm" variant="ghost" onClick={() => go('financeiro')}>Relatório financeiro</Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px 28px' }}>
          {perApt.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 104, fontSize: 13, color: C.inkSoft, flexShrink: 0 }}>
                {p.nome}{p.capacidade ? <span style={{ opacity: .65 }}> · {p.capacidade}p</span> : null}
              </div>
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
