import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Upload, X, Check, BedDouble, Copy } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { uid, money } from '../../lib/helpers';
import { Card, PageHead, Btn, Modal, Field, TextInput, NumberInput,
  Select, Textarea, PhotoTile, DragGrip, MoneyInput, duplicateInList } from '../../components/ui';
import { useReorder } from '../../hooks/useReorder';
import { iconBtn } from './Reservations';

export function Apartments({ data, update }) {
  const [editing, setEditing] = useState(null);
  const save = (a) => {
    update(prev => {
      const exists = prev.apartamentos.some(x => x.id === a.id);
      return { ...prev, apartamentos: exists ? prev.apartamentos.map(x => x.id === a.id ? a : x) : [...prev.apartamentos, a] };
    });
    setEditing(null);
  };
  const remove = (id) => { update(prev => ({ ...prev, apartamentos: prev.apartamentos.filter(x => x.id !== id) })); setEditing(null); };
  const duplicate = (id) => update(prev => ({ ...prev, apartamentos: duplicateInList(prev.apartamentos, id, a => ({ ...a, id: 'a' + uid(), nome: a.nome + ' (cópia)' })) }));
  const dnd = useReorder(data.apartamentos, (arr) => update(prev => ({ ...prev, apartamentos: arr })));
  const residencial = data.settings;

  return (
    <div>
      <PageHead title="Apartamentos" sub={`${data.apartamentos.length} unidades de ${residencial.nome} · arraste para ordenar`}
        action={<Btn icon={Plus} onClick={() => setEditing('new')}>Adicionar</Btn>} />
      <div style={{ display: 'grid', gap: 12 }}>
        {data.apartamentos.map((a, idx) => (
          <Card key={a.id} {...dnd.zone(idx)} style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, ...dnd.deco(idx) }}>
            <DragGrip {...dnd.grip(idx)} />
            <div style={{ width: 96, flexShrink: 0 }}><PhotoTile apt={a} h={64} radius={10} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.disp, fontSize: 18 }}>{a.nome} <span style={{ fontSize: 13, color: C.inkSoft, fontFamily: F.sans }}>— {a.piso} · {a.vista}</span></div>
              <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2, display: 'flex', gap: 14 }}>
                <span>Até {a.capacidade} pessoas</span><span>{money(a.preco)} / noite (base)</span>
                {!a.ativo && <span style={{ color: '#B23B3B', fontWeight: 600 }}>Inativo</span>}
              </div>
            </div>
            <button onClick={() => duplicate(a.id)} title="Duplicar" style={iconBtn}><Copy size={16} /></button>
            <button onClick={() => setEditing(a)} title="Editar" style={iconBtn}><Pencil size={16} /></button>
            <button onClick={() => remove(a.id)} title="Eliminar" style={{ ...iconBtn, color: '#B23B3B' }}><Trash2 size={16} /></button>
          </Card>
        ))}
      </div>
      {editing && <ApartmentForm initial={editing === 'new' ? null : editing} isNew={editing === 'new'} residencial={residencial} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}
/* ── ApartmentForm ── */
export const AMENIDADES_LIST = [
  'Ar Condicionado', 'Internet (Wi-Fi)', 'TV', 'Ducha', 'Cozinha', '1 Quarto + Sofá Cama',
  'Área com Churrasco', 'Área de Serviço', 'Fogão', 'Geladeira', 'Microondas', 'Máquina de Lavar',
  'Secador de Cabelo', 'Ferro de Passar', 'Estacionamento', 'Piscina', 'Academia', 'Churrasqueira',
  'Varanda', 'Vista para o Mar', 'Acessível', 'Berço disponível', 'Animais permitidos',
];
export const CAMA_TIPOS = ['Casal', 'Solteiro', 'Queen', 'King', 'Beliche', 'Sofá Cama', 'Colchão Extra'];

