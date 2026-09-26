import { describe, it, expect } from 'vitest';
import { quantidadeTaxa, extrasObrigatorios, extraOpcional, agruparNoites, regraNoites,
  orcamentoApartamento, orcamentoReserva, precoAPartirDe } from '../src/lib/precos.js';
import { apt, temporada, taxas } from './fixtures.js';

describe('taxas', () => {
  it('conta por reserva, por noite e por hóspede', () => {
    expect(quantidadeTaxa({ por: 'reserva' }, { noites: 5, hospedes: 3 })).toBe(1);
    expect(quantidadeTaxa({ por: 'noite' }, { noites: 5, hospedes: 3 })).toBe(5);
    expect(quantidadeTaxa({ por: 'hospede' }, { noites: 5, hospedes: 3 })).toBe(3);
    expect(quantidadeTaxa({}, {})).toBe(1);
  });
  it('só as obrigatórias entram em extrasObrigatorios, com subtotal = qtd × preço', () => {
    const e = extrasObrigatorios(taxas(), { noites: 4, hospedes: 2 });
    expect(e.map(x => [x.taxaId, x.qtd, x.subtotal])).toEqual([['tx1', 1, 175], ['tx2', 4, 80]]);
  });
  it('opcional por noite multiplica unidades × noites', () => {
    const e = extraOpcional(taxas()[3], 2, { noites: 3 });
    expect(e.qtd).toBe(6);
    expect(e.subtotal).toBe(60);
  });
});

describe('noites e preços', () => {
  it('agruparNoites soma sempre o total exato', () => {
    const g = agruparNoites([{ rate: 300 }, { rate: 300 }, { rate: 360, weekend: true }, { rate: 300 }]);
    expect(g).toEqual([{ rate: 300, n: 3, fimSemana: false, subtotal: 900 }, { rate: 360, n: 1, fimSemana: true, subtotal: 360 }]);
  });
  it('regraNoites usa a temporada real, não a tarifa rápida', () => {
    const rapida = { id: 'q1', nome: 'Tarifa rápida — Apto a1', rapida: true, inicio: '2027-01-01', fim: '2027-01-31', ativa: true, minNoites: 1, precos: { a1: { diaSemana: 100 } } };
    expect(regraNoites([rapida, temporada()], '2027-01-10').min).toBe(2);
  });
  it('orçamento de um apartamento: estadia + taxas', () => {
    // 2027-01-08 é sexta: noites sex, sáb (fim de semana) e dom
    const o = orcamentoApartamento({ apt: apt('a1'), seasons: [temporada()], taxas: taxas(), checkIn: '2027-01-08', checkOut: '2027-01-11', hospedes: 2 });
    expect(o.noites).toBe(3);
    expect(o.estadia).toBe(360 + 360 + 300);
    expect(o.taxasTotal).toBe(175 + 3 * 20);
    expect(o.total).toBe(1020 + 235);
  });
  it('hóspede acima da capacidade base paga o adulto extra da temporada', () => {
    const o = orcamentoApartamento({ apt: apt('a2', { capacidade: 6 }), seasons: [temporada()], taxas: [], checkIn: '2027-01-11', checkOut: '2027-01-12', hospedes: 6 });
    expect(o.estadia).toBe(280 + 2 * 50);
  });
  it('reserva conjunta: opcional "do grupo" conta uma vez; sinal sobre o total combinado', () => {
    const itens = [{ apt: apt('a1'), hospedes: 4 }, { apt: apt('a2', { capacidade: 6 }), hospedes: 2 }];
    const o = orcamentoReserva({ itens, seasons: [temporada()], taxas: taxas(), checkIn: '2027-01-11', checkOut: '2027-01-13',
      opcionais: [{ taxaId: 'tx3', unidades: 1, escopo: 'group' }], sinalPct: 50 });
    const [p1, p2] = o.partes;
    expect(p1.orcamento.opcionais).toHaveLength(1);
    expect(p2.orcamento.opcionais).toHaveLength(0);
    expect(o.total).toBe(p1.orcamento.total + p2.orcamento.total);
    expect(o.sinal).toBe(Math.round(o.total / 2));
  });
  it('"a partir de" nunca fica abaixo dos preços reais quando há temporada a cobrir tudo', () => {
    const s = temporada({ inicio: '2026-11-01', fim: '2027-03-31' });
    expect(precoAPartirDe(apt('a1', { preco: 150 }), [s], '2026-11-20')).toBe(300);
    // com dias sem temporada pela frente, a tarifa base conta
    expect(precoAPartirDe(apt('a1', { preco: 150 }), [temporada()], '2026-11-20')).toBe(150);
  });
});
