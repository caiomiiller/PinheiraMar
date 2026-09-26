// Dados de teste pequenos e fictícios (nenhum dado real de hóspedes).
export const apt = (id, extra = {}) => ({
  id, nome: `Apto ${id}`, residencialId: 'r1', capacidade: 4, capacidadeBase: 4,
  preco: 200, precoFimSemana: 250, ativo: true, piso: 'Térreo', vista: 'Frente Mar', ...extra,
});

export const temporada = (extra = {}) => ({
  id: 's1', nome: 'Verão', inicio: '2026-12-01', fim: '2027-03-31', ativa: true, minNoites: 2, maxNoites: 30,
  precos: { a1: { diaSemana: 300, fimSemana: 360 }, a2: { diaSemana: 280, fimSemana: 320, adultoExtra: 50 } },
  ...extra,
});

export const taxas = () => ([
  { id: 'tx1', nome: 'Limpeza', tipo: 'obrigatoria', por: 'reserva', preco: 175 },
  { id: 'tx2', nome: 'Estacionamento', tipo: 'obrigatoria', por: 'noite', preco: 20 },
  { id: 'tx3', nome: 'Pet', tipo: 'opcional', por: 'reserva', preco: 200 },
  { id: 'tx4', nome: 'Kit praia', tipo: 'opcional', por: 'noite', preco: 10 },
]);

export const estado = (extra = {}) => ({
  versaoDados: 99,
  residenciais: [{ id: 'r1', nome: 'Residencial Teste', sinalPct: 50, checkInHora: '13:00', checkOutHora: '10:00', email: 'contato@exemplo.com', telefone: '(48) 0000-0000' }],
  apartamentos: [apt('a1'), apt('a2', { capacidade: 6 })],
  seasons: [temporada()],
  taxasAdicionais: taxas(),
  reservas: [],
  cupons: [{ id: 'c1', codigo: 'SEGREDO10' }],
  pagamentos: [{ id: 'p1', nome: 'Pix', link: 'https://exemplo.com/chave' }],
  ...extra,
});

export const reserva = (extra = {}) => ({
  id: 'r' + Math.random().toString(36).slice(2, 8), codigo: 'PM-TESTE', apartamentoId: 'a1',
  checkIn: '2027-01-10', checkOut: '2027-01-13', status: 'confirmado',
  nome: 'Maria', sobrenome: 'Teste', hospede: 'Maria Teste', email: 'maria@exemplo.com', telefone: '48999990000',
  adultos: 2, criancas: 0, hospedes: 2, total: 1000, sinal: 500, valorPago: 0, extras: [], ...extra,
});

// Um "hoje" fixo antes da temporada, para os testes não dependerem do relógio.
export const HOJE = '2026-11-20';
export const AGORA = Date.parse('2026-11-20T15:00:00Z');
