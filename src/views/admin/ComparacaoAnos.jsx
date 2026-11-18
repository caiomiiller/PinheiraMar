// "Comparar anos" — tela de ANÁLISE VISUAL das Reservas: dois períodos lado a
// lado (por padrão, a partir de hoje e do mesmo dia do ano anterior), com uma
// só coluna de apartamentos e os indicadores dos dias exibidos. As setas
// andam 7 dias, como no calendário principal, nos dois lados ao mesmo tempo.
//
// SOMENTE LEITURA (a pedido do Caio, 2026-11-17): este componente recebe
// apenas `data` — não recebe `update` nem abre o formulário de reserva. As
// barras não são clicáveis e nada aqui grava no banco nem no navegador.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Link2, Unlink, Eye } from 'lucide-react';
import { C, R } from '../../lib/constants';
import { parseYMD, ymd, today, addDays, holidaysOn, WD, fmtShort, holdExpirado } from '../../lib/helpers';
import { Card, Select, STATUS, barBackground, displayStatus } from '../../components/ui';
import { periodoDoMes, indicadoresPeriodo, corteEquivalente, receitaPeriodo } from '../../lib/comparacao';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// mesma largura de dia do calendário principal; o nº de dias mostrados em
// cada lado é o que couber na tela (mínimo de 7)
const NAMEW = 150, GAP = 12, ALTURA = 34, COLW = 38;
const DIA = 86400000;
// mesmas cores de fundo do calendário principal (Reservations.jsx)
const FIM_DE_SEMANA = 'rgba(231,215,182,.13)';
const FERIADO = 'rgba(62,124,177,.07)';
const RESIDENCIAL_ICONE = { pinheiramar: '/logo-icon-pinheiramar.png', novoimovel: '/logo-icon-caminho.png' };

