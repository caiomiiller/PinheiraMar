// Regras de uma reserva feita pelo site — partilhadas entre o servidor
// (api/reservar.js, que é quem decide) e o modo de demonstração local.
// Funções puras: recebem o estado e devolvem o resultado, sem gravar nada.
//
// Porque existe: antes a reserva era montada no navegador do hóspede, com
// o preço e o sinal calculados lá, e gravada por cima do banco inteiro. Agora
// o navegador só pede; o servidor confere tudo isto contra os dados atuais:
// datas, capacidade, mínimo/máximo de noites, disponibilidade e preço.
import { isAvailable, holdExpirado, nights, parseYMD, addDays, ymd, isTarifaRapida } from './helpers.js';
import { orcamentoReserva, regraNoites, arred } from './precos.js';

export const LIMITES = { maxNoites: 60, maxApartamentos: 2, diasSemTemporada: 365 };
export const FUSO_RESIDENCIAIS = 'America/Sao_Paulo';

// "Hoje" no fuso dos residenciais (Brasília), não no relógio do aparelho de
// quem abre o site — um hóspede ou gestor fora do Brasil via o dia virar
// horas antes.
export function hojeISO(agora = new Date(), fuso = FUSO_RESIDENCIAIS) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
  } catch { return ymd(agora); }
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const soDigitos = (s) => String(s || '').replace(/\D/g, '');

export function validarHospede({ nome, email, telefone } = {}) {
  const erros = {};
  if (String(nome || '').trim().length < 3) erros.nome = 'nome';
  if (!RE_EMAIL.test(String(email || '').trim())) erros.email = 'email';
  const d = soDigitos(telefone);
  if (d.length < 8 || d.length > 15) erros.telefone = 'telefone';
  return { ok: Object.keys(erros).length === 0, erros };
}

// Última data em que ainda há temporada (real, ativa) cadastrada. Depois
// disso não há preço de temporada nem mínimo de noites definido — o site
// deixa de aceitar datas (antes aceitava a tarifa base, com mínimo de 1).
// Sem nenhuma temporada futura, abre um ano a partir de hoje.
export function ultimaNoiteReservavel(seasons = [], hoje) {
  const fins = (seasons || [])
    .filter(s => s && s.ativa !== false && !isTarifaRapida(s) && RE_DATA.test(s.fim || '') && s.fim >= hoje)
    .map(s => s.fim).sort();
  if (fins.length) return fins[fins.length - 1];
  return ymd(addDays(parseYMD(hoje), LIMITES.diasSemTemporada));
}

// Confere um pedido de reserva contra o estado atual. Devolve
// { ok: true, itens } ou { ok: false, erro, ... } — `erro` é um código curto
// que o site traduz para o hóspede.
export function validarPedido(estado, pedido, { agora = Date.now(), hoje = hojeISO(new Date(agora)) } = {}) {
  const { checkIn, checkOut } = pedido || {};
  const dataValida = (d) => RE_DATA.test(d || '') && ymd(parseYMD(d)) === d; // recusa 2026-02-30 e afins
  if (!dataValida(checkIn) || !dataValida(checkOut)) return { ok: false, erro: 'datas_invalidas' };
  const n = nights(checkIn, checkOut);
  if (!(n >= 1)) return { ok: false, erro: 'datas_invalidas' };
  if (n > LIMITES.maxNoites) return { ok: false, erro: 'estadia_longa', max: LIMITES.maxNoites };
  if (checkIn < hoje) return { ok: false, erro: 'data_passada' };
  const ultima = ultimaNoiteReservavel(estado.seasons, hoje);
  if (ymd(addDays(parseYMD(checkOut), -1)) > ultima) return { ok: false, erro: 'datas_fechadas', ate: ultima };

  const pedidos = (pedido.itens || []).filter(Boolean);
  if (!pedidos.length || pedidos.length > LIMITES.maxApartamentos) return { ok: false, erro: 'apartamentos_invalidos' };
  const ids = pedidos.map(i => i.apartamentoId);
  if (new Set(ids).size !== ids.length) return { ok: false, erro: 'apartamentos_invalidos' };

  // provisórias do site cujo prazo já passou (no relógio `agora`) não ocupam datas
  const ocupando = (estado.reservas || []).filter(r => !holdExpirado(r, agora));
  const itens = [];
  for (const p of pedidos) {
    const apt = (estado.apartamentos || []).find(a => a.id === p.apartamentoId);
    if (!apt || apt.ativo === false) return { ok: false, erro: 'apartamento_inexistente', apartamentoId: p.apartamentoId };
    const hospedes = Math.floor(Number(p.hospedes) || 0);
    if (hospedes < 1 || hospedes > (Number(apt.capacidade) || 0)) return { ok: false, erro: 'capacidade', apartamentoId: apt.id, max: apt.capacidade };
    if (!isAvailable(ocupando, apt.id, checkIn, checkOut)) return { ok: false, erro: 'indisponivel', apartamentoId: apt.id };
    itens.push({ apt, hospedes });
  }

  const regra = regraNoites(estado.seasons, checkIn);
  if (n < regra.min) return { ok: false, erro: 'minimo_noites', min: regra.min, temporada: regra.temporada?.nome || null };
  if (regra.max && n > regra.max) return { ok: false, erro: 'maximo_noites', max: regra.max, temporada: regra.temporada?.nome || null };

  // A procura pediu mais pessoas do que o 1º apartamento leva? Então tem
  // de haver 2º apartamento com lugar para todos (igual à regra do site).
  const pedidoHosp = Math.floor(Number(pedido.hospedesPesquisa) || 0);
  if (pedidoHosp > 0) {
    const cap = itens.reduce((s, it) => s + (Number(it.apt.capacidade) || 0), 0);
    if (cap < pedidoHosp) return { ok: false, erro: 'capacidade', max: cap };
  }
  return { ok: true, itens, noites: n };
}

