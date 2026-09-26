// Cálculo de preços partilhado entre o site (o que o hóspede vê) e o servidor
// (api/reservar.js, que é quem manda de facto). Funções puras — sem React,
// sem rede — para os dois lados chegarem sempre ao mesmo número e para
// poderem ser testadas (ver tests/precos.test.js).
//
// Regras (a pedido do Caio, revisão de 2026-09-25):
// • taxa "por reserva" conta 1 vez; "por noite" conta uma vez por noite;
//   "por hóspede" conta uma vez por pessoa. Antes o painel deixava escolher
//   "por noite"/"por hóspede", mas o cálculo cobrava sempre 1 vez.
// • numa reserva conjunta, as taxas obrigatórias contam em cada apartamento
//   (como antes); os opcionais "para o grupo" contam só no 1º apartamento.
// • o sinal é a percentagem do residencial sobre o total combinado e fica
//   todo registado na 1ª reserva (a 2ª fica com sinal 0), como antes.
import { stayBreakdown, seasonForDate, parseYMD, nights } from './helpers.js';

export const arred = (v) => Math.round((Number(v) || 0) * 100) / 100;

export function quantidadeTaxa(taxa, { noites = 1, hospedes = 1 } = {}) {
  if (taxa?.por === 'noite') return Math.max(1, Number(noites) || 1);
  if (taxa?.por === 'hospede') return Math.max(1, Number(hospedes) || 1);
  return 1;
}

// Linhas das taxas obrigatórias para uma estadia concreta. `qtd * preco`
// dá sempre o subtotal — é assim que o painel (Reservations/Financeiro)
// soma os extras de uma reserva.
export function extrasObrigatorios(taxas = [], ctx = {}) {
  return (taxas || [])
    .filter(t => t && t.tipo === 'obrigatoria')
    .map(t => {
      const qtd = quantidadeTaxa(t, ctx);
      const preco = arred(t.preco);
      return { taxaId: t.id, nome: t.nome, por: t.por || 'reserva', tipo: 'obrigatoria', qtd, preco, subtotal: arred(qtd * preco) };
    });
}

// Um opcional escolhido pelo hóspede: `unidades` é o que ele pôs no contador
// (ex.: 2 kits de praia). Se a taxa for "por noite", cada unidade conta
// também em todas as noites.
export function extraOpcional(taxa, unidades, { noites = 1 } = {}) {
  const u = Math.max(0, Math.floor(Number(unidades) || 0));
  const porNoite = taxa?.por === 'noite' ? Math.max(1, Number(noites) || 1) : 1;
  const qtd = u * porNoite;
  const preco = arred(taxa?.preco);
  return { taxaId: taxa?.id, nome: taxa?.nome, por: taxa?.por || 'reserva', tipo: 'opcional', unidades: u, qtd, preco, subtotal: arred(qtd * preco) };
}

// Junta as noites com o mesmo preço, pela ordem em que aparecem — para o
// detalhe "R$ 285 × 3 noites + R$ 330 × 2 noites" somar sempre o total
// exato (antes mostrava a média arredondada × noites e a conta não fechava).
export function agruparNoites(perNight = []) {
  const grupos = [];
  for (const n of perNight || []) {
    const g = grupos.find(x => x.rate === n.rate);
    if (g) { g.n += 1; g.fimSemana = g.fimSemana || !!n.weekend; }
    else grupos.push({ rate: n.rate, n: 1, fimSemana: !!n.weekend });
  }
  return grupos.map(g => ({ ...g, subtotal: arred(g.rate * g.n) }));
}

// Mínimo e máximo de noites: vêm da temporada REAL (ativa) do dia de
// check-in. As tarifas rápidas são só ajustes de preço de um apartamento —
// não podem baixar o mínimo de todos os outros (antes, a 1ª da lista
// ganhava: uma tarifa rápida com mínimo 1 anulava o mínimo da temporada).
export function regraNoites(seasons = [], checkIn) {
  if (!checkIn) return { min: 1, max: null, temporada: null };
  const s = seasonForDate(seasons || [], parseYMD(checkIn));
  const min = Math.max(1, Number(s?.minNoites) || 1);
  const maxN = Number(s?.maxNoites);
  return { min, max: Number.isFinite(maxN) && maxN > 0 ? maxN : null, temporada: s };
}

