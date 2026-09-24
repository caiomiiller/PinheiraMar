// Envio do e-mail de confirmação de reserva via EmailJS — chama a API pública
// da EmailJS direto do navegador, sem precisar de servidor próprio (o site
// não tem backend, só localStorage — ver seed.js). Não bloqueia nem quebra o
// fluxo de reserva se falhar: o hóspede já vê o código de reserva no ecrã de
// qualquer forma, o e-mail é um reforço, não o único registo da reserva.
//
// Configuração necessária (ver .env.example):
//   1. Crie uma conta em emailjs.com e ligue um serviço de e-mail (Gmail, etc.)
//   2. Crie um template com as variáveis usadas em `buildParams` abaixo
//   3. Copie Public Key, Service ID e Template ID para o .env (local) e para
//      as Environment Variables do projeto na Vercel (produção)
//
// Enquanto essas variáveis não estiverem definidas, o envio é ignorado
// silenciosamente (só um aviso na consola) — o site continua a funcionar
// normalmente, só sem o e-mail.
//
// IMPORTANTE: `buildParams` abaixo e a função `enviarEmailConfirmacao` em
// api/mp-webhook.js têm de continuar a produzir exatamente as MESMAS
// variáveis (mesmos nomes) — os dois enviam para o mesmo template do
// EmailJS, um pelo navegador, outro pelo servidor (quando o pagamento é
// confirmado pelo Mercado Pago). Ao mexer aqui, mexer lá também.

import { money, fmtLong, nights } from './helpers';

const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;

export function emailConfigured() {
  return !!(PUBLIC_KEY && SERVICE_ID && TEMPLATE_ID);
}

let initialized = false;
function ensureInit() {
  if (initialized || typeof window === 'undefined' || !window.emailjs) return;
  window.emailjs.init({ publicKey: PUBLIC_KEY });
  initialized = true;
}

// Junta "2 adultos, 1 criança" (ou só uma das partes, se a outra for 0) —
// usado no template em vez de dois números soltos.
function hospedesTxt(reserva) {
  const adultos = Number(reserva.adultos) || 0;
  const criancas = Number(reserva.criancas) || 0;
  return [
    adultos ? `${adultos} adulto${adultos > 1 ? 's' : ''}` : null,
    criancas ? `${criancas} criança${criancas > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(', ') || '—';
}

export function buildParams(reserva, apt, settings) {
  // Saldo restante: usa o valor já efetivamente pago (valorPago, mantido
  // pelo Admin — ver montarReserva em Reservations.jsx) quando existir;
  // numa reserva ainda por confirmar pelo site, só há o sinal.
  const pago = Number(reserva.valorPago ?? reserva.sinal ?? 0);
  const restante = Math.round((Number(reserva.total || 0) - pago) * 100) / 100;
  return {
    // O template do EmailJS usa {{email}} como destinatário (campo "To
    // Email" do template) — mantém-se também `to_email` por precaução,
    // caso o template venha a ser alterado para usar esse nome no futuro.
    email: reserva.email,
    to_email: reserva.email,
    to_name: reserva.hospede || reserva.nome || '',
    codigo_reserva: reserva.codigo,
    nome_propriedade: settings?.nome || '',
    cidade: settings?.cidade || '',
    apartamento: [apt?.nome, apt?.vista].filter(Boolean).join(' · '),
    check_in_fmt: fmtLong(reserva.checkIn),
    check_out_fmt: fmtLong(reserva.checkOut),
    noites: nights(reserva.checkIn, reserva.checkOut),
    hospedes_txt: hospedesTxt(reserva),
    total_fmt: money(reserva.total),
    sinal_fmt: money(reserva.sinal),
    sinal_pct: settings?.sinalPct,
    restante_fmt: money(restante),
    endereco: settings?.endereco || '',
    whatsapp: settings?.telefone || '',
  };
}

// Envia o e-mail de confirmação para uma reserva. `reserva` é o objeto criado
// em BookingModal.buildR (ou no formulário de reserva manual do Admin) —
// só envia se `reserva.enviarEmail` estiver true e houver e-mail preenchido.
export async function sendConfirmationEmail(reserva, apt, settings) {
  if (!reserva?.enviarEmail || !reserva?.email) return false;
  if (!emailConfigured() || typeof window === 'undefined' || !window.emailjs) {
    console.warn('[email] EmailJS não está configurado — e-mail de confirmação não enviado. Ver .env.example.');
    return false;
  }
  ensureInit();
  try {
    await window.emailjs.send(SERVICE_ID, TEMPLATE_ID, buildParams(reserva, apt, settings));
    return true;
  } catch (err) {
    console.error('[email] Falha ao enviar e-mail de confirmação:', err);
    return false;
  }
}