const pct = (x) => `${Math.round(x * 100)}%`;
const reais = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Math.round(v || 0));
const ddmm = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
// "17 nov – 3 dez 2026" (ou "1 – 18 dez 2026")
const rotuloJanela = (a, b) => {
  const m = (d) => MESES_CURTOS[d.getMonth()];
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${a.getDate()} – ${b.getDate()} ${m(b)} ${b.getFullYear()}`;
  if (a.getFullYear() === b.getFullYear()) return `${a.getDate()} ${m(a)} – ${b.getDate()} ${m(b)} ${b.getFullYear()}`;
  return `${a.getDate()} ${m(a)} ${a.getFullYear()} – ${b.getDate()} ${m(b)} ${b.getFullYear()}`;
};
// o mesmo dia/mês noutro ano (29/02 cai em 28/02 num ano que não é bissexto)
const mesmoDiaNoAno = (d, ano) => new Date(ano, d.getMonth(), Math.min(d.getDate(), new Date(ano, d.getMonth() + 1, 0).getDate()));

function Delta({ valor, sufixo = '', titulo }) {
  if (!Number.isFinite(valor)) return null;
  const r = Math.round(valor);
  const cor = r > 0 ? C.sucesso : r < 0 ? C.erro : C.inkSoft;
  return <span title={titulo} style={{ color: cor, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{r > 0 ? '+' : ''}{r}{sufixo}</span>;
}

// Mesma ordem da grade: à esquerda a comparação (ano anterior), à direita o
// período; a diferença é sempre "da esquerda para a direita".
function Indicador({ titulo, esquerda, direita, delta, nota }) {
  // uma linha por ano (ano anterior em cima, período embaixo): com cinco cards
  // na mesma linha, o "A vs B" corrido quebrava de formas diferentes em cada
  // card; assim os números ficam sempre alinhados
  const linha = (v, forte) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 12.5, color: C.inkSoft, whiteSpace: 'nowrap' }}>{v.rotulo}</span>
      <span style={{ fontSize: 19, fontWeight: 700, color: forte ? C.ink : C.inkSoft, whiteSpace: 'nowrap' }}>{v.valor}</span>
    </div>
  );
  return (
    <Card style={{ padding: '12px 16px', borderRadius: R.cartao, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 2 }}>{titulo}</div>
      {linha(esquerda, false)}
      {linha(direita, true)}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 5, marginTop: 2, minHeight: 24 }}>
        <span style={{ fontSize: 11.5, color: C.inkSoft }}>{nota || ''}</span>
        {delta}
      </div>
    </Card>
  );
}

// Mês/ano do 1º dia mostrado; escolher leva a janela ao dia 1 desse mês.
function SeletorMes({ rotulo, valor, onChange, anos }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 13, color: C.inkSoft, whiteSpace: 'nowrap' }}>{rotulo}</span>
      <Select aria-label={`${rotulo}: mês`} value={valor.mes} onChange={e => onChange({ ...valor, mes: Number(e.target.value) })} style={{ width: 'auto', height: 34, padding: '0 8px', fontSize: 13 }}>
        {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
      </Select>
      <Select aria-label={`${rotulo}: ano`} value={valor.ano} onChange={e => onChange({ ...valor, ano: Number(e.target.value) })} style={{ width: 'auto', height: 34, padding: '0 8px', fontSize: 13 }}>
        {anos.map(a => <option key={a} value={a}>{a}</option>)}
      </Select>
    </div>
  );
}

// Uma metade do calendário (um período) para um apartamento
function Faixa({ dias, colW, reservas, inicio, hojeISO }) {
  const ini = parseYMD(inicio);
  return (
    <div style={{ position: 'relative', width: dias.length * colW, height: ALTURA, flexShrink: 0 }}>
      <div style={{ display: 'flex', height: '100%' }}>
        {dias.map(d => {
          const iso = ymd(d);
          const we = d.getDay() === 0 || d.getDay() === 6;
          const bg = iso === hojeISO ? C.sucessoBg : (holidaysOn(d) ? FERIADO : (we ? FIM_DE_SEMANA : 'transparent'));
          return <div key={iso} style={{ width: colW, height: '100%', borderRight: `1px solid ${C.line}`, background: bg }} />;
        })}
      </div>
      {reservas.map(r => {
        const s = Math.round((parseYMD(r.checkIn) - ini) / DIA);
        const e = Math.round((parseYMD(r.checkOut) - ini) / DIA);
        const left = Math.max(0, (s + 0.5) * colW);
        const right = Math.min(dias.length * colW, (e + 0.5) * colW);
        if (right - left <= 4) return null;
        const nome = r.status === 'bloqueio' ? 'Bloqueio' : (r.hospede || 'Reserva');
        const estado = STATUS[displayStatus(r)]?.label || '';
        return (
          <div key={r.id} title={`${nome} · ${fmtShort(r.checkIn)} → ${fmtShort(r.checkOut)} · ${estado}`}
            style={{ position: 'absolute', top: 5, height: ALTURA - 10, left: left + 1, width: Math.max(6, right - left - 2), background: barBackground(displayStatus(r)), color: C.white, borderRadius: R.campo, fontSize: 11, fontWeight: 600, padding: '0 6px', display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'default' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{right - left > 44 ? nome : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

function Cabecalho({ dias, colW, hojeISO }) {
  return (
    <div style={{ display: 'flex', flexShrink: 0 }}>
      {dias.map(d => {
        const iso = ymd(d);
        const hol = holidaysOn(d);
        const we = d.getDay() === 0 || d.getDay() === 6;
        const ehHoje = iso === hojeISO;
        return (
          <div key={iso} title={hol ? hol.map(h => h.nome).join(' · ') : ''}
            style={{ width: colW, flexShrink: 0, textAlign: 'center', padding: '5px 0 3px', background: ehHoje ? C.sucessoBorda : (hol ? 'rgba(62,124,177,.10)' : (we ? 'rgba(231,215,182,.25)' : 'transparent')) }}>
            <div style={{ fontSize: 10.5, color: C.inkSoft, textTransform: 'uppercase' }}>{d.getDate() === 1 ? MESES_CURTOS[d.getMonth()] : WD[d.getDay()]}</div>
            <div style={{ fontSize: 14, fontWeight: ehHoje ? 700 : 500, color: ehHoje ? C.sucesso : C.ink }}>{d.getDate()}</div>
          </div>
        );
      })}
    </div>
  );
}

export function ComparacaoAnos({ data }) {
  const hoje = today();
  const hojeISO = ymd(hoje);
  // 1º dia mostrado em cada lado. Abre como o calendário principal (hoje) e
  // o mesmo dia do ano anterior; as setas andam 7 dias, nos dois lados juntos.
  const [inicioA, setInicioA] = useState(() => hoje);
  const [inicioB, setInicioB] = useState(() => mesmoDiaNoAno(hoje, hoje.getFullYear() - 1));
  const [juntos, setJuntos] = useState(true);

  // largura disponível → quantos dias cabem em cada lado, com a largura de
  // dia habitual do calendário (não espreme as colunas)
  const caixaRef = useRef(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(e?.contentRect?.width || 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const nDias = largura > 0 ? Math.max(7, Math.floor((largura - NAMEW - GAP) / (2 * COLW))) : 14;
  const colW = COLW;

  const diasA = useMemo(() => Array.from({ length: nDias }, (_, i) => addDays(inicioA, i)), [inicioA, nDias]);
  const diasB = useMemo(() => Array.from({ length: nDias }, (_, i) => addDays(inicioB, i)), [inicioB, nDias]);
  const pA = { inicio: ymd(inicioA), fim: ymd(addDays(inicioA, nDias)) };
  const pB = { inicio: ymd(inicioB), fim: ymd(addDays(inicioB, nDias)) };
  const totalDias = 2 * nDias;

  const apartamentos = data.apartamentos || [];
  const reservas = data.reservas || [];

  // anos disponíveis nos filtros: do ano da reserva mais antiga até daqui a 2 anos
  const anos = useMemo(() => {
    let min = hoje.getFullYear() - 1;
    for (const r of reservas) { const y = Number(String(r.checkIn || '').slice(0, 4)); if (y >= 2000 && y < min) min = y; }
    const out = [];
    for (let y = hoje.getFullYear() + 2; y >= min; y--) out.push(y);
    return out;
  }, [reservas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Os cards somam o MÊS INTEIRO escolhido em cada lado (o mês do 1º dia
  // mostrado), não só os dias visíveis na grade — no celular, onde a grade
  // não aparece, são o resumo do mês (a pedido do Caio, 2026-11-18).
  const mesA = periodoDoMes(inicioA.getFullYear(), inicioA.getMonth());
  const mesB = periodoDoMes(inicioB.getFullYear(), inicioB.getMonth());
  const corteB = corteEquivalente(hojeISO, mesA.inicio, mesB.inicio);
  const kA = useMemo(() => indicadoresPeriodo({ reservas, apartamentos, inicio: mesA.inicio, fim: mesA.fim, corte: hojeISO }), [reservas, apartamentos, mesA.inicio, mesA.fim, hojeISO]);
  const kB = useMemo(() => indicadoresPeriodo({ reservas, apartamentos, inicio: mesB.inicio, fim: mesB.fim, corte: corteB }), [reservas, apartamentos, mesB.inicio, mesB.fim, corteB]);
  const receitaA = useMemo(() => receitaPeriodo({ reservas, apartamentos, inicio: mesA.inicio, fim: mesA.fim }), [reservas, apartamentos, mesA.inicio, mesA.fim]);
  const receitaB = useMemo(() => receitaPeriodo({ reservas, apartamentos, inicio: mesB.inicio, fim: mesB.fim }), [reservas, apartamentos, mesB.inicio, mesB.fim]);

  // reservas visíveis por apartamento, em cada período (mesma regra do
  // calendário: tudo menos canceladas e pedidos do site com prazo vencido)
  const porApto = useMemo(() => {
    const m = new Map();
    const agora = Date.now();
    for (const r of reservas) {
      if (!r || r.status === 'cancelada' || holdExpirado(r, agora) || !r.checkIn || !r.checkOut) continue;
      const lista = m.get(r.apartamentoId) || [];
      lista.push(r); m.set(r.apartamentoId, lista);
    }
    return m;
  }, [reservas]);
  const doPeriodo = (lista, p) => (lista || []).filter(r => r.checkIn < p.fim && r.checkOut > p.inicio);

  const mover = (delta) => {
    setInicioA(d => addDays(d, 7 * delta));
    if (juntos) setInicioB(d => addDays(d, 7 * delta));
  };
  const irHoje = () => { setInicioA(hoje); setInicioB(mesmoDiaNoAno(hoje, hoje.getFullYear() - 1)); };
  // escolher mês/ano leva ao dia 1; com "juntos", a comparação acompanha,
  // mantendo a mesma distância em anos
  const escolherPeriodo = ({ ano, mes }) => {
    const gap = inicioB.getFullYear() - inicioA.getFullYear();
    setInicioA(new Date(ano, mes, 1));
    if (juntos) setInicioB(new Date(ano + gap, mes, 1));
  };
  const escolherComparacao = ({ ano, mes }) => setInicioB(new Date(ano, mes, 1));

  // "dez/2025" — rótulo de cada lado nos cards
  const anoB = `${MESES_CURTOS[inicioB.getMonth()]}/${inicioB.getFullYear()}`;
  const anoA = `${MESES_CURTOS[inicioA.getMonth()]}/${inicioA.getFullYear()}`;
  const navBtn = { height: 34, padding: '0 10px', border: `1px solid ${C.line}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', color: C.ink, fontSize: 13, fontWeight: 600 };
  const tituloLado = (dias, destaque) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px 6px', fontWeight: 700, fontSize: 15, color: C.ink, whiteSpace: 'nowrap' }}>
      {rotuloJanela(dias[0], dias[dias.length - 1])}
      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: R.pilula, padding: '2px 9px', background: destaque ? C.ink : C.espuma, color: destaque ? C.white : C.inkSoft }}>{destaque ? 'período' : 'comparação'}</span>
    </div>
  );

  return (
    <div>
      <Card style={{ padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {/* mesma ordem da grade: comparação à esquerda, período à direita */}
        <SeletorMes rotulo="Comparação" valor={{ ano: inicioB.getFullYear(), mes: inicioB.getMonth() }} onChange={escolherComparacao} anos={anos} />
        <SeletorMes rotulo="Período" valor={{ ano: inicioA.getFullYear(), mes: inicioA.getMonth() }} onChange={escolherPeriodo} anos={anos} />
        {/* setas de 7 dias só servem à grade — no celular ficam escondidas */}
        <div className="pm-hide-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button type="button" onClick={() => setJuntos(j => !j)} aria-pressed={juntos}
            title={juntos ? 'As setas andam 7 dias nos dois períodos' : 'As setas andam 7 dias só no período principal'}
            style={{ ...navBtn, borderRadius: R.pilula, gap: 6, background: juntos ? C.sucessoBg : C.white, color: juntos ? C.sucesso : C.inkSoft, borderColor: juntos ? C.sucessoBorda : C.line }}>
            {juntos ? <Link2 size={15} /> : <Unlink size={15} />} {juntos ? 'Navegar juntos' : 'Separados'}
          </button>
          <div style={{ display: 'flex' }}>
            <button type="button" onClick={() => mover(-1)} title="Recuar 7 dias" aria-label="Recuar 7 dias" style={{ ...navBtn, borderRadius: `${R.campo}px 0 0 ${R.campo}px` }}><ChevronLeft size={15} /></button>
            <button type="button" onClick={irHoje} title="Hoje e o mesmo dia do ano anterior" style={{ ...navBtn, borderLeft: 'none' }}>Hoje</button>
            <button type="button" onClick={() => mover(1)} title="Avançar 7 dias" aria-label="Avançar 7 dias" style={{ ...navBtn, borderLeft: 'none', borderRadius: `0 ${R.campo}px ${R.campo}px 0` }}><ChevronRight size={15} /></button>
          </div>
        </div>
      </Card>

      <div style={{ fontSize: 13, color: C.inkSoft, margin: '0 2px 8px' }}>
        Números do mês inteiro: <b style={{ color: C.ink }}>{MESES[inicioB.getMonth()].toLowerCase()} de {inicioB.getFullYear()}</b> vs <b style={{ color: C.ink }}>{MESES[inicioA.getMonth()].toLowerCase()} de {inicioA.getFullYear()}</b>
      </div>
      {/* cinco cards numa só linha no computador (no celular, um por linha — ver .pm-cmp-cards em App.jsx) */}
      <div className="pm-cmp-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
        <Indicador titulo="Ocupação no mês"
          esquerda={{ valor: pct(kB.ocupacao), rotulo: anoB }} direita={{ valor: pct(kA.ocupacao), rotulo: anoA }}
          delta={<Delta valor={(kA.ocupacao - kB.ocupacao) * 100} sufixo=" p.p." titulo="pontos percentuais: diferença entre as duas taxas de ocupação" />}
          nota="p.p. = pontos percentuais" />
        <Indicador titulo="Reservas no mês"
          esquerda={{ valor: kB.reservas, rotulo: anoB }} direita={{ valor: kA.reservas, rotulo: anoA }}
          delta={<Delta valor={kA.reservas - kB.reservas} />} />
        <Indicador titulo="Noites vendidas no mês"
          esquerda={{ valor: kB.noitesVendidas, rotulo: anoB }} direita={{ valor: kA.noitesVendidas, rotulo: anoA }}
          delta={kB.noitesVendidas > 0 ? <Delta valor={(kA.noitesVendidas - kB.noitesVendidas) / kB.noitesVendidas * 100} sufixo="%" /> : null}
          nota="Sem cortesias." />
        <Indicador titulo="Receita no mês"
          esquerda={{ valor: reais(receitaB), rotulo: anoB }} direita={{ valor: reais(receitaA), rotulo: anoA }}
          delta={receitaB > 0 ? <Delta valor={(receitaA - receitaB) / receitaB * 100} sufixo="%" /> : null}
          nota="Por check-in, como no Financeiro" />
        <Indicador titulo="Ritmo de reservas"
          esquerda={{ valor: kB.ritmo, rotulo: `até ${ddmm(corteB)}/${corteB.slice(0, 4)}` }} direita={{ valor: kA.ritmo, rotulo: `até ${ddmm(hojeISO)}/${hojeISO.slice(0, 4)}` }}
          delta={<Delta valor={kA.ritmo - kB.ritmo} />}
          nota={kB.semData > 0 ? `${kB.semData} sem data de criação ficam fora` : 'Já feitas até a data'} />
      </div>

      <div className="pm-show-sm" style={{ fontSize: 12.5, color: C.inkSoft, textAlign: 'center', padding: '4px 8px' }}>
        No celular aparecem só os números do mês. A grade lado a lado fica no computador.
      </div>
      <Card className="pm-hide-sm" style={{ padding: 0, overflow: 'hidden' }}>
        <div ref={caixaRef} style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: NAMEW + GAP + totalDias * colW }}>
            {/* títulos dos dois períodos */}
            <div style={{ display: 'flex', paddingLeft: NAMEW }}>
              <div style={{ width: diasB.length * colW }}>{tituloLado(diasB, false)}</div>
              <div style={{ width: GAP }} />
              <div style={{ width: diasA.length * colW }}>{tituloLado(diasA, true)}</div>
            </div>
            {/* cabeçalho dos dias */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.line}`, background: C.espuma }}>
              <div style={{ width: NAMEW, flexShrink: 0, padding: '10px 14px', fontSize: 12.5, fontWeight: 700, color: C.inkSoft, position: 'sticky', left: 0, background: C.espuma, zIndex: 2 }}>Apartamento</div>
              <Cabecalho dias={diasB} colW={colW} hojeISO={hojeISO} />
              <div style={{ width: GAP, flexShrink: 0, background: C.line }} />
              <Cabecalho dias={diasA} colW={colW} hojeISO={hojeISO} />
            </div>
            {apartamentos.map(apt => {
              const res = (data.residenciais || []).find(x => x.id === apt.residencialId);
              const icone = res && RESIDENCIAL_ICONE[res.id];
              const lista = porApto.get(apt.id);
              return (
                <div key={apt.id} style={{ display: 'flex', borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ width: NAMEW, flexShrink: 0, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, position: 'sticky', left: 0, background: C.white, zIndex: 2, borderRight: `1px solid ${C.line}` }}>
                    <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{apt.nome}</span>
                    {icone && <img src={icone} alt="" title={res.nome} style={{ width: 16, height: 16, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />}
                    <span style={{ fontSize: 11, color: C.inkSoft }}>{apt.capacidade}p</span>
                  </div>
                  <Faixa dias={diasB} colW={colW} reservas={doPeriodo(lista, pB)} inicio={pB.inicio} hojeISO={hojeISO} />
                  <div style={{ width: GAP, flexShrink: 0, background: C.line }} />
                  <Faixa dias={diasA} colW={colW} reservas={doPeriodo(lista, pA)} inicio={pA.inicio} hojeISO={hojeISO} />
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, padding: '12px 16px', fontSize: 12.5, color: C.inkSoft, flexWrap: 'wrap', alignItems: 'center', borderTop: `1px solid ${C.line}` }}>
          {Object.entries(STATUS).filter(([k]) => k !== 'cancelada').map(([k, s]) =>
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: R.campo, background: barBackground(k) }} /> {k === 'checkout' ? 'Estadia terminada' : s.label}</span>)}
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}><Eye size={14} /> Somente leitura — para editar uma reserva, use o Calendário ou a Lista.</span>
        </div>
      </Card>
    </div>
  );
}
