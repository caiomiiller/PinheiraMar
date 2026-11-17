// Comparação de períodos (ex.: dezembro de 2026 × dezembro de 2025) para a
// tela "Comparar anos" das Reservas. SÓ LEITURA: estas funções recebem as
// reservas e devolvem números — nunca alteram nem gravam nada.
//
// Datas sempre em texto ISO (aaaa-mm-dd): comparam-se bem como texto.
// Um período é [inicio, fim) — `fim` é o dia seguinte ao último dia mostrado.
import { addDays, parseYMD, ymd, holdExpirado } from './helpers.js';

const DIA = 86400000;
const diasEntre = (a, b) => Math.round((parseYMD(b) - parseYMD(a)) / DIA);

// Reservas que ocupam o apartamento: tudo menos canceladas, bloqueios e
// pedidos do site cujo prazo de pagamento já expirou (as datas voltaram a
// ficar livres). Cortesias ocupam, então entram.
export const ocupaDatas = (r, agora = Date.now()) =>
  !!r && r.status !== 'cancelada' && r.status !== 'bloqueio' && !holdExpirado(r, agora)
  && !!r.checkIn && !!r.checkOut && r.checkOut > r.checkIn;

// Noites de uma reserva que caem dentro do período
export function noitesNoPeriodo(r, inicio, fim) {
  const a = r.checkIn > inicio ? r.checkIn : inicio;
  const b = r.checkOut < fim ? r.checkOut : fim;
  return b > a ? diasEntre(a, b) : 0;
}

// Indicadores de um período.
//  - ocupação: noites ocupadas ÷ (apartamentos × dias), cortesias incluídas
//  - reservas: reservas com pelo menos uma noite no período
//  - noites vendidas: noites no período, SEM cortesias (não são vendidas)
//  - ritmo: reservas do período que já existiam na data `corte`
//    (criadoEm ≤ corte); as sem data de criação ficam de fora e são contadas
//    em `semData`, para a tela poder avisar.
export function indicadoresPeriodo({ reservas = [], apartamentos = [], inicio, fim, corte, agora = Date.now() }) {
  const ids = new Set(apartamentos.map(a => a.id));
  const dias = diasEntre(inicio, fim);
  let noitesOcupadas = 0, noitesVendidas = 0, total = 0, ritmo = 0, semData = 0;
  for (const r of reservas) {
    if (!ids.has(r.apartamentoId) || !ocupaDatas(r, agora)) continue;
    const n = noitesNoPeriodo(r, inicio, fim);
    if (n <= 0) continue;
    total += 1;
    noitesOcupadas += n;
    if (r.status !== 'cortesia') noitesVendidas += n;
    if (corte) {
      const criada = String(r.criadoEm || '').slice(0, 10);
      if (!criada) semData += 1;
      else if (criada <= corte) ritmo += 1;
    }
  }
  const capacidade = ids.size * dias;
  return {
    dias, reservas: total, noitesOcupadas, noitesVendidas,
    ocupacao: capacidade > 0 ? noitesOcupadas / capacidade : 0,
    ritmo, semData,
  };
}

// Data equivalente a `hoje` no período de comparação: mesma distância em
// dias entre os dois inícios (ex.: 17/11/2026 → 17/11/2025 quando se compara
// com o mesmo mês do ano anterior).
export function corteEquivalente(hoje, inicioAtual, inicioComparado) {
  return ymd(addDays(parseYMD(hoje), -diasEntre(inicioComparado, inicioAtual)));
}