export function ApartmentForm({ initial, isNew, residencial, onSave, onClose }) {
  const i = initial || {};

  /* ── Visão geral ── */
  const [titulo, setTitulo] = useState(i.tipo || i.nome || '');
  const [hospedes, setHospedes] = useState(i.capacidade || 4);
  const [criancas, setCriancas] = useState(i.criancas || 0);
  const [tamanho, setTamanho] = useState(i.tamanho || '');
  const [piso, setPiso] = useState(i.piso || 'Térreo');
  const [vista, setVista] = useState(i.vista || 'Frente Mar');
  const [ativo, setAtivo] = useState(i.ativo !== false);

  /* ── Camas ── */
  const [camas, setCamas] = useState(i.camas || [{ id: uid(), tipo: 'Casal', qtd: 1 }]);
  const addCama = () => setCamas(c => [...c, { id: uid(), tipo: 'Solteiro', qtd: 1 }]);
  const updCama = (id, patch) => setCamas(c => c.map(x => x.id === id ? { ...x, ...patch } : x));
  const delCama = (id) => setCamas(c => c.filter(x => x.id !== id));

  /* ── Amenidades ── */
  const defaultAmen = new Set(i.amenidades || ['Ar Condicionado', 'Internet (Wi-Fi)', 'TV', 'Ducha', 'Cozinha', 'Geladeira']);
  const [amenidades, setAmenidades] = useState(defaultAmen);
  const [showAllAmen, setShowAllAmen] = useState(false);
  const toggleAmen = (a) => setAmenidades(prev => { const s = new Set(prev); s.has(a) ? s.delete(a) : s.add(a); return s; });
  const amenList = showAllAmen ? AMENIDADES_LIST : AMENIDADES_LIST.slice(0, 9);

  /* ── Fotos ── */
  const [fotos, setFotos] = useState(i.fotos || (i.foto ? [i.foto] : []));
  const [fotoInput, setFotoInput] = useState('');
  const addFoto = () => { const u = fotoInput.trim(); if (u) { setFotos(f => [...f, u]); setFotoInput(''); } };
  const delFoto = (idx) => setFotos(f => f.filter((_, j) => j !== idx));

  /* ── Descrição ── */
  const [descricao, setDescricao] = useState(i.descricao || '');

  /* ── Endereço ── */
  const [cidade, setCidade] = useState(i.cidade || residencial?.cidade || '');
  const [endereco, setEndereco] = useState(i.endereco || residencial?.endereco || '');
  const [cep, setCep] = useState(i.cep || residencial?.cep || '');
  const [mostrarMapa, setMostrarMapa] = useState(i.mostrarMapa !== false);

  /* ── Preço ── */
  const [preco, setPreco] = useState(i.preco || 0);
  const [precoFimSemana, setPrecoFimSemana] = useState(i.precoFimSemana || '');

  const nome = titulo.trim().split(' ').slice(0, 2).join(' ') || 'Apto';
  const ok = titulo.trim();

  /* ── Section wrapper ── */
  const Sec = ({ label, children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
      <div style={{ paddingTop: 2 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{label}</div>
      </div>
      <div>{children}</div>
    </div>
  );

  const SpinField = ({ label, value, onChange, min = 0, hint }) => (
    <div>
      <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 4 }}>
        {label} {hint && <span style={{ color: C.brisa, fontSize: 11 }}>ⓘ</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden', width: 90 }}>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          style={{ width: 28, height: 36, background: C.espuma, border: 'none', cursor: 'pointer', fontSize: 16, color: C.inkSoft, display: 'grid', placeItems: 'center' }}>−</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{value}</div>
        <button type="button" onClick={() => onChange(value + 1)}
          style={{ width: 28, height: 36, background: C.espuma, border: 'none', cursor: 'pointer', fontSize: 16, color: C.inkSoft, display: 'grid', placeItems: 'center' }}>+</button>
      </div>
    </div>
  );

  return (
    <Modal
      title={isNew ? 'Adicionar apartamento' : 'Editar seu apartamento'}
      subtitle={isNew ? '' : titulo}
      onClose={onClose} wide
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" disabled={!ok} style={{ opacity: ok ? 1 : .5 }}
            onClick={() => onSave({
              id: i.id || ('a' + uid()),
              residencialId: i.residencialId || residencial?.id,
              nome,
              tipo: titulo.trim(),
              piso, vista, ativo,
              capacidade: Number(hospedes),
              criancas: Number(criancas),
              tamanho: tamanho ? String(tamanho) : '',
              camas,
              amenidades: [...amenidades],
              fotos,
              foto: fotos[0] || '',
              descricao: descricao.trim(),
              cidade: cidade.trim(),
              endereco: endereco.trim(),
              cep: cep.trim(),
              mostrarMapa,
              preco: Number(preco) || 0,
              precoFimSemana: Number(precoFimSemana) || 0,
            })}>
            Salvar
          </Btn>
        </>
      }>

      <div style={{ padding: '0 2px' }}>

        {/* ── 1. Visão geral ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ paddingTop: 2 }}><div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Visão geral</div></div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
              <Field label="Título do apartamento" required>
                <TextInput value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Apto 102 - Térreo Frente Mar, 4 pessoas" />
              </Field>
              <Field label="Unidades" hint="ⓘ">
                <NumberInput value={1} readOnly style={{ background: C.espuma }} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'end' }}>
              <SpinField label="Hóspedes" hint value={hospedes} onChange={setHospedes} min={1} />
              <SpinField label="Crianças" hint value={criancas} onChange={setCriancas} min={0} />
              <Field label="Tamanho" hint="m²">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <NumberInput min={0} value={tamanho} onChange={e => setTamanho(e.target.value)} style={{ width: '100%' }} placeholder="38" />
                  <span style={{ fontSize: 13, color: C.inkSoft, flexShrink: 0 }}>m²</span>
                </div>
              </Field>
              <Field label="Ativo">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 8 }}>
                  <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>Visível no site</span>
                </label>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Piso">
                <Select value={piso} onChange={e => setPiso(e.target.value)}>
                  {['Térreo', '1º Piso', '2º Piso', '3º Piso'].map(o => <option key={o}>{o}</option>)}
                </Select>
              </Field>
              <Field label="Vista">
                <Select value={vista} onChange={e => setVista(e.target.value)}>
                  {['Frente Mar', 'Beira-mar', 'Lateral', 'Interior'].map(o => <option key={o}>{o}</option>)}
                </Select>
              </Field>
            </div>
          </div>
        </div>

        {/* ── 2. Camas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ paddingTop: 2 }}><div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Camas</div></div>
          <div style={{ display: 'grid', gap: 10 }}>
            {camas.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>Tipo de cama</div>
                  <Select value={c.tipo} onChange={e => updCama(c.id, { tipo: e.target.value })} style={{ width: '100%' }}>
                    {CAMA_TIPOS.map(t => <option key={t}>{t}</option>)}
                  </Select>
                </div>
                <div style={{ width: 90 }}>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>Quantidade</div>
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
                    <button type="button" onClick={() => updCama(c.id, { qtd: Math.max(1, c.qtd - 1) })} style={{ width: 28, height: 36, background: C.espuma, border: 'none', cursor: 'pointer', fontSize: 16, color: C.inkSoft, display: 'grid', placeItems: 'center' }}>−</button>
                    <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{c.qtd}</div>
                    <button type="button" onClick={() => updCama(c.id, { qtd: c.qtd + 1 })} style={{ width: 28, height: 36, background: C.espuma, border: 'none', cursor: 'pointer', fontSize: 16, color: C.inkSoft, display: 'grid', placeItems: 'center' }}>+</button>
                  </div>
                </div>
                <button type="button" onClick={() => delCama(c.id)} style={{ ...iconBtn, marginTop: 18, color: '#B23B3B' }}><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" onClick={addCama}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: `1px dashed ${C.line}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: C.brisa, fontWeight: 600, fontSize: 13, alignSelf: 'flex-start' }}>
              <Plus size={14} /> Escolha o tipo
            </button>
          </div>
        </div>

        {/* ── 3. Amenidades ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ paddingTop: 2 }}><div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Amenidades</div></div>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 12px' }}>
              {amenList.map(a => (
                <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13.5 }}>
                  <input type="checkbox" checked={amenidades.has(a)} onChange={() => toggleAmen(a)}
                    style={{ accentColor: C.brisa, width: 15, height: 15, flexShrink: 0 }} />
                  {a}
                </label>
              ))}
            </div>
            <button type="button" onClick={() => setShowAllAmen(s => !s)}
              style={{ background: 'none', border: 'none', color: C.brisa, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginTop: 10, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              {showAllAmen ? '− Menos amenidades' : '+ Mais amenidades'}
            </button>
          </div>
        </div>

        {/* ── 4. Fotos ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ paddingTop: 2 }}><div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Fotos</div></div>
          <div>
            {fotos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, marginBottom: 12 }}>
                {fotos.map((f, idx) => (
                  <div key={idx} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3', background: C.espuma }}>
                    <img src={f} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }} />
                    <button type="button" onClick={() => delFoto(idx)}
                      style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,.55)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12, display: 'grid', placeItems: 'center', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <TextInput value={fotoInput} onChange={e => setFotoInput(e.target.value)}
                placeholder="Cole o URL de uma foto (https://...)" style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFoto())} />
              <Btn variant="soft" onClick={addFoto} icon={Plus}>Adicionar</Btn>
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}>
              {fotos.length}/10 fotos · A primeira foto é a imagem principal do apartamento.
            </div>
          </div>
        </div>

        {/* ── 5. Descrição ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ paddingTop: 2 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Descrição</div>
            <div style={{ fontSize: 12, color: C.brisa, marginTop: 8, cursor: 'pointer', fontWeight: 600 }}>Encontre Ideias</div>
          </div>
          <div>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value.slice(0, 2000))}
              placeholder={`Acomodação para até ${hospedes} pessoas.\n\nDescreva o apartamento, a vista, a localização e os destaques...`}
              style={{ minHeight: 120, resize: 'vertical' }} />
            <div style={{ fontSize: 11.5, color: C.inkSoft, textAlign: 'right', marginTop: 4 }}>{descricao.length}/2000</div>
          </div>
        </div>

        {/* ── 6. Endereço ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ paddingTop: 2 }}><div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Endereço</div></div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.inkSoft }}>Mostrar mapa de localização</span>
              <div onClick={() => setMostrarMapa(m => !m)} style={{ width: 42, height: 24, borderRadius: 12, background: mostrarMapa ? C.brisa : C.line, cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: mostrarMapa ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left .2s' }} />
              </div>
            </div>
            <Field label="Cidade, Estado, País" hint="ⓘ">
              <TextInput value={cidade} onChange={e => setCidade(e.target.value)} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
              <Field label="Endereço"><TextInput value={endereco} onChange={e => setEndereco(e.target.value)} /></Field>
              <Field label="Código postal (CEP)"><TextInput value={cep} onChange={e => setCep(e.target.value)} /></Field>
            </div>
            {mostrarMapa && (
              <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.line}`, height: 180, background: C.espuma, display: 'grid', placeItems: 'center' }}>
                <iframe title="mapa" width="100%" height="180" style={{ border: 0, display: 'block' }}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(endereco + ', ' + cidade)}&output=embed&zoom=15`}
                  loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            )}
          </div>
        </div>

        {/* ── 7. Preço ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 28px', padding: '24px 0 8px' }}>
          <div style={{ paddingTop: 2 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Preço</div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>(antes de impostos)</div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 12, alignItems: 'end' }}>
              <Field label="Tipo de cobrança">
                <Select value="Por noite" readOnly style={{ background: C.espuma }}>
                  <option>Por noite</option>
                </Select>
              </Field>
              <Field label="Preço durante a semana" hint="ⓘ">
                <MoneyInput value={preco} onChange={e => setPreco(e.target.value === '' ? '' : Number(e.target.value))} />
              </Field>
              <Field label="Preço de fim de semana" hint="ⓘ">
                <MoneyInput value={precoFimSemana} onChange={e => setPrecoFimSemana(e.target.value === '' ? '' : Number(e.target.value))} />
              </Field>
            </div>
            <div style={{ fontSize: 12, color: C.brisa, cursor: 'pointer', fontWeight: 600 }}>+ Mais opções de preço</div>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
              O preço base é usado como referência quando não há temporada activa. Para tarifas diferenciadas por período use <b>Opções de preços</b>.
            </p>
          </div>
        </div>

      </div>
    </Modal>
  );
}

/* ── Seasons ── */
