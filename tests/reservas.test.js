import { describe, it, expect } from 'vitest';
import { validarHospede, validarPedido, montarReservas, provisoriaParaLimpar, aplicarEdicaoReserva,
  ultimaNoiteReservavel, hojeISO, gerarCodigo } from '../src/lib/reservas.js';
import { estado, reserva, HOJE, AGORA } from './fixtures.js';

const pedido = (extra = {}) => ({
  itens: [{ apartamentoId: 'a1', hospedes: 2 }], checkIn: '2027-01-10', checkOut: '2027-01-13',
  hospede: { nome: 'Ana Souza', email: 'ana@exemplo.com', telefone: '(48) 99999-0000' }, ...extra,
});
const opts = { agora: AGORA, hoje: HOJE };

describe('dados do hóspede', () => {
  it('pede nome, e-mail e telefone válidos', () => {
    expect(validarHospede({ nome: 'Ana Souza', email: 'ana@exemplo.com', telefone: '48 99999-0000' }).ok).toBe(true);
    expect(validarHospede({ nome: 'A', email: 'x', telefone: '12' }).erros).toEqual({ nome: 'nome', email: 'email', telefone: 'telefone' });
  });
});

describe('validarPedido', () => {
  it('aceita um pedido normal', () => {
    const v = validarPedido(estado(), pedido(), opts);
    expect(v.ok).toBe(true);
    expect(v.noites).toBe(3);
  });
  it.each([
    [{ checkIn: '2027-02-30', checkOut: '2027-03-02' }, 'datas_invalidas'],
    [{ checkIn: '2027-01-13', checkOut: '2027-01-10' }, 'datas_invalidas'],
    [{ checkIn: '2026-11-01', checkOut: '2026-11-05' }, 'data_passada'],
    [{ checkIn: '2027-03-30', checkOut: '2027-04-03' }, 'datas_fechadas'],
    [{ checkIn: '2027-01-10', checkOut: '2027-01-11' }, 'minimo_noites'],
    [{ itens: [{ apartamentoId: 'a1', hospedes: 5 }] }, 'capacidade'],
    [{ itens: [{ apartamentoId: 'zz', hospedes: 2 }] }, 'apartamento_inexistente'],
    [{ itens: [{ apartamentoId: 'a1', hospedes: 2 }, { apartamentoId: 'a1', hospedes: 2 }] }, 'apartamentos_invalidos'],
  ])('recusa %o com %s', (p, erro) => {
    expect(validarPedido(estado(), pedido(p), opts).erro).toBe(erro);
  });
  it('recusa datas já ocupadas, mas aceita entrar no dia em que outro sai', () => {
    const e = estado({ reservas: [reserva({ checkIn: '2027-01-05', checkOut: '2027-01-10' })] });
    expect(validarPedido(e, pedido(), opts).ok).toBe(true);
    const e2 = estado({ reservas: [reserva({ checkIn: '2027-01-11', checkOut: '2027-01-12' })] });
    expect(validarPedido(e2, pedido(), opts).erro).toBe('indisponivel');
  });
  it('provisória vencida não bloqueia; cancelada também não', () => {
    const e = estado({ reservas: [
      reserva({ status: 'pendente', expiraEm: '2026-11-20T14:00:00Z' }),
      reserva({ status: 'cancelada' }),
    ] });
    expect(validarPedido(e, pedido(), opts).ok).toBe(true);
  });
  it('a pesquisa com mais pessoas exige a capacidade somada', () => {
    expect(validarPedido(estado(), pedido({ hospedesPesquisa: 8 }), opts).erro).toBe('capacidade');
  });
  it('última noite reservável = fim da última temporada real', () => {
    expect(ultimaNoiteReservavel(estado().seasons, HOJE)).toBe('2027-03-31');
  });
  it('"hoje" é o de Brasília', () => {
    expect(hojeISO(new Date('2026-11-21T02:30:00Z'))).toBe('2026-11-20');
  });
});

