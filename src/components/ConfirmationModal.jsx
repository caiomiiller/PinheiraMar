import React from 'react';
import { Check, AlertCircle, Clock, MessageCircle } from 'lucide-react';
import { C, F, WHATSAPP_URL } from '../lib/constants';
import { money, nights } from '../lib/helpers';
import { useIdioma } from '../lib/i18n';
import { Btn, Modal, Row } from './ui';

// Confirmação mostrada ao hóspede. `info` = { reservas, total, sinal, aptos,
// sinalPct } (vem do servidor — ou, ao voltar do Mercado Pago, do que ficou
// guardado neste separador). Numa reserva conjunta mostra os dois
// apartamentos e o total COMBINADO (antes mostrava o total de um só ao lado
// do sinal dos dois).
// paymentStatus: 'success' | 'pending' | 'failure' | undefined (fluxo manual).
export function ConfirmationModal({ info, paymentStatus, onClose }) {
  const { tr, fmtCurta, dado } = useIdioma();
  const r1 = info?.reservas?.[0];
  const failed = paymentStatus === 'failure';
  const pending = paymentStatus === 'pending';
  const paid = paymentStatus === 'success';
  const aptos = (info?.aptos || []).map(a => [a.nome, dado(a.vista)].filter(Boolean).join(' · ')).join(' + ');
  const titulo = failed ? tr('cf_titulo_falhou') : paid ? tr('cf_titulo_paga') : pending ? tr('cf_titulo_aguardando') : tr('cf_titulo_recebida');

  return (
    <Modal title={titulo} onClose={onClose} rotuloFechar={tr('ap_fechar')}
      footer={<Btn variant="primary" style={{ minHeight: 48, fontSize: 16 }} onClick={onClose}>{tr('cf_nova_pesquisa')}</Btn>}>
      {!r1 ? (
        // voltou do Mercado Pago noutro separador/aparelho: sem os detalhes à mão
        <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>{failed ? tr('cf_generico_falhou') : tr('cf_generico')}</p>
      ) : (
        <>
          <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: failed ? '#FEF3F2' : (pending ? '#FFF4D6' : 'rgba(27,28,70,.07)'), display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
              {failed ? <AlertCircle size={30} color="#B42318" /> : pending ? <Clock size={30} color="#8A6A14" /> : <Check size={30} color={C.ocean} />}
            </div>
            <p style={{ margin: 0, color: C.inkSoft, fontSize: 15 }}>{tr('cf_seu_codigo')}</p>
            <div style={{ fontFamily: F.disp, fontSize: 30, letterSpacing: '.06em', margin: '4px 0 18px', color: C.ocean }}>{r1.codigo}</div>
          </div>
          <div style={{ background: C.espuma, borderRadius: 12, padding: 16, fontSize: 15.5, display: 'grid', gap: 10 }}>
            <Row k={info.aptos?.length > 1 ? tr('cf_apartamentos') : tr('cf_apartamento')} v={aptos} />
            <Row k={tr('cf_estadia')} v={`${fmtCurta(r1.checkIn)} → ${fmtCurta(r1.checkOut)} · ${tr('noites', nights(r1.checkIn, r1.checkOut))}`} />
            <Row k={tr('cf_hospede')} v={r1.hospede} />
            <Row k={info.aptos?.length > 1 ? tr('bk_total_combinado') : tr('bk_total')} v={money(info.total)} strong />
            <Row k={paid ? tr('cf_sinal_pago', info.sinalPct) : tr('cf_sinal_a_pagar', info.sinalPct)} v={money(info.sinal)} accent />
          </div>
          <p style={{ fontSize: 15, color: C.inkSoft, marginTop: 16, marginBottom: 0, lineHeight: 1.6 }}>
            {failed ? tr('cf_texto_falhou') : paid ? tr('cf_texto_pago', r1.email) : pending ? tr('cf_texto_aguardando', r1.email) : tr('cf_texto_manual', r1.email)}
          </p>
          {(failed || !paymentStatus) && (
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, color: C.ocean, fontWeight: 700, fontSize: 15.5, textDecoration: 'none' }}>
              <MessageCircle size={18} /> {tr('bk_falar_whatsapp')}
            </a>
          )}
        </>
      )}
    </Modal>
  );
}
