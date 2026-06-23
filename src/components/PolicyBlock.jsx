import React from 'react';
import { C, F } from '../lib/constants';
import { Field, TextInput } from './ui';

export function PolicyBlock({ label, hint, value, onChange, titleValue, onTitleChange }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', minHeight: 200 }}>
        {/* left */}
        <div style={{ background: '#f9fafa', borderRight: `1px solid ${C.line}`, padding: '28px 22px' }}>
          <div style={{ fontFamily: F.disp, fontSize: 16, fontWeight: 600, color: C.ocean, marginBottom: 8 }}>{label}</div>
          {hint && <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.55 }}>{hint}</div>}
        </div>
        {/* right */}
        <div style={{ padding: '24px 26px', display: 'grid', gap: 14 }}>
          <Field label="Título">
            <TextInput
              value={titleValue}
              onChange={e => onTitleChange(e.target.value)}
              placeholder="Ex.: Política de Reservas"
            />
          </Field>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              Conteúdo <span style={{ color: C.brisa, fontSize: 11.5 }}>ⓘ Suportado: texto simples, listas com •, separadores ---</span>
            </div>
            {/* toolbar simulation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: C.espuma, border: `1px solid ${C.line}`, borderBottom: 'none', borderRadius: '8px 8px 0 0' }}>
              {[['B', 'bold', 'font-weight:700'], ['I', 'italic', 'font-style:italic']].map(([lbl]) => (
                <button key={lbl} type="button" title={lbl}
                  style={{ width: 28, height: 26, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 5, cursor: 'pointer', fontWeight: lbl === 'B' ? 700 : 400, fontStyle: lbl === 'I' ? 'italic' : 'normal', fontSize: 13, color: C.ink }}>
                  {lbl}
                </button>
              ))}
              <div style={{ width: 1, height: 20, background: C.line, margin: '0 4px' }} />
              {[['•−', 'Lista bullets'], ['1.', 'Lista numerada']].map(([lbl, title]) => (
                <button key={lbl} type="button" title={title}
                  style={{ height: 26, padding: '0 8px', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 5, cursor: 'pointer', fontSize: 12, color: C.inkSoft }}>
                  {lbl}
                </button>
              ))}
            </div>
            <textarea
              className="pmf"
              value={value}
              onChange={e => onChange(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                minHeight: 320, padding: '14px', fontSize: 13.5, lineHeight: 1.65,
                border: `1px solid ${C.line}`, borderRadius: '0 0 8px 8px',
                fontFamily: F.sans, color: C.ink, background: '#fff',
                resize: 'vertical', outline: 'none',
              }}
              placeholder="Escreva a política aqui..."
            />
            <div style={{ fontSize: 11, color: C.inkSoft, textAlign: 'right', marginTop: 4 }}>{value.length}/8000</div>
          </div>
        </div>
      </div>
    </div>
  );
}

