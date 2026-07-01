import React, { useState, useEffect } from 'react';
import { X, Check, Info, ChevronDown, Minus, Plus } from 'lucide-react';
import { C, F } from '../lib/constants';
import { mkExtrasObrigatorios } from '../lib/csvUtils';
import { money, nights, ymd, uid, stayBreakdown, code, today, fmtShort } from '../lib/helpers';
import { Btn, Modal, Field, TextInput, NumberInput, PhotoTile } from './ui';

export function BookingModal({ sel, ci, co, hosp, data, onClose, onConfirm }) {
  const { apt, apt2, g1: initG1, g2: initG2 } = sel;
  const hasApt2 = !!apt2;
  const [step, setStep] = useState('extras');

  const taxasOpc = (data.taxasAdicionais || []).filter(tx => tx.tipo === 'opcional');
  const [extrasQty, setExtrasQty] = useState(() => Object.fromEntries(taxasOpc.map(t => [t.id, 0])));
  const [extrasScope, setExtrasScope] = useState(() => Object.fromEntries(taxasOpc.map(t => [t.id, t.por === 'noite' ? 'per_apt' : 'group'])));

  const extrasObrig = mkExtrasObrigatorios(data.taxasAdicionais);
  const extrasOpc1 = taxasOpc.filter(t => extrasQty[t.id] > 0).map(t => ({ ...t, qtd: extrasQty[t.id], subtotal: t.preco * extrasQty[t.id] }));
  const extrasOpc2 = hasApt2 ? taxasOpc.filter(t => extrasQty[t.id] > 0 && extrasScope[t.id] === 'per_apt').map(t => ({ ...t, qtd: extrasQty[t.id], subtotal: t.preco * extrasQty[t.id] })) : [];

  const bd = stayBreakdown(apt, data.seasons, ci, co);
  const bd2 = apt2 ? stayBreakdown(apt2, data.seasons, ci, co) : null;
  const obrigTotal = extrasObrig.reduce((s, e) => s + e.preco * e.qtd, 0);
  const opc1Total = extrasOpc1.reduce((s, e) => s + e.subtotal, 0);
  const opc2Total = extrasOpc2.reduce((s, e) => s + e.subtotal, 0);
  const total1 = bd.total + obrigTotal + opc1Total;
  const total2 = apt2 && bd2 ? bd2.total + obrigTotal + opc2Total : 0;
  const totalComExtras = total1 + total2;
  const sinal = Math.round(totalComExtras * (data.settings.sinalPct / 100));

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [tel, setTel] = useState('');
  const [g, setG] = useState(Math.min(initG1 || hosp, apt.capacidade));
  const [gB, setGB] = useState(Math.min(initG2 || 1, apt2 ? apt2.capacidade : 8));
  const ok = nome.trim() && email.trim();

  const getIcon = (n) => { const s = n.toLowerCase(); if (s.includes('pet') || s.includes('animal')) return '🐾'; if (s.includes('praia') || s.includes('cadeira') || s.includes('guarda')) return '🏖️'; if (s.includes('estacion') || s.includes('vaga')) return '🚗'; return '✨'; };

  const buildR = (aptX, bdX, guests, allExtras, totalVal, isB) => ({
    id: uid(), codigo: isB ? code() + '-B' : code(),
    apartamentoId: aptX.id, checkIn: ci, checkOut: co,
    nome: nome.trim().split(' ')[0], sobrenome: nome.trim().split(' ').slice(1).join(' '),
    hospede: nome.trim(), email: email.trim(), telefone: tel.trim(), pais: 'Brasil',
    adultos: guests, criancas: 0, hospedes: guests,
    precoNoite: Math.round(bdX.total / Math.max(1, bdX.n)), precoTabela: bdX.total,
    extras: allExtras, total: totalVal, sinal: isB ? 0 : sinal,
    status: 'pendente', origem: 'Site', enviarEmail: true,
    nota: isB ? `Reserva conjunta com ${apt.nome}` : hasApt2 ? `Reserva conjunta com ${apt2.nome}` : '',
    criadoEm: ymd(today()),
  });

  const handleConfirm = () => {
    onConfirm(buildR(apt, bd, g, [...extrasObrig, ...extrasOpc1], total1, false));
    if (apt2 && bd2) onConfirm(buildR(apt2, bd2, gB, [...extrasObrig, ...extrasOpc2], total2, true));
  };

  const hasExtras = taxasOpc.length > 0;

  // ── Step 1: Extras opcionais ──────────────────────────────────────────────
  if (step === 'extras' && hasExtras) return (
    <Modal title="Serviços extras opcionais" subtitle="Adicione serviços à sua estadia (pode pular)"
      onClose={onClose} wide
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" onClick={() => setStep('dados')}>Continuar →</Btn>
      </>}>
      <div style={{ display: 'grid', gap: 12 }}>
        {taxasOpc.map(taxa => {
          const qty = extrasQty[taxa.id] || 0;
          return (
            <div key={taxa.id} style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 14, alignItems: 'center', background: C.espuma, borderRadius: 12, padding: '14px 16px', border: qty > 0 ? `2px solid ${C.coral}` : `2px solid transparent` }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: '#e8f4f1', display: 'grid', placeItems: 'center', fontSize: 26 }}>{getIcon(taxa.nome)}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{taxa.nome}</div>
                <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>{money(taxa.preco)} por {taxa.por}</div>
                {hasApt2 && qty > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {['group','per_apt'].map(sc => (
                      <button key={sc} onClick={() => setExtrasScope(s => ({ ...s, [taxa.id]: sc }))}
                        style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, background: extrasScope[taxa.id] === sc ? C.coral : '#ddd', color: extrasScope[taxa.id] === sc ? '#fff' : '#444' }}>
                        {sc === 'group' ? '👥 Grupo (1×)' : '🏠 Por apto (2×)'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setExtrasQty(q => ({ ...q, [taxa.id]: Math.max(0, (q[taxa.id]||0)-1) }))} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #bbb', background: '#fff', cursor: 'pointer', fontSize: 18, display: 'grid', placeItems: 'center' }}>−</button>
                <b style={{ minWidth: 20, textAlign: 'center', fontSize: 16 }}>{qty}</b>
                <button onClick={() => setExtrasQty(q => ({ ...q, [taxa.id]: (q[taxa.id]||0)+1 }))} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #bbb', background: '#fff', cursor: 'pointer', fontSize: 18, display: 'grid', placeItems: 'center' }}>+</button>
              </div>
            </div>
          );
        })}
        {(opc1Total + opc2Total) > 0 && <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, color: C.ocean }}>Extras: {money(opc1Total + opc2Total)}</div>}
      </div>
    </Modal>
  );

  // ── Step 2: Dados do hóspede + resumo ─────────────────────────────────────
  return (
    <Modal title={hasApt2 ? `Reservar ${apt.nome} + ${apt2.nome}` : `Reservar ${apt.nome}`}
      subtitle={`${apt.piso} · ${apt.vista}`} onClose={onClose} wide
      footer={<>
        {hasExtras && <Btn variant="ghost" onClick={() => setStep('extras')}>← Extras</Btn>}
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="accent" disabled={!ok} style={{ opacity: ok ? 1 : .5 }} onClick={handleConfirm}>Confirmar reserva</Btn>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24 }} className="pm-book-grid">
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Check-in"><div style={readBox}>{fmtShort(ci)}</div></Field>
            <Field label="Check-out"><div style={readBox}>{fmtShort(co)}</div></Field>
          </div>
          <Field label="Nome completo" required><TextInput value={nome} onChange={e => setNome(e.target.value)} placeholder="Como no documento" /></Field>
          <Field label="Email" required><TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" /></Field>
          <Field label="Telefone"><TextInput value={tel} onChange={e => setTel(e.target.value)} placeholder="(00) 00000-0000" /></Field>
          {!hasApt2 ? (
            <Field label="Hóspedes" hint={`Máx. ${apt.capacidade}`}>
              <NumberInput min={1} max={apt.capacidade} value={g} onChange={e => setG(Math.min(apt.capacidade, Math.max(1, +e.target.value || 1)))} />
            </Field>
          ) : (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#666', marginBottom: 8 }}>Hóspedes por apartamento</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: C.espuma, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{apt.nome}</div>
                  <NumberInput min={1} max={apt.capacidade} value={g} onChange={e => setG(Math.min(apt.capacidade, Math.max(1, +e.target.value || 1)))} />
                </div>
                <div style={{ background: C.espuma, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{apt2.nome}</div>
                  <NumberInput min={1} max={apt2.capacidade} value={gB} onChange={e => setGB(Math.min(apt2.capacidade, Math.max(1, +e.target.value || 1)))} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 5, textAlign: 'right' }}>Total: {g + gB} pessoas</div>
            </div>
          )}
        </div>
        <div style={{ background: C.espuma, borderRadius: 14, padding: 18, alignSelf: 'start' }}>
          <PhotoTile apt={apt} h={100} />
          <div style={{ marginTop: 14, fontSize: 13.5 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Resumo de preços</div>
            {hasApt2 && <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: '#555', marginBottom: 5 }}>{apt.nome}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: C.inkSoft }}>
              <span>Acomodação ({bd.n} noites)</span><span>{money(bd.total)}</span>
            </div>
            {extrasObrig.map(e => <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13, color: C.inkSoft }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 9, fontWeight: 800, background: '#1C7A5B', color: '#fff', borderRadius: 3, padding: '1px 4px' }}>OBR</span>{e.nome}</span>
              <span>{money(e.preco)}</span>
            </div>)}
            {extrasOpc1.map(e => <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13, color: C.inkSoft }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 9, fontWeight: 800, background: C.ocean, color: '#fff', borderRadius: 3, padding: '1px 4px' }}>OPC</span>{e.nome}{e.qtd > 1 ? ` ×${e.qtd}` : ''}{hasApt2 && extrasScope[e.id] === 'group' ? ' (grupo)' : ''}</span>
              <span>{money(e.subtotal)}</span>
            </div>)}
            {hasApt2 && bd2 && <>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: '#555', margin: '10px 0 5px' }}>{apt2.nome}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: C.inkSoft }}>
                <span>Acomodação ({bd2.n} noites)</span><span>{money(bd2.total)}</span>
              </div>
              {extrasObrig.map(e => <div key={e.id+'_2'} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13, color: C.inkSoft }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 9, fontWeight: 800, background: '#1C7A5B', color: '#fff', borderRadius: 3, padding: '1px 4px' }}>OBR</span>{e.nome}</span>
                <span>{money(e.preco)}</span>
              </div>)}
              {extrasOpc2.map(e => <div key={e.id+'_o2'} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13, color: C.inkSoft }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 9, fontWeight: 800, background: C.ocean, color: '#fff', borderRadius: 3, padding: '1px 4px' }}>OPC</span>{e.nome}{e.qtd > 1 ? ` ×${e.qtd}` : ''}</span>
                <span>{money(e.subtotal)}</span>
              </div>)}
            </>}
            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
              <span>Total{hasApt2 ? ' combinado' : ''}</span><span>{money(totalComExtras)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: C.coralDeep, fontWeight: 600 }}>
              <span>Sinal ({data.settings.sinalPct}%)</span><span>{money(sinal)}</span>
            </div>
            {hasApt2 && <p style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 8, marginBottom: 0, background: '#e8f4ff', borderRadius: 8, padding: '6px 10px' }}>Serão geradas 2 reservas vinculadas ao mesmo hóspede.</p>}
            <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 8, marginBottom: 0 }}>O pagamento do sinal confirma a reserva.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
export const readBox = { padding: '10px 12px', borderRadius: 10, background: C.areiaSoft, border: `1px solid ${C.areia}`, fontSize: 14, fontWeight: 600 };

