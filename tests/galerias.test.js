import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GALERIA_RESIDENCIAL } from '../src/lib/galeriaResidencial.js';
import { FOTOS_OTIMIZADAS } from '../src/lib/fotosOtimizadas.js';
import { fotoTopo, FOTO_TOPO_PADRAO, heroVersoes } from '../src/lib/constants.js';

const pub = (p) => path.resolve(__dirname, '../public', '.' + p);

describe('galeria do residencial', () => {
  it('cada residencial tem fotos que existem e texto alternativo nos 3 idiomas', () => {
    for (const [id, fotos] of Object.entries(GALERIA_RESIDENCIAL)) {
      expect(fotos.length, id).toBeGreaterThanOrEqual(3);
      for (const f of fotos) {
        expect(fs.existsSync(pub(f.src)), f.src).toBe(true);
        for (const l of ['pt', 'es', 'en']) expect(f.alt[l], `${f.src} ${l}`).toBeTruthy();
      }
    }
  });
});

describe('fotos otimizadas', () => {
  it('toda foto listada tem o .jpg, o .webp e o -640.webp', () => {
    for (const p of FOTOS_OTIMIZADAS) {
      expect(fs.existsSync(pub(p)), p).toBe(true);
      expect(fs.existsSync(pub(p.replace(/\.jpg$/, '.webp'))), p).toBe(true);
      expect(fs.existsSync(pub(p.replace(/\.jpg$/, '-640.webp'))), p).toBe(true);
    }
  }, 60000); // muitos ficheiros: em discos lentos demora
});

describe('foto de abertura', () => {
  it('a antiga e a genérica passam para a nova; uma escolhida no painel fica', () => {
    expect(fotoTopo('/fotos/a305/2.jpg')).toBe(FOTO_TOPO_PADRAO);
    expect(fotoTopo('')).toBe(FOTO_TOPO_PADRAO);
    expect(fotoTopo('https://images.unsplash.com/photo-1507525428034-b723cf961d3e')).toBe(FOTO_TOPO_PADRAO);
    expect(fotoTopo('/fotos/a207/1.jpg')).toBe('/fotos/a207/1.jpg');
  });
  it('os ficheiros da abertura existem', () => {
    const v = heroVersoes(FOTO_TOPO_PADRAO);
    expect(v).toBeTruthy();
    for (const p of [FOTO_TOPO_PADRAO, '/fotos/hero/pinheiramar-1280.jpg', '/fotos/hero/pinheiramar-1280.webp', '/fotos/hero/pinheiramar-2560.webp']) expect(fs.existsSync(pub(p)), p).toBe(true);
    expect(heroVersoes('/fotos/a207/1.jpg')).toBeNull();
  });
});