// Orçamento de UM apartamento para as datas/pessoas indicadas.
export function orcamentoApartamento({ apt, seasons, taxas, checkIn, checkOut, hospedes, opcionais = [] }) {
  const n = nights(checkIn, checkOut);
  if (!apt || !(n >= 1)) return null;
  const bd = stayBreakdown(apt, seasons || [], checkIn, checkOut, hospedes);
  const ctx = { noites: n, hospedes };
  const obrig = extrasObrigatorios(taxas, ctx);
  const opc = (opcionais || [])
    .map(o => {
      const t = (taxas || []).find(x => x.id === o.taxaId && x.tipo === 'opcional');
      return t ? extraOpcional(t, o.unidades, ctx) : null;
    })
    .filter(x => x && x.qtd > 0);
  const taxasTotal = arred([...obrig, ...opc].reduce((s, e) => s + e.subtotal, 0));
  return {
    noites: n, hospedes, estadia: arred(bd.total), perNight: bd.perNight, grupos: agruparNoites(bd.perNight),
    obrigatorios: obrig, opcionais: opc, taxasTotal, total: arred(bd.total + taxasTotal),
  };
}

// Orçamento de uma reserva (1 ou 2 apartamentos). `opcionais` são as
// escolhas do hóspede [{ taxaId, unidades, escopo: 'group' | 'per_apt' }]:
// "group" conta uma vez (no 1º apartamento); "per_apt" conta em cada um.
export function orcamentoReserva({ itens = [], seasons, taxas, checkIn, checkOut, opcionais = [], sinalPct = 50 }) {
  const partes = itens.filter(Boolean).map((it, i) => {
    const escolhidos = (opcionais || []).filter(o => i === 0 || o.escopo === 'per_apt');
    return { apt: it.apt, hospedes: it.hospedes, orcamento: orcamentoApartamento({ apt: it.apt, seasons, taxas, checkIn, checkOut, hospedes: it.hospedes, opcionais: escolhidos }) };
  });
  if (!partes.length || partes.some(p => !p.orcamento)) return null;
  const total = arred(partes.reduce((s, p) => s + p.orcamento.total, 0));
  const pct = Number(sinalPct);
  const sinal = Math.round(total * ((Number.isFinite(pct) ? pct : 50) / 100));
  return { partes, total, sinal };
}

// "A partir de": o menor preço por noite que existe DE FACTO para este
// apartamento daqui para a frente — nas temporadas por vir (e nas tarifas
// rápidas dele). A tarifa base só entra se houver dias sem temporada.
// Antes mostrava sempre a tarifa base, que podia ficar abaixo de qualquer
// data real (ex.: "a partir de R$ 285" com todas as noites a R$ 302+).
export function precoAPartirDe(apt, seasons = [], hoje) {
  const base = Math.round(Number(apt?.preco) || 0);
  const vivas = (seasons || []).filter(s => s && s.ativa !== false && s.inicio && s.fim && (!hoje || s.fim >= hoje));
  const valores = [];
  for (const s of vivas) {
    const p = s.precos?.[apt?.id];
    if (!p) continue;
    const vs = [p.diaSemana, p.fimSemana].map(v => Math.round(Number(v) || 0)).filter(v => v > 0);
    if (vs.length) valores.push(...vs); else if (base > 0) valores.push(base);
  }
  // há dias sem temporada real entre hoje e o fim da última? então a base vale nesses dias
  const reais = vivas.filter(s => !(s.rapida === true || String(s.nome || '').startsWith('Tarifa rápida — ')))
    .sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  let lacuna = !reais.length || (hoje && reais[0].inicio > hoje);
  for (let i = 1; i < reais.length && !lacuna; i++) {
    const fimAnt = parseYMD(reais[i - 1].fim); fimAnt.setDate(fimAnt.getDate() + 1);
    if (parseYMD(reais[i].inicio) > fimAnt) lacuna = true;
  }
  if (lacuna && base > 0) valores.push(base);
  return valores.length ? Math.min(...valores) : base;
}
