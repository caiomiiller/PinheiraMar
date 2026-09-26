import { describe, it, expect } from 'vitest';
import { parametrosEmail } from '../server/email.js';
import { reserva } from './fixtures.js';

const residencial = { nome: 'Residencial Teste', sinalPct: 50, checkInHora: '13:00', checkOutHora: '10:00', telefone: '(48) 0000-0000' };
const apt = (nome) => ({ nome, vista: 'Frente Mar' });

describe('parametrosEmail', () => {
  it('sinal pago → "Reserva confirmada!" e o valor pago', () => {
    const p = parametrosEmail([{ reserva: reserva({ total: 1000, sinal: 500, valorPago: 500 }), apt: apt('Apto 1') }], residencial);
    expect(p.titulo).toBe('Reserva confirmada!');
    expect(p.rotulo_sinal).toBe('Sinal pago (50%)');
    expect(p.restante_fmt.replace(/\s/g, ' ')).toBe('R$ 500,00');
    expect(p.horarios).toBe('Check-in a partir das 13:00 · check-out até 10:00');
  });
  it('fluxo manual (sem pagamento) → "Reserva recebida" e sinal a pagar', () => {
    const p = parametrosEmail([{ reserva: reserva({ total: 1000, sinal: 500, valorPago: 0 }), apt: apt('Apto 1') }], residencial);
    expect(p.titulo).toBe('Reserva recebida');
    expect(p.rotulo_sinal).toBe('Sinal a pagar (50%)');
    expect(p.mensagem).toMatch(/falta o pagamento do sinal/);
  });
  it('reserva conjunta: um e-mail com os dois apartamentos e o total combinado', () => {
    const p = parametrosEmail([
      { reserva: reserva({ total: 1200, sinal: 1100, valorPago: 1100, adultos: 4 }), apt: apt('Apto 1') },
      { reserva: reserva({ total: 1000, sinal: 0, valorPago: 0, adultos: 3 }), apt: apt('Apto 2') },
    ], residencial);
    expect(p.apartamento).toBe('Apto 1 · Frente Mar + Apto 2 · Frente Mar');
    expect(p.total_fmt.replace(/\s/g, ' ')).toBe('R$ 2.200,00');
    expect(p.hospedes_txt).toBe('7 pessoas');
    expect(p.restante_fmt.replace(/\s/g, ' ')).toBe('R$ 1.100,00');
  });
});
