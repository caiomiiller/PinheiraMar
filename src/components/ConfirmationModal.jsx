import React from 'react';
import { X, Check } from 'lucide-react';
import { C, F } from '../lib/constants';
import { money, fmtLong } from '../lib/helpers';
import { Btn, Modal } from './ui';

export function ConfirmationModal({ info, settings, onClose }) {
  const { reserva, apt } = info;
  return (
    <Modal title="Reserva recebida!" onClose={onClose}
      footer={<Btn variant="primary" onClick={onClose}>Fazer nova pesquisa</Btn>}>
      <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#E1F0EC', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><Check size={30} color="#1C7A5B" /></div>
        <p style={{ margin: 0, color: C.inkSoft, fontSize: 14 }}>O seu código de reserva</p>
        <div style={{ fontFamily: F.disp, fontSize: 30, letterSpacing: '.06em', margin: '4px 0 18px', color: C.ocean }}>{reserva.codigo}</div>
      </div>
      <div style={{ background: C.espuma, borderRadius: 12, padding: 16, fontSize: 14, display: 'grid', gap: 8 }}>
        <Row k="Apartamento" v={`${apt.nome} · ${apt.vista}`} />
        <Row k="Estadia" v={`${fmtShort(reserva.checkIn)} → ${fmtShort(reserva.checkOut)} (${nights(reserva.checkIn, reserva.checkOut)} noites)`} />
        <Row k="Hóspede" v={reserva.hospede} />
        <Row k="Total" v={money(reserva.total)} strong />
        <Row k={`Sinal a pagar (${settings.sinalPct}%)`} v={money(reserva.sinal)} accent />
      </div>
      <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 16, marginBottom: 0 }}>
        Enviámos os detalhes para <b>{reserva.email}</b>. Para confirmar, efetue o pagamento do sinal — entraremos em contacto com as instruções. A reserva fica como <b>pendente</b> no painel de gestão até à confirmação.
      </p>
    </Modal>
  );
}
