import { describe, it, expect } from 'vitest';
import { aplicarDesfechoPagamento, datasEmConflito } from '../api/mp-webhook.js';
import { reserva } from './fixtures.js';

const AGORA = '2026-11-20T15:10:00.000Z';
const conjunta = () => [
  reserva({ id: 'p1', status: 'pendente', sinal: 600, total: 1200, pagamentoRef: 'p1', expiraEm: '2026-11-20T15:30:00Z' }),
  reserva({ id: 'p2', apartamentoId: 'a2', status: 'pendente', sinal: 0, total: 1000, pagamentoRef: 'p1', expiraEm: '2026-11-20T15:30:00Z' }),
  reserva({ id: 'outra', status: 'confirmado' }),
];

describe('aplicarDesfechoPagamento', () => {
  it('aprovado: confirma as duas metades e regista o pagamento só na principal', () => {
    const d = aplicarDesfechoPagamento(conjunta(), 'p1', { id: 99, status: 'approved', transaction_amount: 600 }, AGORA);
    const [a, b] = d.reservas;
    expect(d.confirmadas).toEqual(['p1', 'p2']);
    expect(a.status).toBe('reservado');
    expect(b.status).toBe('reservado');
    expect(a.valorPago).toBe(600);
    expect(b.valorPago).toBe(0);
    expect(a.expiraEm).toBeNull();
  });
  it('pagou menos do que o sinal: não confirma e sinaliza', () => {
    const d = aplicarDesfechoPagamento(conjunta(), 'p1', { id: 99, status: 'approved', transaction_amount: 10 }, AGORA);
    expect(d.divergente).toBe(true);
    expect(d.confirmadas).toEqual([]);
    expect(d.reservas[0].status).toBe('pendente');
    expect(d.reservas[0].pagamentoDivergente).toMatchObject({ esperado: 600, pago: 10 });
  });
  it('recusado: liberta as datas já', () => {
    const d = aplicarDesfechoPagamento(conjunta(), 'p1', { id: 7, status: 'rejected' }, AGORA);
    expect(d.reservas[0].expiraEm).toBe(AGORA);
    expect(d.reservas[0].status).toBe('pendente');
  });
  it('o mesmo aviso duas vezes não regista o pagamento em dobro', () => {
    const p = { id: 99, status: 'approved', transaction_amount: 600 };
    const d1 = aplicarDesfechoPagamento(conjunta(), 'p1', p, AGORA);
    const d2 = aplicarDesfechoPagamento(d1.reservas, 'p1', p, AGORA);
    expect(d2.mudou).toBe(false);
    expect(d2.reservas[0].registrosPagamento).toHaveLength(1);
  });
  it('estorno fica sinalizado', () => {
    const d1 = aplicarDesfechoPagamento(conjunta(), 'p1', { id: 99, status: 'approved', transaction_amount: 600 }, AGORA);
    const d2 = aplicarDesfechoPagamento(d1.reservas, 'p1', { id: 99, status: 'refunded' }, AGORA);
    expect(d2.reservas[0].pagamentoEstornado).toMatchObject({ status: 'refunded', mpId: '99' });
  });
  it('reserva que não existe: nada muda', () => {
    const d = aplicarDesfechoPagamento(conjunta(), 'nao-existe', { id: 1, status: 'approved', transaction_amount: 5 }, AGORA);
    expect(d.alvos).toEqual([]);
    expect(d.mudou).toBe(false);
  });
  it('datasEmConflito deteta sobreposição com outra reserva ativa', () => {
    const rs = [reserva({ id: 'a', checkIn: '2027-01-10', checkOut: '2027-01-13' }), reserva({ id: 'b', checkIn: '2027-01-12', checkOut: '2027-01-15' })];
    expect(datasEmConflito(rs, rs[0])).toBe(true);
    expect(datasEmConflito([rs[0], { ...rs[1], status: 'cancelada' }], rs[0])).toBe(false);
  });
});

describe('avisos repetidos e casos de borda', () => {
  const pago = (v) => ({ id: 77, status: 'approved', transaction_amount: v });
  it('pagamento a menos avisado várias vezes não soma o valor de novo', () => {
    const d1 = aplicarDesfechoPagamento(conjunta(), 'p1', pago(100), AGORA);
    const d2 = aplicarDesfechoPagamento(d1.reservas, 'p1', pago(100), AGORA);
    const d3 = aplicarDesfechoPagamento(d2.reservas, 'p1', pago(100), AGORA);
    expect(d1.divergente).toBe(true);
    expect(d3.reservas[0].valorPago).toBe(100);
    expect(d3.reservas[0].registrosPagamento).toHaveLength(1);
    expect(d2.mudou).toBe(false);
  });
  it('pagamento a menos: não confirma, mas as datas ficam seguras (sem prazo)', () => {
    const d = aplicarDesfechoPagamento(conjunta(), 'p1', pago(100), AGORA);
    expect(d.reservas[0].status).toBe('pendente');
    expect(d.reservas[0].expiraEm).toBeNull();
    expect(d.reservas[1].expiraEm).toBeNull();
  });
  it('confere contra o valor cobrado no link, mesmo que o sinal tenha sido mexido no painel', () => {
    const rs = conjunta().map(r => (r.id === 'p1' ? { ...r, mpValorCobrado: 600, sinal: 1100 } : { ...r, sinal: 488 }));
    const d = aplicarDesfechoPagamento(rs, 'p1', pago(600), AGORA);
    expect(d.divergente).toBe(false);
    expect(d.confirmadas).toEqual(['p1', 'p2']);
  });
  it('recusado numa reserva que o gestor já assumiu (sem prazo) não liberta as datas', () => {
    const rs = [reserva({ id: 'm1', status: 'pendente', sinal: 500, pagamentoRef: 'm1' })];
    const d = aplicarDesfechoPagamento(rs, 'm1', { id: 5, status: 'rejected' }, AGORA);
    expect(d.reservas[0].expiraEm).toBeUndefined();
    expect(d.reservas[0].pagamentoStatus).toBe('rejected');
    const d2 = aplicarDesfechoPagamento(d.reservas, 'm1', { id: 5, status: 'rejected' }, AGORA);
    expect(d2.mudou).toBe(false);
  });
});
