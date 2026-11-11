// Links de WhatsApp já com a mensagem escrita, para a conversa não abrir em
// branco: quem atende vê logo o apartamento, as datas e (depois da reserva)
// o código. A mensagem vai sempre em português, que é a língua de quem
// atende, mesmo com o site noutro idioma. O hóspede pode editá-la antes de enviar.
import { WHATSAPP_URL } from './constants';

// '2027-01-10' → '10/01/2027'
const dataBr = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
const periodo = (ci, co) => (dataBr(ci) && dataBr(co) ? `de ${dataBr(ci)} a ${dataBr(co)}` : '');
const pessoas = (n) => (n > 0 ? `para ${n} ${n === 1 ? 'pessoa' : 'pessoas'}` : '');
const junta = (partes) => partes.filter(Boolean).join(', ');

// Mesmo link de sempre, com o parâmetro text preenchido. `base` permite usar
// o número de um residencial (página de políticas) em vez do número do grupo.
export function whatsappUrl(texto, base = WHATSAPP_URL) {
  if (!texto) return base;
  return base.replace('&text&', `&text=${encodeURIComponent(texto)}&`);
}

// Contato geral (rodapé, "como chegar", políticas).
export const msgGeral = (residencial) =>
  `Olá! Vim pelo site e gostaria de informações${residencial ? ` sobre o ${residencial}` : ''}.`;

// Página do apartamento: nome, residencial e, se já escolhidas, datas e pessoas.
export function msgApartamento({ aptos, residencial, ci, co, hospedes }) {
  const nomes = [].concat(aptos).filter(Boolean).join(' + ');
  const onde = residencial ? `${nomes} (${residencial})` : nomes;
  return `Olá! Tenho interesse no ${junta([onde, periodo(ci, co), pessoas(hospedes)])}. Pode me ajudar?`;
}

// Erro ao enviar a reserva pelo site.
export function msgErroReserva({ aptos, ci, co }) {
  const nomes = [].concat(aptos).filter(Boolean).join(' + ');
  return `Olá! Tentei reservar o ${junta([nomes, periodo(ci, co)])} pelo site e não consegui concluir. Pode me ajudar?`;
}

// Depois da reserva: leva o código.
export function msgReserva({ codigo, aptos, ci, co, falhou }) {
  const nomes = [].concat(aptos).filter(Boolean).join(' + ');
  const detalhe = junta([nomes, periodo(ci, co)]);
  const base = `Olá! Fiz a reserva ${codigo}${detalhe ? ` (${detalhe})` : ''} pelo site`;
  return falhou ? `${base} e o pagamento não foi concluído. Pode me ajudar?` : `${base}.`;
}
