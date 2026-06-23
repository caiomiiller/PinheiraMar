import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, Copy } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { uid, money } from '../../lib/helpers';
import { Card, PageHead, Btn, Modal, Field, TextInput, DateInput,
  NumberInput, Badge, duplicateInList } from '../../components/ui';

export function Seasons({ data, update }) {
  const [editing, setEditing] = useState(null);
  const t = today();
  const save = (s) => {
    update(prev => { const ex = prev.seasons.some(x => x.id === s.id); return { ...prev, seasons: ex ? prev.seasons.map(x => x.id === s.id ? s : x) : [...prev.seasons, s] }; });
    setEditing(null);
  };
  const remove = (id) => { update(prev => ({ ...prev, seasons: prev.seasons.filter(x => x.id !== id) })); setEditing(null); };
  const duplicate = (id) => update(prev => ({ ...prev, seasons: duplicateInList(prev.seasons, id, s => ({ ...s, id: 's' + uid(), nome: s.nome + ' (cópia)', precos: Object.fromEntries(Object.entries(s.precos || {}).map(([k, v]) => [k, { ...v }])) })) }));
  const dnd = useReorder(data.seasons, (arr) => update(prev => ({ ...prev, seasons: arr })));
  const priceRange = (s) => {
    const vals = data.apartamentos.map(a => Number(s.precos?.[a.id]?.diaSemana) || 0).filter(Boolean);
    if (!vals.length) return '—';
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`;
  };

  return (
    <div>
      <PageHead title="Opções de preços por temporada" sub="Defina a tarifa de cada apartamento por período · arraste para ordenar."
        action={<Btn icon={Plus} onClick={() => setEditing('new')}>Nova temporada</Btn>} />
      <div style={{ display: 'grid', gap: 10 }}>
        {data.seasons.map((s, idx) => {
          const ativa = s.ativa !== false && parseYMD(s.inicio) <= t && t <= parseYMD(s.fim);
          return (
            <Card key={s.id} {...dnd.zone(idx)} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', ...dnd.deco(idx) }}>
              <DragGrip {...dnd.grip(idx)} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: F.disp, fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {s.nome}
                  {ativa && <span style={{ fontSize: 11.5, fontWeight: 700, color: C.coralDeep, background: '#FBE6DD', padding: '2px 9px', borderRadius: 999, fontFamily: F.sans }}>● Em vigor</span>}
                  {s.ativa === false && <span style={{ fontSize: 11.5, color: C.inkSoft, fontFamily: F.sans }}>(desativada)</span>}
                </div>
                <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>{fmtLong(s.inicio)} – {fmtLong(s.fim)} · mín. {s.minNoites || 1} noite(s){s.maxNoites ? ` · máx. ${s.maxNoites}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{priceRange(s)}</div>
                <div style={{ fontSize: 11.5, color: C.inkSoft }}>diária / apartamento</div>
              </div>
              <button onClick={() => duplicate(s.id)} title="Duplicar" style={iconBtn}><Copy size={16} /></button>
              <button onClick={() => setEditing(s)} title="Editar" style={iconBtn}><Pencil size={16} /></button>
              <button onClick={() => remove(s.id)} title="Eliminar" style={{ ...iconBtn, color: '#B23B3B' }}><Trash2 size={16} /></button>
            </Card>
          );
        })}
      </div>
      {editing && <SeasonForm initial={editing === 'new' ? null : editing} isNew={editing === 'new'} apartamentos={data.apartamentos} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

export const PRICE_FIELDS = [['diaSemana', 'Dia da semana'], ['fimSemana', 'Fim de semana'], ['semanal', 'Semanal'], ['mensal', 'Mensal'], ['adultoExtra', 'Adulto extra']];
export function SeasonForm({ initial, isNew, apartamentos, onSave, onClose }) {
  const i = initial || {};
  const [nome, setNome] = useState(i.nome || '');
  const [inicio, setInicio] = useState(i.inicio || ymd(today()));
  const [fim, setFim] = useState(i.fim || ymd(addDays(today(), 30)));
  const [minN, setMinN] = useState(i.minNoites ?? 2);
  const [maxN, setMaxN] = useState(i.maxNoites ?? '');
  const [ativa, setAtiva] = useState(i.ativa !== false);
  const defFor = (a) => ({ diaSemana: a.preco, fimSemana: Math.round(a.preco * 1.15), semanal: 0, mensal: 0, adultoExtra: 0 });
  const [precos, setPrecos] = useState(() => {
    const base = {};
    apartamentos.forEach(a => { base[a.id] = { ...defFor(a), ...(i.precos && i.precos[a.id] ? i.precos[a.id] : {}) }; });
    return base;
  });
  const setP = (aid, field, val) => setPrecos(p => ({ ...p, [aid]: { ...p[aid], [field]: val === '' ? '' : Number(val) } }));
  const ok = nome.trim() && parseYMD(fim) >= parseYMD(inicio);

  return (
    <Modal title={isNew ? 'Nova regra sazonal' : `Editar ${i.nome}`} subtitle="Defina o valor de cada apartamento dentro deste período." onClose={onClose} wide
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={!ok} style={{ opacity: ok ? 1 : .5 }}
          onClick={() => onSave({
            id: i.id || ('s' + uid()), nome: nome.trim(), inicio, fim, ativa,
            minNoites: Number(minN) || 1, maxNoites: maxN === '' ? null : Number(maxN),
            precos: Object.fromEntries(apartamentos.map(a => [a.id, {
              diaSemana: Number(precos[a.id]?.diaSemana) || 0, fimSemana: Number(precos[a.id]?.fimSemana) || 0,
              semanal: Number(precos[a.id]?.semanal) || 0, mensal: Number(precos[a.id]?.mensal) || 0, adultoExtra: Number(precos[a.id]?.adultoExtra) || 0,
            }])),
          })}>{isNew ? 'Salvar' : 'Guardar alterações'}</Btn></>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Field label="Nomeie sua temporada" required><TextInput value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Alta 2027-2028" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Início da temporada" required><DateInput value={inicio} onChange={e => setInicio(e.target.value)} /></Field>
          <Field label="Fim da temporada" required><DateInput value={fim} min={inicio} onChange={e => setFim(e.target.value)} /></Field>
          <Field label="Mín. de noites"><NumberInput min={1} value={minN} onChange={e => setMinN(e.target.value)} /></Field>
          <Field label="Máx. de noites" hint="Deixe vazio para sem limite"><NumberInput min={0} value={maxN} onChange={e => setMaxN(e.target.value)} /></Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={ativa} onChange={e => setAtiva(e.target.checked)} /> Temporada ativa (aplicar estes preços)
        </label>

        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
          <div style={secTitle}><Wallet size={16} color={C.brisa} /> Encargos por acomodação</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {apartamentos.map(a => (
              <div key={a.id} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 76, flexShrink: 0 }}><PhotoTile apt={a} h={50} radius={9} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{roomFullName(a)}</div>
                    <div style={{ fontSize: 11.5, color: C.inkSoft }}>Encargos por acomodação · 1 unidade</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 10 }}>
                  {PRICE_FIELDS.map(([key, label]) => (
                    <div key={key}>
                      <div style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 4 }}>{label}</div>
                      <MoneyInput value={precos[a.id]?.[key] ?? ''} onChange={e => setP(a.id, key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: C.inkSoft, margin: '10px 2px 0' }}>A diária usa o valor de <b>dia da semana</b>; nas noites de sexta e sábado usa <b>fim de semana</b> (quando preenchido). Semanal, mensal e adulto extra ficam disponíveis como referência na criação da reserva.</p>
        </div>
      </div>
    </Modal>
  );
}

/* ── Settings ── */
/* ── PoliticasView ── */