describe('montarReservas', () => {
  it('reserva conjunta: duas reservas presas ao mesmo pagamento, sinal só na 1ª', () => {
    const e = estado();
    const p = pedido({ itens: [{ apartamentoId: 'a1', hospedes: 4 }, { apartamentoId: 'a2', hospedes: 3 }] });
    const v = validarPedido(e, p, opts);
    const m = montarReservas(e, p, v, { agoraISO: new Date(AGORA).toISOString(), hoje: HOJE });
    const [r1, r2] = m.reservas;
    expect(r1.pagamentoRef).toBe(r1.id);
    expect(r2.pagamentoRef).toBe(r1.id);
    expect(r1.sinal).toBe(m.sinal);
    expect(r2.sinal).toBe(0);
    expect(r2.codigo).toBe(r1.codigo + '-B');
    expect(r1.total + r2.total).toBe(m.total);
    expect(r1.status).toBe('pendente');
    // o que se cobra: extras × qtd somam o total de cada metade
    const soma = (r) => r.precoTabela + r.extras.reduce((s, x) => s + x.qtd * x.preco, 0);
    expect(soma(r1)).toBe(r1.total);
    expect(soma(r2)).toBe(r2.total);
  });
  it('códigos novos não repetem os existentes', () => {
    let i = 0; const seq = [0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const c = gerarCodigo(new Set(['PM-222222']), () => seq[i++ % seq.length]);
    expect(c).not.toBe('PM-222222');
  });
});

describe('arrumação de provisórias', () => {
  const agora = Date.parse('2026-11-22T12:00:00Z');
  it('apaga só a provisória vencida há mais de 24 h e sem pagamento', () => {
    expect(provisoriaParaLimpar(reserva({ status: 'pendente', expiraEm: '2026-11-20T10:00:00Z' }), agora)).toBe(true);
    expect(provisoriaParaLimpar(reserva({ status: 'pendente', expiraEm: '2026-11-22T10:00:00Z' }), agora)).toBe(false);
    expect(provisoriaParaLimpar(reserva({ status: 'pendente', expiraEm: '2026-11-20T10:00:00Z', valorPago: 10 }), agora)).toBe(false);
    expect(provisoriaParaLimpar(reserva({ status: 'pendente', expiraEm: '2026-11-20T10:00:00Z', pagamentoDivergente: { pago: 1 } }), agora)).toBe(false);
    expect(provisoriaParaLimpar(reserva({ status: 'pendente' }), agora)).toBe(false);
  });
});

describe('aplicarEdicaoReserva (painel)', () => {
  it('não apaga a confirmação do Mercado Pago chegada com o formulário aberto', () => {
    const original = reserva({ id: 'x', status: 'pendente', expiraEm: '2026-11-20T15:30:00Z', pagamentoRef: 'x', registrosPagamento: [] , nota: '' });
    const fresca = { ...original, status: 'reservado', expiraEm: null, pagamentoMpId: '123',
      registrosPagamento: [{ id: 'mp1', descricao: 'Pagamento via Mercado Pago (sinal)', valor: 500 }], valorPago: 500 };
    const editada = { ...original, nota: 'Chega tarde' };
    const r = aplicarEdicaoReserva(fresca, original, editada);
    expect(r.status).toBe('reservado');
    expect(r.valorPago).toBe(500);
    expect(r.registrosPagamento).toHaveLength(1);
    expect(r.nota).toBe('Chega tarde');
    expect(r.pagamentoRef).toBe('x');
    expect(r.pagamentoMpId).toBe('123');
  });
  it('junta pagamentos: o novo do gestor entra, o do servidor fica, o removido sai', () => {
    const a = { id: 'a', valor: 100 }, b = { id: 'b', valor: 50 };
    const original = reserva({ id: 'y', registrosPagamento: [a, b], valorPago: 150 });
    const fresca = { ...original, registrosPagamento: [a, b, { id: 'mp', valor: 200 }], valorPago: 350 };
    const editada = { ...original, registrosPagamento: [a, { id: 'n', valor: 30 }], valorPago: 130 };
    const r = aplicarEdicaoReserva(fresca, original, editada);
    expect(r.registrosPagamento.map(x => x.id)).toEqual(['a', 'mp', 'n']);
    expect(r.valorPago).toBe(330);
  });
  it('mexer numa provisória do site torna-a pendente manual (sem prazo), como antes', () => {
    const original = reserva({ id: 'z', status: 'pendente', expiraEm: '2026-11-20T15:30:00Z' });
    const r = aplicarEdicaoReserva(original, original, { ...original, telefone: '48988887777' });
    expect(r.expiraEm).toBeNull();
    expect(r.status).toBe('pendente');
  });
  it('sem mudanças devolve a versão do banco intacta', () => {
    const original = reserva({ id: 'w' });
    const fresca = { ...original, emailEnviadoEm: '2026-11-20T15:00:00Z' };
    expect(aplicarEdicaoReserva(fresca, original, { ...original })).toBe(fresca);
  });
});

describe('pendentesDoHospede', () => {
  it('conta as reservas do site à espera de pagamento do mesmo e-mail ou telefone', async () => {
    const { pendentesDoHospede } = await import('../src/lib/reservas.js');
    const agora = Date.parse('2026-11-20T15:00:00Z');
    const rs = [
      reserva({ id: 'a', status: 'pendente', origem: 'Site', email: 'Ana@Exemplo.com', expiraEm: '2026-11-20T15:20:00Z' }),
      reserva({ id: 'b', status: 'pendente', origem: 'Site', email: 'outra@exemplo.com', telefone: '(48) 99999-0000' }),
      reserva({ id: 'c', status: 'pendente', origem: 'Site', email: 'ana@exemplo.com', expiraEm: '2026-11-20T14:00:00Z' }), // vencida
      reserva({ id: 'd', status: 'reservado', origem: 'Site', email: 'ana@exemplo.com' }),
      reserva({ id: 'e', status: 'pendente', origem: 'Manual', email: 'ana@exemplo.com' }),
    ];
    expect(pendentesDoHospede(rs, { email: 'ana@exemplo.com', telefone: '48 99999-0000' }, agora)).toBe(2);
    expect(pendentesDoHospede(rs, { email: 'nova@exemplo.com', telefone: '11 90000-0000' }, agora)).toBe(0);
  });
});
