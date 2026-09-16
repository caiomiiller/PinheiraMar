import React from 'react';
import { X, Check, AlertCircle, Clock } from 'lucide-react';
import { C, F } from '../lib/constants';
import { money, fmtLong, fmtShort, nights } from '../lib/helpers';
import { Btn, Modal, Row } from './ui';

// paymentStatus vem do redirecionamento de volta do Mercado Pago Checkout Pro
// (ver BookingModal.jsx e PublicSite.jsx — parâmetro ?mp= na URL de retorno):
// 'success' | 'pending' | 'failure' | undefined. undefined é o fluxo de
// sempre (sem gateway configurado, ou reserva feita manualmente) — o
// hóspede ainda precisa de ser contactado para pagar o sinal.
export function ConfirmationModal({ info, settings, onClose, paymentStatus }) {
  const { reserva, apt } = info;
  const failed = paymentStatus === 'failure';
  const pending = paymentStatus === 'pending';
  const paid = paymentStatus === 'success';
  return (
    <Modal title={failed ? 'Reserva guardada — pagamento não concluído' : 'Reserva recebida!'} onClose={onClose}
      footer={<Btn variant="primary" onClick={onClose}>Fazer nova pesquisa</Btn>}>
      <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: failed ? '#F7E9E9' : (pending ? '#FBEFD9' : '#E1F0EC'), display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
          {failed ? <AlertCircle size={30} color="#B23B3B" /> : pending ? <Clock size={30} color="#9A6A14" /> : <Check size={30} color="#1C7A5B" />}
        </div>
        <p style={{ margin: 0, color: C.inkSoft, fontSize: 14 }}>O seu código de reserva</p>
        <div style={{ fontFamily: F.disp, fontSize: 30, letterSpacing: '.06em', margin: '4px 0 18px', color: C.ocean }}>{reserva.codigo}</div>
      </div>
      <div style={{ background: C.espuma, borderRadius: 12, padding: 16, fontSize: 14, display: 'grid', gap: 8 }}>
        <Row k="Apartamento" v={`${apt.nome} · ${apt.vista}`} />
        <Row k="Estadia" v={`${fmtShort(reserva.checkIn)} → ${fmtShort(reserva.checkOut)} (${nights(reserva.checkIn, reserva.checkOut)} noites)`} />
        <Row k="Hóspede" v={reserva.hospede} />
        <Row k="Total" v={money(reserva.total)} strong />
        <Row k={`Sinal ${paid ? 'pago' : 'a pagar'} (${settings.sinalPct}%)`} v={money(reserva.sinal)} accent />
      </div>
      <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 16, marginBottom: 0 }}>
        {failed
          ? <>O pagamento do sinal não foi concluído. A reserva ficou guardada como <b>pendente</b> — entre em contacto pelo WhatsApp para tentar novamente ou combinar outra forma de pagamento.</>
          : paid
            ? <>Pagamento do sinal confirmado! Enviámos os detalhes para <b>{reserva.email}</b>. O saldo restante é pago no check-in.</>
            : pending
              ? <>Recebemos o seu pagamento e estamos a aguardar a confirmação (pode demorar alguns minutos, comum no Pix). Enviámos os detalhes para <b>{reserva.email}</b>.</>
              : <>Enviámos os detalhes para <b>{reserva.email}</b>. Para confirmar, efetue o pagamento do sinal — entraremos em contato com as instruções. A reserva fica como <b>pendente</b> no painel de gestão até à confirmação.</>}
      </p>
    </Modal>
  );
}
