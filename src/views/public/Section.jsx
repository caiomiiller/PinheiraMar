import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { money } from '../../lib/helpers';
import { PhotoTile } from '../../components/ui';
import { AptCard } from './AptCard';

export function Section({ icon, title, sub, apts, liked, setLiked, onCard, tr, highlight = false, grid = false }) {
  const scrollRef = useRef(null);
  const scroll = (dir) => { if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' }); };

  if (!apts.length) return null;

  return (
    <section style={{ marginBottom: 48 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{icon}</span> {title}
          </h2>
          {sub && <p style={{ margin: '4px 0 0', fontSize: 14, color: '#717171' }}>{sub}</p>}
        </div>
        {!grid && apts.length > 3 && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => scroll(-1)} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#333' }}><ChevronLeft size={16} /></button>
            <button onClick={() => scroll(1)}  style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#333' }}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {grid ? (
        /* full grid — "todos os apartamentos" */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '26px 22px' }}>
          {apts.map(apt => (
            <AptCard key={apt.id} apt={apt} liked={liked} setLiked={setLiked} onCard={onCard} tr={tr} />
          ))}
        </div>
      ) : highlight && apts.length >= 2 ? (
        /* highlight layout — big card left + column right (Frente Mar) */
        <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16 }}>
          {/* big featured card */}
          <div onClick={() => onCard(apts[0])} style={{ cursor: 'pointer', position: 'relative', borderRadius: 18, overflow: 'hidden', aspectRatio: '16/10' }}>
            <PhotoTile apt={apts[0]} h={420} radius={0} />
            <button onClick={e => { e.stopPropagation(); setLiked(l => ({ ...l, [apts[0].id]: !l[apts[0].id] })); }}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <Heart size={24} fill={liked[apts[0].id] ? C.coral : 'rgba(0,0,0,.4)'} color="#fff" strokeWidth={1.8} />
            </button>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(10,30,40,.78))', padding: '40px 22px 20px', color: '#fff' }}>
              <div style={{ fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.18)', display: 'inline-block', padding: '3px 10px', borderRadius: 999, marginBottom: 8 }}>🌊 Destaque</div>
              <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-.01em' }}>{apts[0].nome}</div>
              <div style={{ fontSize: 13.5, opacity: .88, marginTop: 3 }}>{apts[0].piso} · até {apts[0].capacidade} pessoas</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginTop: 6 }}>{money(apts[0].preco)} <span style={{ fontWeight: 400, fontSize: 13 }}>/ noite</span></div>
            </div>
          </div>
          {/* right column — remaining 2-4 as smaller cards */}
          <div style={{ display: 'grid', gridTemplateRows: `repeat(${Math.min(apts.length - 1, 2)}, 1fr)`, gap: 16 }}>
            {apts.slice(1, 3).map(apt => (
              <div key={apt.id} onClick={() => onCard(apt)} style={{ cursor: 'pointer', position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
                <PhotoTile apt={apt} h={200} radius={0} />
                <button onClick={e => { e.stopPropagation(); setLiked(l => ({ ...l, [apt.id]: !l[apt.id] })); }}
                  style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <Heart size={19} fill={liked[apt.id] ? C.coral : 'rgba(0,0,0,.4)'} color="#fff" strokeWidth={1.8} />
                </button>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(10,30,40,.72))', padding: '24px 16px 14px', color: '#fff' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{apt.nome}</div>
                  <div style={{ fontSize: 12.5, opacity: .88 }}>{apt.piso} · até {apt.capacidade} pessoas · {money(apt.preco)}/noite</div>
                </div>
              </div>
            ))}
          </div>
          {/* remaining as horizontal scroll if > 3 */}
          {apts.length > 3 && (
            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
              <div ref={scrollRef} style={{ display: 'flex', gap: 18, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                {apts.slice(3).map(apt => (
                  <div key={apt.id} style={{ minWidth: 230, flex: '0 0 230px' }}>
                    <AptCard apt={apt} liked={liked} setLiked={setLiked} onCard={onCard} tr={tr} compact />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* horizontal scroll row — default for capacity groups */
        <div style={{ position: 'relative' }}>
          <div ref={scrollRef} style={{ display: 'flex', gap: 20, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
            {apts.map(apt => (
              <div key={apt.id} style={{ minWidth: 240, flex: '0 0 240px' }}>
                <AptCard apt={apt} liked={liked} setLiked={setLiked} onCard={onCard} tr={tr} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}


