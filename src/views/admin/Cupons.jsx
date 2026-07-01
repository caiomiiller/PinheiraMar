import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X, Tag, AlertCircle } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { money, uid, today, parseYMD, fmtShort, ymd, addDays } from '../../lib/helpers';
import { Card, PageHead, Btn, Modal, Field, TextInput, NumberInput,
  Select, DateInput, Badge, MoneyInput } from '../../components/ui';
import { iconBtn } from './Reservations';

export function CuponsView({ data, update }) {
  const cupons = data.cupons || [];
  const [editing, setEditing] = useState(null);
  const t = today();

  const save = (c) => {
    update(prev => {
      const list = prev.cupons || [];
      const exists = list.some(x => x.id === c.id);
      return { ...prev, cupons: exists ? list.map(x => x.id === c.id ? c : x) : [...list, c] };
    });
    setEditing(null);
  };
  const remove = (id) => update(prev => ({ ...prev, cupons: (prev.cupons || []).filter(x => x.id !== id) }));

  const statusCupon = (c) => {
    if (!c.ativo) return { label: 'Inactivo', cor: C.inkSoft, bg: C.espuma };
    if (parseYMD(c.fim) < t) return { label: 'Expirado', cor: '#B23B3B', bg: '#FFF5F5' };
    if (c.maxUsos > 0 && c.usos >= c.maxUsos) return { label: 'Esgotado', cor: '#B26A2E', bg: '#FBF1E6' };
    return { label: 'Activo', cor: '#1C7A5B', bg: '#D1FAE5' };
  };

  return (
    <div>
      <PageHead title="Cupons de Desconto"
        sub="Crie códigos promocionais para os seus hóspedes."
        action={<Btn icon={Plus} onClick={() => setEditing('new')}>Adicionar</Btn>} />

      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
        {/* header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 0.6fr 80px 72px', gap: 12, padding: '10px 20px', background: C.espuma, borderBottom: `1px solid ${C.line}`, fontSize: 12, fontWeight: 700, color: C.inkSoft }}>
          <span>NOME / CÓDIGO</span><span>DESCONTO</span><span>VALIDADE</span><span>USOS</span><span>ESTADO</span><span></span>
        </div>
        {cupons.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: C.inkSoft, fontSize: 14 }}>
            Nenhum cupão criado ainda. Clique em <b>Adicionar</b> para criar o primeiro.
          </div>
        )}
        {cupons.map((c, idx) => {
          const st = statusCupon(c);
          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 0.6fr 80px 72px', gap: 12, alignItems: 'center', padding: '14px 20px', borderBottom: idx < cupons.length - 1 ? `1px solid ${C.line}` : 'none' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.ocean, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</div>
                <div style={{ fontSize: 12.5, fontFamily: 'monospace', color: C.inkSoft, marginTop: 2, letterSpacing: '.04em' }}>{c.codigo}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {c.tipo === 'percentagem' ? `${c.valor}%` : money(c.valor)}
                <div style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: 400 }}>{c.tipo === 'percentagem' ? 'desconto' : 'valor fixo'}</div>
              </div>
              <div style={{ fontSize: 13 }}>
                {fmtShort(c.inicio)} – {fmtShort(c.fim)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.usos} / {c.maxUsos === 0 ? '∞' : c.maxUsos}</div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: st.cor, background: st.bg, borderRadius: 999, padding: '3px 9px' }}>{st.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditing(c)} style={iconBtn} title="Editar"><Pencil size={14} /></button>
                <button onClick={() => remove(c.id)} style={{ ...iconBtn, color: '#B23B3B' }} title="Eliminar"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* apply cupon note */}
      <div style={{ marginTop: 14, padding: '12px 16px', background: '#EEF6FF', border: '1px solid #BDD9F8', borderRadius: 12, fontSize: 13, color: '#1A4A7A' }}>
        <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Para aplicar um cupão a uma reserva, abra a reserva no painel e adicione o desconto manualmente no campo de extras (valor negativo). A validação automática no checkout requer integração com backend.
      </div>

      {editing && <CuponForm initial={editing === 'new' ? null : editing} isNew={editing === 'new'} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

export function CuponForm({ initial, isNew, onSave, onClose }) {
  const i = initial || {};
  const t = today();
  const [nome, setNome] = useState(i.nome || '');
  const [codigo, setCodigo] = useState(i.codigo || '');
  const [tipo, setTipo] = useState(i.tipo || 'percentagem');
  const [valor, setValor] = useState(i.valor ?? 10);
  const [inicio, setInicio] = useState(i.inicio || ymd(t));
  const [fim, setFim] = useState(i.fim || ymd(addDays(t, 180)));
  const [maxUsos, setMaxUsos] = useState(i.maxUsos ?? 1);
  const [ativo, setAtivo] = useState(i.ativo !== false);
  const ok = nome.trim() && codigo.trim() && Number(valor) > 0;

  const gerarCodigo = () => {
    const base = nome.trim().split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCodigo(base + Math.floor(Math.random() * 900 + 100));
  };

  return (
    <Modal title={isNew ? 'Criar Cupão de Desconto' : `Editar — ${i.nome}`} onClose={onClose} wide
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={!ok} style={{ opacity: ok ? 1 : .5 }}
          onClick={() => onSave({
            id: i.id || ('cup' + uid()), nome: nome.trim(),
            codigo: codigo.trim().toUpperCase(), tipo, valor: Number(valor),
            inicio, fim, maxUsos: Number(maxUsos), usos: i.usos ?? 0, ativo,
          })}>
          {isNew ? 'Criar cupão' : 'Salvar alterações'}
        </Btn>
      </>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Nome do cupão" required hint="Para identificação interna">
            <TextInput value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Desconto Fidelidade" />
          </Field>
          <Field label="Código do cupão" required hint="O hóspede usa este código">
            <div style={{ display: 'flex', gap: 8 }}>
              <TextInput value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ex.: PINHEIRA10" style={{ flex: 1, fontFamily: 'monospace', letterSpacing: '.05em', textTransform: 'uppercase' }} />
              <Btn variant="soft" size="sm" onClick={gerarCodigo}>Gerar</Btn>
            </div>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Tipo de desconto">
            <Select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="percentagem">Percentagem (%)</option>
              <option value="fixo">Valor fixo (R$)</option>
            </Select>
          </Field>
          <Field label={tipo === 'percentagem' ? 'Desconto (%)' : 'Desconto (R$)'} required>
            {tipo === 'percentagem'
              ? <NumberInput min={1} max={100} value={valor} onChange={e => setValor(e.target.value)} />
              : <MoneyInput value={valor} onChange={e => setValor(e.target.value === '' ? '' : Number(e.target.value))} />}
          </Field>
          <Field label="Máximo de usos" hint="0 = ilimitado">
            <NumberInput min={0} value={maxUsos} onChange={e => setMaxUsos(e.target.value)} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Válido de" required><DateInput value={inicio} onChange={e => setInicio(e.target.value)} /></Field>
          <Field label="Válido até" required><DateInput value={fim} min={inicio} onChange={e => setFim(e.target.value)} /></Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Cupão activo
        </label>
        {codigo && (
          <div style={{ padding: '12px 16px', background: C.espuma, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 2 }}>Pré-visualização do cupão</div>
              <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, letterSpacing: '.1em', color: C.ocean }}>{codigo}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.coralDeep }}>{tipo === 'percentagem' ? `-${valor}%` : `-${money(valor)}`}</div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>{fmtShort(inicio)} – {fmtShort(fim)}</div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

