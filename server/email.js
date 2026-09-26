// E-mail de confirmação da reserva — enviado SÓ pelo servidor, pela API REST
// da EmailJS com a chave privada. Antes também saía do navegador, com a
// chave pública: qualquer pessoa conseguia disparar o template (do endereço
// do residencial) para qualquer destinatário e com qualquer texto.
//
// Na conta EmailJS → Account → Security: ligar "Allow EmailJS API for
// non-browser applications" (sem isto o envio pelo servidor é recusado) e
// "Use Private Key" (o envio pelo navegador, com a chave pública, deixa de
// ser possível).
import { money, fmtLong, nights } from '../src/lib/helpers.js';
import { alterarEstado } from './estado.js';

const API = () => (process.env.EMAILJS_API_URL || 'https://api.emailjs.com').replace(/\/+$/, '');

// Aceita os nomes antigos (VITE_…, já configurados na Vercel) ou os mesmos
// sem o prefixo. O navegador já não usa nenhum deles.
const env = (nome) => process.env[nome] || process.env['VITE_' + nome] || '';
const cfg = () => ({ publicKey: env('EMAILJS_PUBLIC_KEY'), serviceId: env('EMAILJS_SERVICE_ID'), templateId: env('EMAILJS_TEMPLATE_ID'), privateKey: process.env.EMAILJS_PRIVATE_KEY || '' });

export function emailConfigurado() {
  const c = cfg();
  return !!(c.publicKey && c.serviceId && c.templateId && c.privateKey);
}

function hospedesTxt(reserva) {
  const adultos = Number(reserva.adultos) || 0;
  const criancas = Number(reserva.criancas) || 0;
  return [
    adultos ? `${adultos} adulto${adultos > 1 ? 's' : ''}` : null,
    criancas ? `${criancas} criança${criancas > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(', ') || '—';
}

// As variáveis do template (mesmos nomes de sempre — ver
// template-emailjs-confirmacao.html). Uma reserva conjunta (2 apartamentos)
// gera UM só e-mail, com os dois apartamentos e o total combinado — antes
// saíam dois, e o da 2ª metade mostrava um "saldo restante" errado.
// `grupo` = [{ reserva, apt }] (a 1ª é a que leva o sinal).
export function parametrosEmail(grupo, residencial) {
  const [{ reserva: r1 }] = grupo;
  const total = Math.round(grupo.reduce((s, g) => s + (Number(g.reserva.total) || 0), 0) * 100) / 100;
  const pago = Math.round(grupo.reduce((s, g) => s + (Number(g.reserva.valorPago) || 0), 0) * 100) / 100;
  const sinal = Number(r1.sinal) || 0;
  // saldo no check-in: o total menos o que já foi pago — ou, se ainda não
  // houve pagamento (fluxo manual), menos o sinal que vai ser combinado.
  const restante = Math.max(0, Math.round((total - Math.max(pago, sinal)) * 100) / 100);
  const hosp = grupo.reduce((s, g) => s + (Number(g.reserva.adultos) || 0) + (Number(g.reserva.criancas) || 0), 0);
  // O mesmo template serve às duas situações: sinal já pago (Mercado Pago ou
  // lançado no painel) ou reserva recebida à espera do sinal (fluxo manual).
  // Antes dizia sempre "Reserva confirmada! Sinal pago", mesmo sem pagamento.
  const pct = residencial?.sinalPct ?? 50;
  const pagou = pago > 0;
  const confirmada = pagou && pago + 0.009 >= sinal;
  const horarios = [
    residencial?.checkInHora ? `Check-in a partir das ${residencial.checkInHora}` : null,
    residencial?.checkOutHora ? `check-out até ${residencial.checkOutHora}` : null,
  ].filter(Boolean).join(' · ');
  return {
    email: r1.email,
    to_email: r1.email,
    to_name: r1.hospede || r1.nome || '',
    codigo_reserva: r1.codigo,
    nome_propriedade: residencial?.nome || '',
    cidade: residencial?.cidade || '',
    apartamento: grupo.map(g => [g.apt?.nome, g.apt?.vista].filter(Boolean).join(' · ')).join(' + '),
    check_in_fmt: fmtLong(r1.checkIn),
    check_out_fmt: fmtLong(r1.checkOut),
    check_in_hora: residencial?.checkInHora || '',
    check_out_hora: residencial?.checkOutHora || '',
    noites: nights(r1.checkIn, r1.checkOut),
    hospedes_txt: grupo.length > 1 ? `${hosp} pessoas` : hospedesTxt(r1),
    total_fmt: money(total),
    sinal_fmt: money(sinal),
    sinal_pct: residencial?.sinalPct,
    pago_fmt: money(pago),
    restante_fmt: money(restante),
    endereco: residencial?.endereco || '',
    whatsapp: residencial?.telefone || '',
    // textos que mudam conforme o pagamento (ver template-emailjs-confirmacao.html)
    titulo: confirmada ? 'Reserva confirmada!' : 'Reserva recebida',
    rotulo_sinal: pagou ? `Sinal pago (${pct}%)` : `Sinal a pagar (${pct}%)`,
    valor_sinal_fmt: money(pagou ? pago : sinal),
    mensagem: confirmada
      ? 'Pagamento do sinal confirmado! O saldo restante é pago no check-in.'
      : 'Recebemos sua reserva. Para garanti-la, falta o pagamento do sinal: vamos entrar em contato pelo WhatsApp ou por e-mail com as instruções.',
    horarios,
  };
}

export async function enviarConfirmacao(grupo, residencial) {
  if (!emailConfigurado()) {
    console.warn('[email] EmailJS não configurado no servidor — e-mail não enviado (ver .env.example).');
    return { ok: false, motivo: 'nao_configurado' };
  }
  if (!grupo?.length || !grupo[0].reserva?.email) return { ok: false, motivo: 'sem_email' };
  try {
    const resp = await fetch(`${API()}/api/v1.0/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg().serviceId,
        template_id: cfg().templateId,
        user_id: cfg().publicKey,
        accessToken: cfg().privateKey,
        template_params: parametrosEmail(grupo, residencial),
      }),
    });
    if (!resp.ok) {
      console.warn('[email] EmailJS recusou o envio:', resp.status, await resp.text().catch(() => ''));
      return { ok: false, motivo: 'recusado', status: resp.status };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[email] falha ao enviar:', err);
    return { ok: false, motivo: 'rede' };
  }
}

// Regista nas reservas quando o e-mail saiu (o painel mostra "Último
// envio"). Melhor esforço: se esta gravação falhar, o e-mail já foi — só não
// fica a data registada. Nunca repete o envio.
export async function registarEnvio(ids, quando = new Date().toISOString()) {
  const alvo = new Set((ids || []).filter(Boolean));
  if (!alvo.size) return false;
  try {
    const r = await alterarEstado((e) => {
      if (!e.reservas.some(x => alvo.has(x.id))) return { estado: null };
      return { estado: { ...e, reservas: e.reservas.map(x => (alvo.has(x.id) ? { ...x, emailEnviadoEm: quando } : x)) }, resultado: true };
    });
    return !!r.gravado;
  } catch (err) {
    console.warn('[email] enviado, mas não foi possível registar a data do envio:', err.codigo || err);
    return false;
  }
}
