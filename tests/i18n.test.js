import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TEXTOS } from '../src/lib/textos.js';
import { TRANSLATIONS } from '../src/lib/translations.js';

const LINGUAS = ['pt', 'es', 'en'];
const existe = (l, k) => (k in (TEXTOS[l] || {})) || (k in (TRANSLATIONS[l] || {}));
// chaves montadas no código a partir de um prefixo: confere as variantes
const DINAMICAS = {
  bk_por_: ['reserva', 'noite', 'hospede'],
  bk_erro_: ['nome', 'email', 'telefone'],
  ds_at_: ['pontao', 'baixo', 'urubu', 'cima', 'prainha', 'guarda', 'maco', 'tabuleiro'].flatMap(a => [a, a + '_txt']),
};

function chavesUsadas() {
  const out = new Set();
  const andar = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { if (f.name !== '.vs') andar(p); continue; }
      if (!/\.(jsx?|mjs)$/.test(f.name)) continue;
      for (const m of fs.readFileSync(p, 'utf8').matchAll(/\b(?:tr|existe)\(\s*['"]([^'"]+)['"]/g)) out.add(m[1]);
    }
  };
  andar(path.resolve(__dirname, '../src'));
  return out;
}

describe('traduções', () => {
  it('toda chave usada nas telas existe em pt, es e en', () => {
    const faltam = [];
    for (const k of chavesUsadas()) {
      const variantes = DINAMICAS[k] ? DINAMICAS[k].map(v => k + v) : [k];
      for (const c of variantes) for (const l of LINGUAS) if (!existe(l, c)) faltam.push(`${l}:${c}`);
    }
    expect(faltam).toEqual([]);
  });
  it('es e en têm as mesmas chaves que pt, com o mesmo tipo', () => {
    const problemas = [];
    for (const l of ['es', 'en']) {
      for (const [k, v] of Object.entries(TEXTOS.pt)) {
        if (!(k in TEXTOS[l])) problemas.push(`${l} sem ${k}`);
        else if (typeof TEXTOS[l][k] !== typeof v) problemas.push(`${l}:${k} tipo`);
      }
    }
    expect(problemas).toEqual([]);
  });
  it('os textos com parâmetros funcionam', () => {
    for (const l of LINGUAS) for (const [k, v] of Object.entries(TEXTOS[l])) {
      if (typeof v === 'function') expect(() => v(2, 3, 4, 5), `${l}:${k}`).not.toThrow();
    }
  });
});
