import { describe, it, expect } from 'vitest';
import { estadoPublico } from '../src/lib/publico.js';
import { estado, reserva, HOJE, AGORA } from './fixtures.js';

describe('estadoPublico', () => {
  const e = estado({ reservas: [
    reserva({ id: '1', checkIn: '2027-01-10', checkOut: '2027-01-13' }),
    reserva({ id: '2', status: 'cancelada' }),
    reserva({ id: '3', status: 'pendente', expiraEm: '2026-11-20T14:00:00Z' }),
    reserva({ id: '4', status: 'pendente', expiraEm: '2026-11-20T16:00:00Z', checkIn: '2027-02-01', checkOut: '2027-02-03' }),
    reserva({ id: '5', checkIn: '2025-01-01', checkOut: '2025-01-05' }),
  ] });
  const p = estadoPublico(e, HOJE, AGORA);
  it('não leva dados pessoais, cupões nem meios de pagamento', () => {
    const txt = JSON.stringify(p);
    for (const proibido of ['maria@exemplo.com', 'Maria', '48999990000', 'PM-TESTE', 'SEGREDO10', 'exemplo.com/chave']) {
      expect(txt).not.toContain(proibido);
    }
    expect(p.cupons).toBeUndefined();
    expect(p.pagamentos).toBeUndefined();
    for (const r of p.reservas) expect(Object.keys(r).sort()).toEqual(expect.arrayContaining(['apartamentoId', 'checkIn', 'checkOut', 'status']));
  });
  it('só as reservas que ainda ocupam datas', () => {
    expect(p.reservas.map(r => r.checkIn)).toEqual(['2027-01-10', '2027-02-01']);
    expect(p.reservas[1]).toMatchObject({ status: 'pendente', expiraEm: '2026-11-20T16:00:00Z' });
  });
});

describe('disponibilidade no site público (reservas sem id)', () => {
  it('as datas ocupadas aparecem como ocupadas', async () => {
    const { isAvailable } = await import('../src/lib/helpers.js');
    const e = estado({ reservas: [reserva({ id: 'x', apartamentoId: 'a1', checkIn: '2026-12-10', checkOut: '2026-12-15' })] });
    const pub = estadoPublico(e, HOJE, AGORA);
    expect(isAvailable(pub.reservas, 'a1', '2026-12-11', '2026-12-13')).toBe(false);
    expect(isAvailable(pub.reservas, 'a1', '2026-12-15', '2026-12-17')).toBe(true);
    expect(isAvailable(pub.reservas, 'a2', '2026-12-11', '2026-12-13')).toBe(true);
  });
});

import { linkParaRepagar } from '../src/lib/dadosPublico.js';
describe('tentar pagar de novo (link do Mercado Pago ainda válido)', () => {
  const criado = Date.parse('2027-01-05T12:00:00Z');
  const info = { initPoint: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123', guardadoEm: criado };
  it('devolve o link enquanto a janela de pagamento não fechou', () => {
    const r = linkParaRepagar(info, criado + 5 * 60000);
    expect(r.url).toBe(info.initPoint);
    expect(r.ate).toBe(criado + 19 * 60000); // 20 min de janela − 1 min de folga
  });
  it('não devolve depois do prazo', () => {
    expect(linkParaRepagar(info, criado + 19 * 60000)).toBeNull();
    expect(linkParaRepagar(info, criado + 60 * 60000)).toBeNull();
  });
  it('não devolve sem link, sem hora ou com endereço que não é do Mercado Pago', () => {
    expect(linkParaRepagar({ guardadoEm: criado }, criado)).toBeNull();
    expect(linkParaRepagar({ initPoint: info.initPoint }, criado)).toBeNull();
    expect(linkParaRepagar({ ...info, initPoint: 'https://mercadopago.com.br.exemplo.com/x' }, criado)).toBeNull();
    expect(linkParaRepagar({ ...info, initPoint: 'http://www.mercadopago.com.br/x' }, criado)).toBeNull();
    expect(linkParaRepagar({ ...info, initPoint: 'javascript:alert(1)' }, criado)).toBeNull();
    expect(linkParaRepagar(null, criado)).toBeNull();
  });
});
