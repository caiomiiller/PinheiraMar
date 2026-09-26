import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { estado, reserva } from './fixtures.js';

// Banco em memória com a mesma interface de server/estado.js
const banco = { estado: null, escritas: 0 };
vi.mock('../server/estado.js', () => ({
  alterarEstado: async (fn) => {
    const r = (await fn(structuredClone(banco.estado))) || {};
    if (!r.estado) return { gravado: false, resultado: r.resultado, estado: banco.estado };
    banco.estado = structuredClone(r.estado); banco.escritas++;
    return { gravado: true, resultado: r.resultado, estado: banco.estado };
  },
}));
const mp = { configurado: false, pref: { ok: true, initPoint: 'https://mp.exemplo/checkout/1' }, chamadas: [] };
vi.mock('../server/mercadopago.js', () => ({
  mpConfigurado: () => mp.configurado,
  criarPreferencia: async (d) => { mp.chamadas.push(d); return mp.pref; },
}));
const mail = { envios: [], registos: [] };
vi.mock('../server/email.js', () => ({
  enviarConfirmacao: async (grupo) => { mail.envios.push(grupo); return { ok: true }; },
  registarEnvio: async (ids) => { mail.registos.push(ids); return true; },
}));
const { default: handler } = await import('../api/reservar.js');

function chamar(body) {
  const res = { statusCode: 0, headers: {}, corpo: null,
    setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(o) { this.corpo = o; return this; } };
  return handler({ method: 'POST', body, headers: { host: 'localhost:3000' } }, res).then(() => res);
}
const pedido = (extra = {}) => ({
  itens: [{ apartamentoId: 'a1', hospedes: 2 }], checkIn: '2027-01-10', checkOut: '2027-01-13',
  hospede: { nome: 'Ana Souza', email: 'ana@exemplo.com', telefone: '(48) 99999-0000' }, idioma: 'pt', ...extra,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-20T15:00:00Z'));
  banco.estado = estado(); banco.escritas = 0;
  mp.configurado = false; mp.chamadas = []; mail.envios = []; mail.registos = [];
});
afterEach(() => vi.useRealTimers());