// Códigos de reserva: 'PM-' + 6 caracteres sem os que se confundem ao ler
// ou ditar (0/O, 1/I/L) — ~1 bilião de combinações, e confere-se que não
// repete nenhum código já existente. Antes eram 4 caracteres, sem checagem.
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function gerarCodigo(existentes = new Set(), aleatorio = Math.random) {
  for (let t = 0; t < 50; t++) {
    let s = '';
    for (let i = 0; i < 6; i++) s += ALFABETO[Math.floor(aleatorio() * ALFABETO.length)];
    const c = 'PM-' + s;
    if (!existentes.has(c) && !existentes.has(c + '-B')) return c;
  }
  throw new Error('não foi possível gerar um código único');
}
export const novoId = (aleatorio = Math.random) =>
  Array.from({ length: 12 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(aleatorio() * 36)]).join('');

const residencialDe = (estado, apt) => (estado.residenciais || []).find(r => r.id === apt?.residencialId) || (estado.residenciais || [])[0] || {};

// Monta as reservas (1 ou 2) de um pedido já validado. `comPrazo` = vai
// passar pelo pagamento online: nasce provisória, com prazo, e as duas
// metades de uma reserva conjunta ficam presas ao mesmo pagamento.
export function montarReservas(estado, pedido, validacao, { agoraISO = new Date().toISOString(), hoje, comPrazo = false, prazoMin = 30, aleatorio = Math.random } = {}) {
  const { itens } = validacao;
  const res1 = residencialDe(estado, itens[0].apt);
  const orc = orcamentoReserva({
    itens, seasons: estado.seasons, taxas: estado.taxasAdicionais, checkIn: pedido.checkIn, checkOut: pedido.checkOut,
    opcionais: pedido.opcionais || [], sinalPct: res1.sinalPct ?? 50,
  });
  const existentes = new Set((estado.reservas || []).map(r => r.codigo));
  const codigo = gerarCodigo(existentes, aleatorio);
  const nome = String(pedido.hospede?.nome || '').trim().replace(/\s+/g, ' ');
  const [primeiro, ...resto] = nome.split(' ');
  const id1 = novoId(aleatorio);
  const expiraEm = comPrazo ? new Date(Date.parse(agoraISO) + prazoMin * 60000).toISOString() : undefined;
  const reservas = orc.partes.map((p, i) => {
    const o = p.orcamento;
    const outro = orc.partes[i === 0 ? 1 : 0];
    const r = {
      id: i === 0 ? id1 : novoId(aleatorio), codigo: i === 0 ? codigo : codigo + '-B',
      apartamentoId: p.apt.id, checkIn: pedido.checkIn, checkOut: pedido.checkOut,
      nome: primeiro || '', sobrenome: resto.join(' '), hospede: nome,
      email: String(pedido.hospede?.email || '').trim(), telefone: String(pedido.hospede?.telefone || '').trim(),
      pais: 'Brasil', adultos: p.hospedes, criancas: 0, hospedes: p.hospedes,
      precoNoite: Math.round(o.estadia / Math.max(1, o.noites)), precoTabela: o.estadia,
      extras: [...o.obrigatorios, ...o.opcionais].map(e => ({ id: novoId(aleatorio), taxaId: e.taxaId, nome: e.nome, tipo: e.tipo, por: e.por, qtd: e.qtd, preco: e.preco })),
      total: o.total, sinal: i === 0 ? orc.sinal : 0, valorPago: 0,
      status: 'pendente', origem: 'Site', checkinRealizado: false, checkoutRealizado: false, enviarEmail: true,
      nota: outro ? `Reserva conjunta com ${outro.apt.nome}` : '',
      criadoEm: hoje || agoraISO.slice(0, 10), idioma: pedido.idioma || 'pt',
    };
    if (comPrazo) { r.expiraEm = expiraEm; r.pagamentoRef = id1; }
    else if (orc.partes.length > 1) r.pagamentoRef = id1;
    return r;
  });
  return { reservas, total: orc.total, sinal: orc.sinal, orcamento: orc, residencial: res1 };
}

