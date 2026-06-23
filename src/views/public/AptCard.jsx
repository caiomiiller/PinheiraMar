import React from 'react';
import { Heart, BedDouble, Users, Check } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { money } from '../../lib/helpers';
import { Badge, PhotoTile } from '../../components/ui';

export function AptCard({ apt, available = true, fits = true, bd = null, valid = false,
  hosp = 0, liked, setLiked, onCard, tr, compact = false }) {
  const nightRate = valid && bd ? Math.round(bd.total / bd.n) : apt.preco;
  const h = compact ? 160 : 220;
  return (
    <article
      onClick={() => available && onCard(apt)}
      style={{ display: 'flex', flexDirection: 'column', opacity: available ? 1 : .55, cursor: available ? 'pointer' : 'default', minWidth: compact ? 200 : 0 }}>
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '20/19', flexShrink: 0 }}>
        <PhotoTile apt={apt} h={h} radius={0} />
        <button onClick={e => { e.stopPropagation(); setLiked(l => ({ ...l, [apt.id]: !l[apt.id] })); }}
          style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <Heart size={20} fill={liked[apt.id] ? C.coral : 'rgba(0,0,0,.45)'} color={liked[apt.id] ? C.coral : '#fff'} strokeWidth={1.8} />
        </button>
        {!available
          ? <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,.62)', color: '#fff', borderRadius: 6, fontSize: 11.5, fontWeight: 700, padding: '4px 9px' }}>{tr('card_unavail')}</span>
          : valid && !fits
            ? <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(232,116,79,.92)', color: '#fff', borderRadius: 6, fontSize: 11.5, fontWeight: 700, padding: '4px 9px' }}>{tr('card_combine')}</span>
            : null}
        {apt.vista === 'Frente Mar' && (
          <span style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(14,74,88,.82)', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
            🌊 Frente Mar
          </span>
        )}
      </div>
      <div style={{ paddingTop: 9 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.3 }}>{apt.nome}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <Star size={12} fill="#222" color="#222" /><span style={{ fontSize: 12.5, fontWeight: 600 }}>4,9</span>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#717171', marginTop: 2 }}>{apt.piso} · {apt.capacidade} pessoas</div>
        {valid && bd && <div style={{ fontSize: 12.5, color: '#717171', marginTop: 1 }}>{tr('card_total')} {money(bd.total)}</div>}
        {valid && !fits && <div style={{ fontSize: 12, color: C.coralDeep, fontWeight: 600, marginTop: 3 }}>{tr('card_combine_hint', hosp)}</div>}
        <div style={{ marginTop: 5 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{money(nightRate)}</span>
          <span style={{ fontSize: 13, color: '#717171' }}> {tr('card_night')}</span>
        </div>
      </div>
    </article>
  );
}

/* ── Section — titled row with horizontal scroll or grid ── */
