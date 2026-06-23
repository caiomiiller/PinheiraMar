import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { Card, PageHead, Btn, Field, TextInput, Select } from '../../components/ui';

export function SettingsView({ data, update }) {
  const [s, setS] = useState(data.settings);
  const [saved, setSaved] = useState(false);
  const set = (k, v) => { setS(p => ({ ...p, [k]: v })); setSaved(false); };
  const onSave = () => { update(prev => ({ ...prev, settings: s })); setSaved(true); };
  return (
    <div>
      <PageHead title="Configurações gerais" sub="Dados do residencial usados no site e nas reservas"
        action={<Btn variant="primary" icon={saved ? Check : undefined} onClick={onSave}>{saved ? 'Guardado' : 'Guardar'}</Btn>} />
      <Card style={{ padding: 22, marginBottom: 16 }}>
        <h3 style={{ fontFamily: F.disp, fontSize: 19, margin: '0 0 16px' }}>Informações de negócio</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Nome da propriedade" required><TextInput value={s.nome} onChange={e => set('nome', e.target.value)} /></Field>
          <Field label="Tipo"><Select value={s.tipo} onChange={e => set('tipo', e.target.value)}>{['Apartamento', 'Pousada', 'Hotel', 'Casa'].map(o => <option key={o}>{o}</option>)}</Select></Field>
          <Field label="Email de contacto" required><TextInput value={s.email} onChange={e => set('email', e.target.value)} /></Field>
          <Field label="Telefone" required><TextInput value={s.telefone} onChange={e => set('telefone', e.target.value)} /></Field>
        </div>
      </Card>
      <Card style={{ padding: 22, marginBottom: 16 }}>
        <h3 style={{ fontFamily: F.disp, fontSize: 19, margin: '0 0 16px' }}>Endereço</h3>
        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="Cidade, Estado, País"><TextInput value={s.cidade} onChange={e => set('cidade', e.target.value)} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <Field label="Endereço"><TextInput value={s.endereco} onChange={e => set('endereco', e.target.value)} /></Field>
            <Field label="Código postal (CEP)"><TextInput value={s.cep} onChange={e => set('cep', e.target.value)} /></Field>
          </div>
        </div>
      </Card>
      <Card style={{ padding: 22 }}>
        <h3 style={{ fontFamily: F.disp, fontSize: 19, margin: '0 0 16px' }}>Configurações regionais e reservas</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Fuso horário"><TextInput value={s.fuso} onChange={e => set('fuso', e.target.value)} /></Field>
          <Field label="Moeda"><Select value={s.moeda} onChange={e => set('moeda', e.target.value)}>{['Real Brasileiro (R$)', 'Euro (€)', 'Dólar (US$)'].map(o => <option key={o}>{o}</option>)}</Select></Field>
          <Field label="Hora de check-in" hint="Entrada a partir desta hora."><TextInput value={s.checkInHora} onChange={e => set('checkInHora', e.target.value)} /></Field>
          <Field label="Hora de check-out" hint="Saída até esta hora — permite turnover no mesmo dia."><TextInput value={s.checkOutHora} onChange={e => set('checkOutHora', e.target.value)} /></Field>
          <Field label="Sinal exigido (% do total)"><NumberInput min={0} max={100} value={s.sinalPct} onChange={e => set('sinalPct', Number(e.target.value))} /></Field>
        </div>
      </Card>
    </div>
  );
}

/* ── Payments ── */