// Quantas reservas do site este hóspede (mesmo e-mail ou telefone) tem ainda
// à espera de pagamento — para travar pedidos em série (robôs, cliques
// repetidos) que prendiam datas e enviavam e-mails para qualquer endereço.
export const MAX_PENDENTES_POR_HOSPEDE = 3;
export function pendentesDoHospede(reservas = [], hospede = {}, agora = Date.now()) {
  const email = String(hospede.email || '').trim().toLowerCase();
  const tel = soDigitos(hospede.telefone);
  const hoje = hojeISO(new Date(agora));
  return (reservas || []).filter(r =>
    r && r.status === 'pendente' && r.origem === 'Site' && !holdExpirado(r, agora) && (r.checkOut || '') >= hoje
    && (r.pagamentoRef ? r.pagamentoRef === r.id : true) // conjunta conta uma vez
    && ((email && String(r.email || '').trim().toLowerCase() === email) || (tel.length >= 8 && soDigitos(r.telefone) === tel))).length;
}

// O que o site precisa para mostrar a confirmação ao próprio hóspede.
export const reservaParaHospede = (r) => ({
  id: r.id, codigo: r.codigo, apartamentoId: r.apartamentoId, checkIn: r.checkIn, checkOut: r.checkOut,
  hospede: r.hospede, email: r.email, hospedes: r.hospedes, total: r.total, sinal: r.sinal, status: r.status,
});

// Arrumação: provisórias do site que passaram do prazo há mais de 24 h e
// nunca receberam pagamento saem da lista. Nunca apaga uma que tenha
// qualquer registo de pagamento (valor pago, pagamento divergente, etc.).
export const HORAS_ATE_LIMPAR_PROVISORIA = 24;
export function provisoriaParaLimpar(r, agora = Date.now()) {
  if (r.status !== 'pendente' || !r.expiraEm) return false;
  const t = Date.parse(r.expiraEm);
  if (!Number.isFinite(t) || t > agora - HORAS_ATE_LIMPAR_PROVISORIA * 3600 * 1000) return false;
  const temPagamento = Number(r.valorPago) > 0 || (r.registrosPagamento || []).length > 0 || r.pagamentoDivergente || r.pagamentoStatus === 'approved';
  return !temPagamento;
}
// Aplica a edição feita no painel sobre a versão MAIS RECENTE da reserva
// (`fresca`, lida do banco no momento de gravar). Só entram os campos que o
// gestor mudou em relação ao que ele abriu (`original`) — o resto fica como
// está no banco. Antes a reserva inteira era substituída pela cópia do
// ecrã, o que apagava, por exemplo, a confirmação do Mercado Pago chegada
// com o formulário aberto e a ligação entre as duas metades de uma reserva
// conjunta (`pagamentoRef`, que o formulário não conhece).
// • Pagamentos: junta os lançamentos — os que o gestor removeu saem, os
//   novos entram, e um lançamento feito entretanto pelo servidor fica.
// • Gravar uma reserva do site ainda "a aguardar pagamento" transforma-a
//   em pendente manual (sem prazo), como sempre aconteceu: quem mexeu nela
//   assumiu-a e ela não desaparece sozinha.
export function aplicarEdicaoReserva(fresca, original, editada) {
  if (!fresca) return editada;
  if (!original) return { ...fresca, ...editada };
  const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const out = { ...fresca };
  let mudou = false;
  for (const [k, v] of Object.entries(editada)) {
    if (k === 'registrosPagamento' || k === 'valorPago') continue;
    if (!igual(v, original[k])) { out[k] = v; mudou = true; }
  }
  const regOrig = original.registrosPagamento || [];
  const regEdit = editada.registrosPagamento || [];
  if (!igual(regOrig, regEdit)) {
    const idsOrig = new Set(regOrig.map(x => x.id));
    const porIdEdit = new Map(regEdit.map(x => [x.id, x]));
    const removidos = new Set(regOrig.filter(x => !porIdEdit.has(x.id)).map(x => x.id));
    const mantidos = (fresca.registrosPagamento || []).filter(x => !removidos.has(x.id)).map(x => porIdEdit.get(x.id) || x);
    const idsMantidos = new Set(mantidos.map(x => x.id));
    const novos = regEdit.filter(x => !idsOrig.has(x.id) && !idsMantidos.has(x.id));
    out.registrosPagamento = [...mantidos, ...novos];
    out.valorPago = arred(out.registrosPagamento.reduce((s, x) => s + (Number(x.valor) || 0), 0));
    mudou = true;
  } else if (!igual(editada.valorPago, original.valorPago) && !(fresca.registrosPagamento || []).length) {
    out.valorPago = editada.valorPago; mudou = true;
  }
  if (!mudou) return fresca;
  if (out.status !== 'pendente' || (fresca.status === 'pendente' && fresca.expiraEm)) out.expiraEm = null;
  return out;
}

export { holdExpirado, arred };
