import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, RotateCcw, AlertCircle } from 'lucide-react';
import { C } from '../../lib/constants';
import { money, uid, today, ymd, fmtShort } from '../../lib/helpers';
import { PageHead, Btn, Modal, Field, TextInput, Textarea, DateInput, MoneyInput, ConfirmDialog } from '../../components/ui';
import { iconBtn } from './Reservations';

// Antes um sistema de cupões de desconto (com código, %/valor fixo,
// validade e contagem de usos) — a pedido do Caio (2026-09-28), virou um
// registo simples de CRÉDITOS/vouchers dados a hóspedes que cancelam uma
// reserva. Sem código para o hóspede, sem desconto automático em lado
// nenhum: é só uma lista para não perder de vista quem tem crédito em
// aberto, com um botão para marcar como "Utilizado" quando o hóspede usar
// o voucher numa reserva nova.
export function CreditosView({ data, update }) {
  const creditos = data.creditos || [];
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const save = (c) => {
    update(prev => {
      const list = prev.creditos || [];
      const exists = list.some(x => x.id === c.id);
      return { ...prev, creditos: exists ? list.map(x => x.id === c.id ? c : x) : [...list, c] };
    });
    setEditing(null);
  };
  const remove = (id) => update(prev => ({ ...prev, creditos: (prev.creditos || []).filter(x => x.id !== id) }));
  const marcarUtilizado = (id, utilizado) => update(prev => ({
    ...prev,
    creditos: (prev.creditos || []).map(x => x.id === id ? { ...x, utilizado, utilizadoEm: utilizado ? ymd(today()) : '' } : x),
  }));

  // Em aberto primeiro (é o que importa acompanhar); dentro de cada grupo,
  // o mais recente primeiro.
  const ordenados = [...creditos].sort((a, b) => {
    if (!!a.utilizado !== !!b.utilizado) return a.utilizado ? 1 : -1;
    return (b.criadoEm || '').localeCompare(a.criadoEm || '');
  });
  const totalAberto = creditos.filter(c => !c.utilizado).reduce((s, c) => s + (Number(c.valor) || 0), 0);

  return (
    <div>
      <PageHead title="Créditos de Hóspedes"
        sub={`Registo manual de créditos/vouchers (ex.: por cancelamento de reserva).${creditos.length ? ` ${money(totalAberto)} em aberto.` : ''}`}
        action={<Btn icon={Plus} onClick={() => setEditing('new')}>Adicionar</Btn>} />

      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 680 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 1.1fr 1.6fr 108px 92px', gap: 12, padding: '10px 20px', background: C.espuma, borderBottom: `1px solid ${C.line}`, fontSize: 12, fontWeight: 700, color: C.inkSoft }}>
              <span>HÓSPEDE</span><span>VALOR</span><span>EMITIDO / VALIDADE</span><span>MOTIVO</span><span>ESTADO</span><span></span>
            </div>
            {ordenados.length === 0 && (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: C.inkSoft, fontSize: 14 }}>
                Nenhum crédito registado ainda. Clique em <b>Adicionar</b> para registar o primeiro (ex.: voucher de um cancelamento).
              </div>
            )}
            {ordenados.map((c, idx) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 1.1fr 1.6fr 108px 92px', gap: 12, alignItems: 'center', padding: '14px 20px', borderBottom: idx < ordenados.length - 1 ? `1px solid ${C.line}` : 'none', opacity: c.utilizado ? .6 : 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.ocean, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.hospede}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{money(c.valor)}</div>
                <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.4 }}>
                  {fmtShort(c.criadoEm)}{c.validade ? <><br />válido até {fmtShort(c.validade)}</> : null}
                </div>
                <div style={{ fontSize: 13, color: C.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.motivo}>{c.motivo || '—'}</div>
                <div>
                  {c.utilizado
                    ? <span style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, background: C.espuma, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>Utilizado{c.utilizadoEm ? ` · ${fmtShort(c.utilizadoEm)}` : ''}</span>
                    : <span style={{ fontSize: 12, fontWeight: 700, color: '#1C7A5B', background: '#D1FAE5', borderRadius: 999, padding: '3px 9px' }}>Em aberto</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {c.utilizado
                    ? <button onClick={() => marcarUtilizado(c.id, false)} style={iconBtn} title="Reabrir (marcar como não utilizado)"><RotateCcw size={14} /></button>
                    : <button onClick={() => marcarUtilizado(c.id, true)} style={{ ...iconBtn, color: '#1C7A5B' }} title="Marcar como utilizado"><Check size={14} /></button>}
                  <button onClick={() => setEditing(c)} style={iconBtn} title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => setConfirmId(c.id)} style={{ ...iconBtn, color: '#B23B3B' }} title="Eliminar"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: '12px 16px', background: '#EEF6FF', border: '1px solid #BDD9F8', borderRadius: 12, fontSize: 13, color: '#1A4A7A' }}>
        <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Isto é só um registo — não gera código nem aplica desconto sozinho. Ao usar o crédito numa reserva nova, ajuste o valor manualmente (campo de extras da reserva) e marque este registo como <b>Utilizado</b>.
      </div>

      {editing && <CreditoForm initial={editing === 'new' ? null : editing} isNew={editing === 'new'} onSave={save} onClose={() => setEditing(null)} />}
      {confirmId && (() => {
        const c = creditos.find(x => x.id === confirmId);
        return (
          <ConfirmDialog
            message={<>Tem a certeza que quer eliminar o crédito de <b>{c?.hospede || 'hóspede'}</b> ({money(c?.valor || 0)})? Esta ação não pode ser desfeita.</>}
            onConfirm={() => { remove(confirmId); setConfirmId(null); }}
            onCancel={() => setConfirmId(null)}
          />
        );
      })()}
    </div>
  );
}

