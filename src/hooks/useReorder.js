import { useState } from 'react';
import { C } from '../lib/constants';

export function useReorder(list, commit) {
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  return {
    grip: (idx) => ({
      draggable: true,
      onDragStart: (e) => { setDrag(idx); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(idx)); } catch (_) {} },
      onDragEnd: () => { setDrag(null); setOver(null); },
      title: 'Arraste para reordenar',
      style: { cursor: 'grab', display: 'grid', placeItems: 'center', color: C.inkSoft, flexShrink: 0, alignSelf: 'stretch', padding: '0 2px' },
    }),
    zone: (idx) => ({
      onDragOver: (e) => { e.preventDefault(); if (over !== idx) setOver(idx); },
      onDrop: (e) => { e.preventDefault(); if (drag != null && drag !== idx) { const a = [...list]; const [m] = a.splice(drag, 1); a.splice(idx, 0, m); commit(a); } setDrag(null); setOver(null); },
    }),
    deco: (idx) => ({ opacity: drag === idx ? .45 : 1, outline: over === idx && drag !== idx ? `2px dashed ${C.brisa}` : 'none', outlineOffset: -2 }),
  };
}
// Insere um clone logo após o original numa lista de objetos com id.

// A lista reordenada no ecrã foi montada com os dados de quando o gestor
// começou a arrastar. Para gravar, aplica-se só a NOVA ORDEM (pelos ids) à
// lista mais recente: o que outra pessoa acrescentou entretanto fica (no
// fim), o que foi apagado não volta, e cada item leva o conteúdo atual.
export function reordenarPorIds(atual = [], ordenada = []) {
  const porId = new Map(atual.map(x => [x.id, x]));
  const vistos = new Set();
  const out = [];
  for (const x of ordenada) {
    if (x && porId.has(x.id) && !vistos.has(x.id)) { out.push(porId.get(x.id)); vistos.add(x.id); }
  }
  for (const x of atual) if (!vistos.has(x.id)) out.push(x);
  return out;
}

// Move o item `deId` para a posição de `paraId` (na lista mais recente).
export function moverPorId(lista = [], deId, paraId) {
  const de = lista.findIndex(x => x.id === deId);
  const para = lista.findIndex(x => x.id === paraId);
  if (de < 0 || para < 0 || de === para) return lista;
  const a = [...lista];
  const [m] = a.splice(de, 1);
  a.splice(para, 0, m);
  return a;
}
