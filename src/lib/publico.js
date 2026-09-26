// O que o site público pode ver. Antes cada visitante descarregava o banco
// inteiro — incluindo nome, e-mail e telefone de todos os hóspedes. Agora
// só vai o necessário para mostrar apartamentos, preços e disponibilidade.
import { holdExpirado, addDays, parseYMD, ymd } from './helpers.js';

export function estadoPublico(data, hoje, agora = Date.now()) {
  const desde = ymd(addDays(parseYMD(hoje), -1));
  const reservas = (data.reservas || [])
    .filter(r => r && r.status !== 'cancelada' && !holdExpirado(r, agora) && (r.checkOut || '') >= desde)
    .map(r => ({
      apartamentoId: r.apartamentoId, checkIn: r.checkIn, checkOut: r.checkOut,
      status: r.status === 'pendente' ? 'pendente' : 'ocupado',
      ...(r.status === 'pendente' && r.expiraEm ? { expiraEm: r.expiraEm } : {}),
    }));
  return {
    residenciais: data.residenciais || [],
    apartamentos: data.apartamentos || [],
    seasons: data.seasons || [],
    taxasAdicionais: data.taxasAdicionais || [],
    reservas,
    versaoDados: data.versaoDados,
  };
}
