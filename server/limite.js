// Limite simples de reservas por IP (contra quem tente encher o calendário de
// reservas pendentes para bloquear datas).
//
// Conta só as reservas GRAVADAS com sucesso: erros de validação, datas
// ocupadas ou preço mudado não gastam tentativas, para não atrapalhar um
// hóspede de verdade que corrija o formulário.
//
// Fica em memória da função: cada instância da Vercel tem a sua contagem, por
// isso é uma barreira parcial, que soma ao limite de pendentes por hóspede
// (MAX_PENDENTES_POR_HOSPEDE) e ao prazo das provisórias. Não toca no banco.

export const MAX_RESERVAS_POR_IP = 5;
export const JANELA_IP_MS = 10 * 60 * 1000;
const MAX_IPS = 5000;

const registos = new Map(); // ip -> [instantes das reservas gravadas]

const recentes = (ip, agora, janela) => (registos.get(ip) || []).filter(t => agora - t < janela);

export function excedeuLimiteIp(ip, { agora = Date.now(), max = MAX_RESERVAS_POR_IP, janela = JANELA_IP_MS } = {}) {
  if (!ip) return false;
  return recentes(ip, agora, janela).length >= max;
}

export function registarReservaIp(ip, { agora = Date.now(), janela = JANELA_IP_MS } = {}) {
  if (!ip) return;
  const lista = recentes(ip, agora, janela);
  lista.push(agora);
  registos.delete(ip);
  registos.set(ip, lista);
  // não deixa a memória crescer: descarta os IPs mais antigos
  while (registos.size > MAX_IPS) registos.delete(registos.keys().next().value);
}

export function limparLimitesIp() { registos.clear(); }
