import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { Card, PageHead, Btn } from '../../components/ui';

export const IDIOMAS_DISPONIVEIS = [
  { codigo: 'pt', nome: 'Português', nativo: 'Português', bandeira: '🇧🇷' },
  { codigo: 'es', nome: 'Espanhol', nativo: 'Español', bandeira: '🇦🇷' },
  { codigo: 'en', nome: 'Inglês', nativo: 'English', bandeira: '🇺🇸' },
  { codigo: 'de', nome: 'Alemão', nativo: 'Deutsch', bandeira: '🇩🇪' },
  { codigo: 'fr', nome: 'Francês', nativo: 'Français', bandeira: '🇫🇷' },
  { codigo: 'it', nome: 'Italiano', nativo: 'Italiano', bandeira: '🇮🇹' },
];

export function IdiomasView({ data, update }) {
  const idiomas = data.settings.idiomas || [
    { codigo: 'pt', nome: 'Português', nativo: 'Português', bandeira: '🇧🇷', principal: true, ativo: true },
  ];
  const [showAdd, setShowAdd] = useState(false);
  const [editando, setEditando] = useState(null); // { codigo, nativo, bandeira }

  const saveIdiomas = (list) => update(prev => ({ ...prev, settings: { ...prev.settings, idiomas: list } }));

  const toggle = (codigo) => saveIdiomas(idiomas.map(i => i.codigo === codigo ? { ...i, ativo: !i.ativo } : i));
  const remove = (codigo) => saveIdiomas(idiomas.filter(i => i.codigo !== codigo));
  const add = (lang) => {
    if (idiomas.find(i => i.codigo === lang.codigo)) return;
    saveIdiomas([...idiomas, { ...lang, principal: false, ativo: true }]);
    setShowAdd(false);
  };
  const saveEdit = (codigo, patch) => {
    saveIdiomas(idiomas.map(i => i.codigo === codigo ? { ...i, ...patch } : i));
    setEditando(null);
  };

  const available = IDIOMAS_DISPONIVEIS.filter(l => !idiomas.find(i => i.codigo === l.codigo));
  const principal = idiomas.find(i => i.principal);
  const outros = idiomas.filter(i => !i.principal);

  return (
    <div>
      <PageHead
        title="Idiomas"
        sub="Escolha em que idiomas o site de reservas é apresentado aos hóspedes."
        action={<Btn icon={Plus} onClick={() => setShowAdd(true)}>Adicionar</Btn>}
      />

      <div style={{ display: 'grid', gap: 10, maxWidth: 760 }}>

        {/* idioma principal — fixo, sem toggle */}
        {principal && (
          <Card style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>{principal.bandeira}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 17 }}>{principal.nativo}</span>
              <span style={{ marginLeft: 10, fontSize: 13, color: C.inkSoft, background: C.espuma, border: `1px solid ${C.line}`, borderRadius: 999, padding: '2px 9px', fontWeight: 600 }}>Idioma Principal</span>
            </div>
          </Card>
        )}

        {/* outros idiomas */}
        {outros.map(lang => (
          <Card key={lang.codigo} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>{lang.bandeira}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{lang.nativo}</span>
              <span style={{ marginLeft: 8, fontSize: 13, color: C.inkSoft }}>({lang.nome})</span>
              {!TRANSLATIONS[lang.codigo] && (
                <span style={{ marginLeft: 8, fontSize: 11.5, color: '#B26A2E', background: '#FBF1E6', border: '1px solid #EBD9C0', borderRadius: 999, padding: '2px 8px', fontWeight: 600 }}>Tradução parcial</span>
              )}
            </div>

            {/* toggle activo/inactivo */}
            <div onClick={() => toggle(lang.codigo)}
              style={{ width: 46, height: 26, borderRadius: 13, background: lang.ativo ? C.brisa : C.line, cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: lang.ativo ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left .2s' }} />
            </div>

            <button onClick={() => setEditando(lang)} style={iconBtn} title="Editar"><Pencil size={15} /></button>
            <button onClick={() => remove(lang.codigo)} style={{ ...iconBtn, color: '#B23B3B' }} title="Remover"><Trash2 size={15} /></button>
          </Card>
        ))}

        {outros.length === 0 && (
          <div style={{ padding: '20px 16px', color: C.inkSoft, fontSize: 14, textAlign: 'center', background: '#fff', borderRadius: 12, border: `1px dashed ${C.line}` }}>
            Nenhum idioma adicional configurado. Clique em <b>Adicionar</b> para disponibilizar o site em mais idiomas.
          </div>
        )}
      </div>

      {/* info note */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px', background: '#EEF6FF', border: '1px solid #BDD9F8', borderRadius: 12, marginTop: 18, fontSize: 13.5, color: '#1A4A7A', maxWidth: 760 }}>
        <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Os idiomas activos aparecem como selector de bandeira no canto do site público. O hóspede escolhe o idioma e todas as etiquetas, botões e textos do site são apresentados na língua seleccionada. Português é sempre o idioma principal e não pode ser removido.</span>
      </div>

      {/* Add language modal */}
      {showAdd && (
        <Modal title="Adicionar idioma" onClose={() => setShowAdd(false)}
          footer={<Btn variant="ghost" onClick={() => setShowAdd(false)}>Fechar</Btn>}>
          {available.length === 0
            ? <p style={{ color: C.inkSoft, fontSize: 14 }}>Todos os idiomas disponíveis já foram adicionados.</p>
            : <div style={{ display: 'grid', gap: 8 }}>
              {available.map(lang => (
                <button key={lang.codigo} onClick={() => add(lang)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.espuma, border: `1px solid ${C.line}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <span style={{ fontSize: 24 }}>{lang.bandeira}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{lang.nativo}</div>
                    <div style={{ fontSize: 13, color: C.inkSoft }}>{lang.nome}{!TRANSLATIONS[lang.codigo] ? ' · tradução parcial' : ' · tradução completa'}</div>
                  </div>
                  <Plus size={16} color={C.brisa} style={{ marginLeft: 'auto' }} />
                </button>
              ))}
            </div>}
        </Modal>
      )}

      {/* Edit language modal */}
      {editando && (
        <Modal title={`Editar — ${editando.nome}`} onClose={() => setEditando(null)}
          footer={<>
            <Btn variant="ghost" onClick={() => setEditando(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={() => saveEdit(editando.codigo, { nativo: editando.nativo, bandeira: editando.bandeira })}>Guardar</Btn>
          </>}>
          <div style={{ display: 'grid', gap: 14 }}>
            <Field label="Nome no próprio idioma (nativo)">
              <TextInput value={editando.nativo} onChange={e => setEditando(p => ({ ...p, nativo: e.target.value }))} />
            </Field>
            <Field label="Emoji de bandeira" hint="Ex.: 🇧🇷 🇦🇷 🇺🇸 🇵🇹">
              <TextInput value={editando.bandeira} onChange={e => setEditando(p => ({ ...p, bandeira: e.target.value }))} maxLength={4} style={{ fontSize: 22, width: 80 }} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════ DestinoSection ═══════════════════════════ */