describe('POST /api/reservar', () => {
  it('fluxo manual: cria a reserva com o preço do servidor e envia o e-mail', async () => {
    const res = await chamar(pedido({ totalEsperado: null }));
    expect(res.statusCode).toBe(200);
    expect(res.corpo.ok).toBe(true);
    const [r] = banco.estado.reservas;
    expect(r).toMatchObject({ apartamentoId: 'a1', status: 'pendente', origem: 'Site', email: 'ana@exemplo.com' });
    expect(r.total).toBe(res.corpo.total);
    expect(r.sinal).toBe(Math.round(r.total / 2));
    expect(r.expiraEm).toBeUndefined();
    expect(mail.envios).toHaveLength(1);
    expect(mail.registos).toEqual([[r.id]]);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
  it('reserva conjunta grava as duas metades de uma vez, presas ao mesmo pagamento', async () => {
    const res = await chamar(pedido({ itens: [{ apartamentoId: 'a1', hospedes: 4 }, { apartamentoId: 'a2', hospedes: 4 }], hospedesPesquisa: 8 }));
    expect(res.statusCode).toBe(200);
    expect(banco.escritas).toBe(1);
    const [r1, r2] = banco.estado.reservas;
    expect(r2.pagamentoRef).toBe(r1.id);
    expect(mail.envios[0]).toHaveLength(2); // um e-mail só, com os dois apartamentos
  });
  it('datas ocupadas: 409 e nada é gravado', async () => {
    banco.estado.reservas.push(reserva({ checkIn: '2027-01-12', checkOut: '2027-01-15' }));
    const res = await chamar(pedido());
    expect(res.statusCode).toBe(409);
    expect(res.corpo.erro).toBe('indisponivel');
    expect(banco.escritas).toBe(0);
  });
  it('preço mudou entre o ecrã e o servidor: 409 preco_mudou com o valor novo', async () => {
    const res = await chamar(pedido({ totalEsperado: 1 }));
    expect(res.statusCode).toBe(409);
    expect(res.corpo.erro).toBe('preco_mudou');
    expect(res.corpo.total).toBeGreaterThan(1);
    expect(banco.escritas).toBe(0);
  });
  it('dados do hóspede inválidos: 422 com os campos', async () => {
    const res = await chamar(pedido({ hospede: { nome: 'A', email: 'x', telefone: '1' } }));
    expect(res.statusCode).toBe(422);
    expect(Object.keys(res.corpo.campos).sort()).toEqual(['email', 'nome', 'telefone']);
  });
  it('robô (campo-isca preenchido): 400', async () => {
    expect((await chamar(pedido({ website: 'http://spam' }))).statusCode).toBe(400);
  });
  it('com Mercado Pago: cobra o sinal calculado aqui e a reserva passa a provisória com prazo', async () => {
    mp.configurado = true;
    const res = await chamar(pedido());
    expect(res.statusCode).toBe(200);
    expect(res.corpo.initPoint).toBe('https://mp.exemplo/checkout/1');
    const [r] = banco.estado.reservas;
    expect(mp.chamadas[0]).toMatchObject({ reservaId: r.id, valor: r.sinal, base: 'http://localhost:3000' });
    expect(r.expiraEm).toBe('2026-11-20T15:30:00.000Z');
    expect(r.pagamentoRef).toBe(r.id);
    expect(mail.envios).toHaveLength(0); // o e-mail sai quando o pagamento for aprovado
  });
  it('Mercado Pago fora do ar: a reserva fica como manual (segura as datas) e o e-mail sai', async () => {
    mp.configurado = true; mp.pref = { ok: false, motivo: 'rede' };
    const res = await chamar(pedido());
    expect(res.statusCode).toBe(200);
    expect(res.corpo.pagamentoOnline).toBe(false);
    expect(banco.estado.reservas[0].expiraEm).toBeUndefined();
    expect(mail.envios).toHaveLength(1);
    mp.pref = { ok: true, initPoint: 'https://mp.exemplo/checkout/1' };
  });
});

describe('POST /api/reservar — casos da revisão', () => {
  it('com Mercado Pago: grava uma vez só, já com prazo e o valor que vai ser cobrado', async () => {
    mp.configurado = true;
    const res = await chamar(pedido());
    expect(res.statusCode).toBe(200);
    expect(banco.escritas).toBe(1);
    const [r] = banco.estado.reservas;
    expect(r.mpValorCobrado).toBe(r.sinal);
    expect(r.expiraEm).toBe('2026-11-20T15:30:00.000Z');
  });
  it('sinal diferente do que o hóspede viu: 409 preco_mudou', async () => {
    const res = await chamar(pedido({ sinalEsperado: 1 }));
    expect(res.statusCode).toBe(409);
    expect(res.corpo.erro).toBe('preco_mudou');
    expect(banco.escritas).toBe(0);
  });
  it('mais de 3 reservas à espera de pagamento para o mesmo hóspede: 429', async () => {
    mp.configurado = true;
    for (const [ci, co] of [['2027-01-10', '2027-01-13'], ['2027-01-14', '2027-01-17'], ['2027-01-18', '2027-01-21']]) {
      expect((await chamar(pedido({ checkIn: ci, checkOut: co }))).statusCode).toBe(200);
    }
    const res = await chamar(pedido({ checkIn: '2027-01-22', checkOut: '2027-01-25' }));
    expect(res.statusCode).toBe(429);
    expect(res.corpo.erro).toBe('muitas_pendentes');
  });
  it('Mercado Pago fora do ar: tira o prazo e o valor do link antes de prometer a reserva', async () => {
    mp.configurado = true; mp.pref = { ok: false, motivo: 'rede' };
    const res = await chamar(pedido());
    expect(res.statusCode).toBe(200);
    const [r] = banco.estado.reservas;
    expect(r.expiraEm).toBeUndefined();
    expect(r.mpValorCobrado).toBeUndefined();
    expect(mail.envios[0][0].reserva.expiraEm).toBeUndefined();
    mp.pref = { ok: true, initPoint: 'https://mp.exemplo/checkout/1' };
  });
});
