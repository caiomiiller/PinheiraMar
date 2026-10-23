import { describe, it, expect } from 'vitest';
import { isAvailable, ultimaSaidaPossivel } from '../src/lib/helpers.js';
import { validarPedido } from '../src/lib/reservas.js';
import { estado, reserva } from './fixtures.js';

const hojeOpts = { agora: Date.parse('2026-10-23T15:00:00Z'), hoje: '2026-10-23' };

// Entrada 13h, saída 10h: o dia em que uma estadia termina e o dia em que
// outra começa podem ser o mesmo — a ocupação conta NOITES, não dias.
const saiEm02 = reserva({ id: 'x1', apartamentoId: 'a1', checkIn: '2026-10-30', checkOut: '2026-11-02' });
const entraEm06 = reserva({ id: 'x2', apartamentoId: 'a1', checkIn: '2026-11-06', checkOut: '2026-11-09' });
const reservas = [saiEm02, entraEm06];

describe('saída e entrada no mesmo dia', () => {
  it('permite entrar no dia em que outra reserva sai e sair no dia em que outra entra', () => {
    expect(isAvailable(reservas, 'a1', '2026-11-02', '2026-11-06')).toBe(true);
  });
  it('não permite passar por cima de uma noite ocupada', () => {
    expect(isAvailable(reservas, 'a1', '2026-11-01', '2026-11-03')).toBe(false);
    expect(isAvailable(reservas, 'a1', '2026-11-05', '2026-11-07')).toBe(false);
  });
  it('vale para qualquer apartamento — um só ocupado não afeta o outro', () => {
    expect(isAvailable(reservas, 'a2', '2026-10-31', '2026-11-08')).toBe(true);
  });
  it('ultimaSaidaPossivel: a saída pode ser o dia em que a próxima reserva entra', () => {
    expect(ultimaSaidaPossivel(reservas, 'a1', '2026-11-02')).toBe('2026-11-06');
  });
  it('ultimaSaidaPossivel: sem reserva à frente não há limite', () => {
    expect(ultimaSaidaPossivel([saiEm02], 'a1', '2026-11-02', 30)).toBeNull();
    expect(ultimaSaidaPossivel(reservas, 'a2', '2026-11-02', 30)).toBeNull();
  });
  it('ultimaSaidaPossivel: reserva cancelada não limita', () => {
    const canc = [{ ...entraEm06, status: 'cancelada' }];
    expect(ultimaSaidaPossivel(canc, 'a1', '2026-11-02', 30)).toBeNull();
  });
  it('o servidor aceita o pedido de 02/11 a 06/11 encostado nas duas reservas', () => {
    const e = estado({ reservas, seasons: [{ id: 's', nome: 'T', inicio: '2026-11-01', fim: '2027-03-31', ativa: true, minNoites: 2, maxNoites: 30,
      precos: { a1: { diaSemana: 300, fimSemana: 360 }, a2: { diaSemana: 280, fimSemana: 320 } } }] });
    const v = validarPedido(e, { itens: [{ apartamentoId: 'a1', hospedes: 2 }], checkIn: '2026-11-02', checkOut: '2026-11-06',
      hospede: { nome: 'Ana Souza', email: 'ana@exemplo.com', telefone: '48999990000' } }, hojeOpts);
    expect(v.ok).toBe(true);
    const v2 = validarPedido(e, { itens: [{ apartamentoId: 'a1', hospedes: 2 }], checkIn: '2026-11-02', checkOut: '2026-11-07',
      hospede: { nome: 'Ana Souza', email: 'ana@exemplo.com', telefone: '48999990000' } }, hojeOpts);
    expect(v2.erro).toBe('indisponivel');
  });
});
