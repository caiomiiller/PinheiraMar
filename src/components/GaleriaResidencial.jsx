import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { C, R } from '../lib/constants';
import { useIdioma } from '../lib/i18n';
import { GALERIA_RESIDENCIAL } from '../lib/galeriaResidencial';
import { FotoInteira } from './ui';

// "Conheça o residencial": mosaico de fotos de exteriores e áreas comuns, com
// visualizador em ecrã inteiro (setas do teclado, Esc, botões). No computador
// são 5 fotos em mosaico + botão "Ver as N fotos"; no telemóvel, uma faixa que
// se desliza com todas as fotos. Mesmas regras das galerias dos apartamentos:
// foto inteira, sem cortar nem deformar (FotoInteira).
const botao = { width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.94)', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.ink, boxShadow: '0 2px 8px rgba(0,0,0,.18)' };

export function GaleriaResidencial({ residencialId, nome }) {
  const { tr, lang } = useIdioma();
  const fotos = GALERIA_RESIDENCIAL[residencialId] || [];
  const [aberta, setAberta] = useState(null);
  const fecharRef = useRef(null);
  const anterior = useRef(null);
  const n = fotos.length;
  const alt = (i) => fotos[i].alt[lang] || fotos[i].alt.pt;
  const ir = (d) => setAberta(i => (i + d + n) % n);

  useEffect(() => {
    if (aberta === null) return undefined;
    anterior.current = document.activeElement;
    fecharRef.current?.focus();
    const tecla = (e) => {
      if (e.key === 'Escape') setAberta(null);
      else if (e.key === 'ArrowLeft') ir(-1);
      else if (e.key === 'ArrowRight') ir(1);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = overflow;
      anterior.current?.focus?.();
    };
  }, [aberta === null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (n < 3) return null;
  const mosaico = fotos.slice(0, 5);

  return (
    <section aria-label={tr('gal_titulo')} className="pm-galres" style={{ marginTop: 40 }}>
      <style>{`
        .pm-galres-grid{display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:200px 200px;gap:4px;border-radius:${R.cartao}px;overflow:hidden;}
        .pm-galres-grid > button:first-child{grid-row:1 / 3;}
        .pm-galres-strip{display:none;}
        @media(max-width:760px){
          .pm-galres-grid{display:none;}
          .pm-galres-strip{display:flex;gap:6px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;margin:0 -16px;padding:0 16px;}
          .pm-galres-strip > button{flex:0 0 82%;height:260px;scroll-snap-align:center;}
        }
      `}</style>
      <h3 style={{ fontSize: 22, fontWeight: 300, margin: '0 0 16px', color: C.ink }}>{tr('gal_titulo')}</h3>
      <div className="pm-galres-grid">
        {mosaico.map((f, i) => (
          <button key={f.src} type="button" onClick={() => setAberta(i)} aria-label={tr('gal_abrir_foto', i + 1, n)}
            style={{ position: 'relative', padding: 0, border: 'none', background: 'none', cursor: 'pointer', overflow: 'hidden', minHeight: 0 }}>
            <FotoInteira src={f.src} alt={alt(i)} loading="lazy" />
            {i === mosaico.length - 1 && n > mosaico.length && (
              <span style={{ position: 'absolute', right: 12, bottom: 12, background: 'rgba(0,0,0,.65)', color: C.white, fontSize: 14, fontWeight: 700, padding: '8px 14px', borderRadius: R.pilula }}>
                {tr('ap_ver_todas_fotos', n)}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="pm-galres-strip">
        {fotos.map((f, i) => (
          <button key={f.src} type="button" onClick={() => setAberta(i)} aria-label={tr('gal_abrir_foto', i + 1, n)}
            style={{ position: 'relative', padding: 0, border: 'none', background: 'none', cursor: 'pointer', overflow: 'hidden', borderRadius: R.cartao }}>
            <FotoInteira src={f.src} alt={alt(i)} loading="lazy" />
          </button>
        ))}
      </div>

      {aberta !== null && (
        <div role="dialog" aria-modal="true" aria-label={`${nome} — ${tr('gal_titulo')}`} onClick={() => setAberta(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,16,.94)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button ref={fecharRef} type="button" onClick={() => setAberta(null)} aria-label={tr('ap_fechar')} style={{ position: 'absolute', top: 16, right: 16, ...botao, zIndex: 202 }}><X size={20} /></button>
          <span style={{ position: 'absolute', top: 20, left: 20, color: C.white, fontSize: 13.5, fontWeight: 700, background: 'rgba(255,255,255,.14)', padding: '5px 12px', borderRadius: R.pilula, zIndex: 202 }}>
            {aberta + 1}/{n}
          </span>
          <button type="button" onClick={e => { e.stopPropagation(); ir(-1); }} aria-label={tr('ap_foto_anterior')} style={{ position: 'absolute', left: 16, ...botao, zIndex: 202 }}><ChevronLeft size={24} /></button>
          <img src={fotos[aberta].src} alt={alt(aberta)} onClick={e => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: R.campo }} />
          <button type="button" onClick={e => { e.stopPropagation(); ir(1); }} aria-label={tr('ap_proxima_foto')} style={{ position: 'absolute', right: 16, ...botao, zIndex: 202 }}><ChevronRight size={24} /></button>
        </div>
      )}
    </section>
  );
}
