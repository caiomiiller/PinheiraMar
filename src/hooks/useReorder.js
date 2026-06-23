import { useState, useRef } from 'react';

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
