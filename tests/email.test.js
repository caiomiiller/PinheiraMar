import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
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
  it('leva a logo do residencial do apartamento, com o endereço completo', () => {
    const antes = process.env.SITE_URL; delete process.env.SITE_URL;
    try {
      const r = reserva({ total: 1000, sinal: 500, valorPago: 500 });
      const p1 = parametrosEmail([{ reserva: r, apt: apt('Apto 1') }], { ...residencial, id: 'pinheiramar' }, { site: 'https://exemplo.vercel.app/' });
      expect(p1.logo_residencial).toBe('https://exemplo.vercel.app/brand/pinheiramar-horizontal.png');
      expect(p1.logo_largura).toBe('200');
      const p2 = parametrosEmail([{ reserva: r, apt: apt('Apto 01') }], { ...residencial, id: 'novoimovel' });
      expect(p2.logo_residencial).toBe('https://pinheira-mar.vercel.app/brand/caminho-horizontal.png');
      expect(p2.logo_largura).toBe('252');
      process.env.SITE_URL = 'https://www.exemplo.com.br/';
      const p3 = parametrosEmail([{ reserva: r, apt: apt('Apto 1') }], { ...residencial, id: 'pinheiramar' }, { site: 'https://outro.vercel.app' });
      expect(p3.logo_residencial).toBe('https://www.exemplo.com.br/brand/pinheiramar-horizontal.png');
    } finally {
      if (antes === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = antes;
    }
  });
  it('toda variável do template é enviada pelo servidor, e o template diz onde se retiram as chaves', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../template-emailjs-confirmacao.html'), 'utf8');
    const usadas = [...new Set([...html.matchAll(/{{\s*([a-z_]+)\s*}}/g)].map(m => m[1]))];
    const p = parametrosEmail([{ reserva: reserva({ total: 1000, sinal: 500, valorPago: 500 }), apt: apt('Apto 1') }], { ...residencial, id: 'pinheiramar' });
    expect(usadas.filter(v => !(v in p))).toEqual([]);
    expect(html).toMatch(/Retirada das chaves/);
    expect(html).toMatch(/Rua Dom Patrício, 82 - Enseada da Pinheira/);
    expect(html).toMatch(/api\.whatsapp\.com\/send\/\?phone=%2B5548984761800/);
  });
});