export function CreditoForm({ initial, isNew, onSave, onClose }) {
  const i = initial || {};
  const [hospede, setHospede] = useState(i.hospede || '');
  const [valor, setValor] = useState(i.valor ?? '');
  const [criadoEm, setCriadoEm] = useState(i.criadoEm || ymd(today()));
  const [validade, setValidade] = useState(i.validade || '');
  const [motivo, setMotivo] = useState(i.motivo || '');
  const [notas, setNotas] = useState(i.notas || '');
  const ok = hospede.trim() && Number(valor) > 0;

  return (
    <Modal title={isNew ? 'Registar crédito de hóspede' : `Editar crédito — ${i.hospede}`} onClose={onClose} wide
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={!ok} style={{ opacity: ok ? 1 : .5 }}
          onClick={() => onSave({
            id: i.id || ('cred' + uid()),
            hospede: hospede.trim(), valor: Number(valor),
            criadoEm, validade, motivo: motivo.trim(), notas: notas.trim(),
            utilizado: i.utilizado || false, utilizadoEm: i.utilizadoEm || '',
          })}>
          {isNew ? 'Registar' : 'Salvar alterações'}
        </Btn>
      </>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pm-dash-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
          <Field label="Nome do hóspede" required>
            <TextInput value={hospede} onChange={e => setHospede(e.target.value)} placeholder="Ex.: Maria Silva" />
          </Field>
          <Field label="Valor do crédito (R$)" required>
            <MoneyInput value={valor} onChange={e => setValor(e.target.value === '' ? '' : Number(e.target.value))} />
          </Field>
        </div>
        <div className="pm-dash-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Emitido em">
            <DateInput value={criadoEm} onChange={e => setCriadoEm(e.target.value)} />
          </Field>
          <Field label="Válido até" hint="Opcional">
            <DateInput value={validade} min={criadoEm} onChange={e => setValidade(e.target.value)} />
          </Field>
        </div>
        <Field label="Motivo" hint="Ex.: Cancelamento da reserva de 12–18/12 (PM-XXXX)">
          <TextInput value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: Cancelamento da reserva PM-XXXX" />
        </Field>
        <Field label="Notas" hint="Opcional — uso interno">
          <Textarea value={notas} onChange={e => setNotas(e.target.value)} style={{ minHeight: 80 }} />
        </Field>
      </div>
    </Modal>
  );
}
