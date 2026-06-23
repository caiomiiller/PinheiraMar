import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { money, uid } from '../../lib/helpers';
import { Card, PageHead, Btn, Modal, Field, TextInput, NumberInput, Select } from '../../components/ui';

export function TaxasView({ data, update }) {
  const taxas = data.taxasAdicionais || [];
  const [editing, setEditing] = useState(null);

  const save = (tx) => {
    update(prev => {
      const list = prev.taxasAdicionais || [];
      const exists = list.some(x => x.id === tx.id);
      return { ...prev, taxasAdicionais: exists ? list.map(x => x.id === tx.id ? tx : x) : [...list, tx] };
    });
    setEditing(null);
  };
  const remove = (id) => update(prev => ({ ...prev, taxasAdicionais: (prev.taxasAdicionais || []).filter(x => x.id !== id) }));
  const dnd = useReorder(taxas, arr => update(prev => ({ ...prev, taxasAdicionais: arr })));

  const TIPO_LABEL = { obrigatoria: 'Obrigatória', opcional: 'Opcional' };
  const POR_LABEL  = { reserva: 'Reserva', noite: 'Noite', hospede: 'Hóspede' };

  return (
    <div>
      <PageHead title="Taxas Adicionais"
        sub="Taxas obrigatórias ou opcionais apresentadas ao hóspede durante a reserva · arraste para ordenar."
        action={<Btn icon={Plus} onClick={() => setEditing('new')}>Adicionar</Btn>} />

      <div style={{ display: 'grid', gap: 0, background: '#fff', borderRadius: 16, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
        {taxas.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: C.inkSoft, fontSize: 14 }}>
            Nenhuma taxa configurada. Clique em <b>Adicionar</b> para criar a primeira.
          </div>
        )}
        {taxas.map((tx, idx) => (
          <div key={tx.id} {...dnd.zone(idx)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: idx < taxas.length - 1 ? `1px solid ${C.line}` : 'none', ...dnd.deco(idx) }}>
            <DragGrip {...dnd.grip(idx)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: C.ocean, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.nome}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, minWidth: 64, textAlign: 'right' }}>{money(tx.preco)}</div>
            <div style={{ minWidth: 90, textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: tx.tipo === 'obrigatoria' ? '#1C7A5B' : C.inkSoft, background: tx.tipo === 'obrigatoria' ? '#D1FAE5' : C.espuma, borderRadius: 999, padding: '3px 10px', fontWeight: 600 }}>
                {TIPO_LABEL[tx.tipo] || tx.tipo}
              </span>
            </div>
            <div style={{ minWidth: 72, fontSize: 13, color: C.inkSoft, textAlign: 'center' }}>{POR_LABEL[tx.por] || tx.por}</div>
            <button onClick={() => setEditing(tx)} style={iconBtn} title="Editar"><Pencil size={15} /></button>
            <button onClick={() => remove(tx.id)} style={{ ...iconBtn, color: '#B23B3B' }} title="Eliminar"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, padding: '12px 16px', background: '#EEF6FF', border: '1px solid #BDD9F8', borderRadius: 12, fontSize: 13, color: '#1A4A7A' }}>
        <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        As taxas <b>obrigatórias</b> são adicionadas automaticamente a cada reserva. As <b>opcionais</b> ficam disponíveis como chips rápidos no formulário de reserva para o gestor adicionar manualmente.
      </div>

      {editing && <TaxaForm initial={editing === 'new' ? null : editing} isNew={editing === 'new'} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

export function TaxaForm({ initial, isNew, onSave, onClose }) {
  const i = initial || {};
  const [nome, setNome] = useState(i.nome || '');
  const [preco, setPreco] = useState(i.preco ?? 0);
  const [tipo, setTipo] = useState(i.tipo || 'opcional');
  const [por, setPor] = useState(i.por || 'reserva');
  const ok = nome.trim() && Number(preco) >= 0;

  return (
    <Modal
      title={isNew ? 'Adicionar Taxa Adicional' : 'Editar Sua Taxa Adicional'}
      onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={!ok} style={{ opacity: ok ? 1 : .5 }}
          onClick={() => onSave({ id: i.id || ('tx' + uid()), nome: nome.trim(), preco: Number(preco), tipo, por })}>
          {isNew ? 'Adicionar' : 'Salvar alterações'}
        </Btn>
      </>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Field label="Nomeie sua taxa" required hint="ⓘ">
          <TextInput value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Higienização e Serviços de Hospedagem" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Adicione a taxa por" hint="ⓘ">
            <Select value={por} onChange={e => setPor(e.target.value)}>
              <option value="reserva">Reserva</option>
              <option value="noite">Noite</option>
              <option value="hospede">Hóspede</option>
            </Select>
          </Field>
          <Field label="Defina o preço">
            <MoneyInput value={preco} onChange={e => setPreco(e.target.value === '' ? '' : Number(e.target.value))} />
          </Field>
          <Field label="Defina o tipo de taxa" hint="ⓘ">
            <Select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="obrigatoria">Obrigatória</option>
              <option value="opcional">Opcional</option>
            </Select>
          </Field>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: C.inkSoft }}>
          * Campos obrigatórios
        </p>
      </div>
    </Modal>
  );
}

/* ── CuponsView ── */
