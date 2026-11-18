import { describe, it, expect } from 'vitest';
import { periodoDoMes, receitaPeriodo, noitesNoPeriodo, indicadoresPeriodo, corteEquivalente, ocupaDatas } from '../src/lib/comparacao.js';

const apts = [{ id: 'a1' }, { id: 'a2' }];
const r = (id, ci, co, extra = {}) => ({ id, apartamentoId: 'a1', checkIn: ci, checkOut: co, status: 'confirmado', criadoEm: '2026-10-01', ...extra });

describe('comparação de períodos (somente leitura)', () => {
  it('mês inteiro dos cards (inclui fevereiro bissexto e virada de ano)', () => {
    expect(periodoDoMes(2026, 11)).toEqual({ inicio: '2026-12-01', fim: '2027-01-01', dias: 31 });
    expect(periodoDoMes(2028, 1).dias).toBe(29);
    expect(periodoDoMes(2025, 10)).toEqual({ inicio: '2025-11-01', fim: '2025-12-01', dias: 30 });
  });
  it('conta só as noites dentro do período (reserva que atravessa o mês)', () => {
    expect(noitesNoPeriodo(r('x', '2026-11-28', '2026-12-03'), '2026-12-01', '2027-01-01')).toBe(2);
    expect(noitesNoPeriodo(r('x', '2026-12-30', '2027-01-04'), '2026-12-01', '2027-01-01')).toBe(2);
    expect(noitesNoPeriodo(r('x', '2026-11-01', '2026-11-05'), '2026-12-01', '2027-01-01')).toBe(0);
  });
  it('indicadores: cancelada e bloqueio fora; cortesia ocupa mas não é vendida', () => {
    const reservas = [
      r('1', '2026-12-01', '2026-12-04'),                                  // 3 noites
      r('2', '2026-12-10', '2026-12-12', { status: 'cortesia' }),          // 2 noites, não vendidas
      r('3', '2026-12-20', '2026-12-25', { status: 'cancelada' }),         // fora
      r('4', '2026-12-26', '2026-12-28', { status: 'bloqueio' }),          // fora
      r('5', '2026-12-05', '2026-12-06', { apartamentoId: 'outro' }),      // outro residencial
    ];
    const k = indicadoresPeriodo({ reservas, apartamentos: apts, inicio: '2026-12-01', fim: '2027-01-01' });
    expect(k.reservas).toBe(2);
    expect(k.noitesOcupadas).toBe(5);
    expect(k.noitesVendidas).toBe(3);
    expect(k.ocupacao).toBeCloseTo(5 / 62);
  });
  it('pedido do site com prazo expirado não ocupa', () => {
    expect(ocupaDatas(r('p', '2026-12-01', '2026-12-03', { status: 'pendente', expiraEm: '2026-11-01T00:00:00Z' }), Date.parse('2026-11-17'))).toBe(false);
  });
  it('ritmo: reservas já feitas até a data de corte; sem data de criação ficam à parte', () => {
    const reservas = [
      r('1', '2025-12-01', '2025-12-04', { criadoEm: '2025-10-02' }),
      r('2', '2025-12-10', '2025-12-12', { criadoEm: '2025-11-20' }),
      r('3', '2025-12-15', '2025-12-17', { criadoEm: '' }),
    ];
    const corte = corteEquivalente('2026-11-17', '2026-12-01', '2025-12-01');
    expect(corte).toBe('2025-11-17');
    const k = indicadoresPeriodo({ reservas, apartamentos: apts, inicio: '2025-12-01', fim: '2026-01-01', corte });
    expect(k.ritmo).toBe(1);
    expect(k.semData).toBe(1);
  });
  it('receita do mês: critério do Financeiro (check-in no mês, sem cortesia/bloqueio/cancelada)', () => {
    const reservas = [
      r('1', '2026-12-01', '2026-12-04', { total: 1000 }),
      r('2', '2026-12-30', '2027-01-04', { total: 2000 }),                 // check-in em dezembro: conta inteira
      r('3', '2026-11-28', '2026-12-03', { total: 500 }),                  // check-in em novembro: não conta
      r('4', '2026-12-10', '2026-12-12', { total: 700, status: 'cortesia' }),
      r('5', '2026-12-10', '2026-12-12', { total: 800, status: 'cancelada' }),
      r('6', '2026-12-15', '2026-12-18', { total: 300, status: 'pendente' }),
    ];
    expect(receitaPeriodo({ reservas, apartamentos: apts, inicio: '2026-12-01', fim: '2027-01-01' })).toBe(3300);
  });
  it('não altera as reservas recebidas', () => {
    const reservas = [r('1', '2026-12-01', '2026-12-04')];
    const copia = JSON.stringify(reservas);
    indicadoresPeriodo({ reservas, apartamentos: apts, inicio: '2026-12-01', fim: '2027-01-01', corte: '2026-11-17' });
    expect(JSON.stringify(reservas)).toBe(copia);
  });
});
