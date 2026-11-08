import { describe, it, expect } from 'vitest';
import { montarSitemap } from '../server/sitemap.js';
import { estado } from './fixtures.js';

describe('montarSitemap', () => {
  it('lista a inicial, cada apartamento ativo e as políticas', () => {
    const e = estado();
    const xml = montarSitemap(e, 'https://exemplo.com/');
    expect(xml).toContain('<loc>https://exemplo.com/</loc>');
    for (const a of e.apartamentos.filter(a => a.ativo !== false)) {
      expect(xml).toContain(`<loc>https://exemplo.com/?apto=${a.id}</loc>`);
    }
    expect(xml).toContain('<loc>https://exemplo.com/?politicas</loc>');
  });
  it('deixa de fora apartamentos inativos e nunca leva dados de hóspedes', () => {
    const e = estado();
    e.apartamentos = [...e.apartamentos, { id: 'off1', nome: 'Desativado', ativo: false }];
    const xml = montarSitemap(e);
    expect(xml).not.toContain('off1');
    expect(xml).not.toContain('@');
  });
  it('sem apartamentos devolve um sitemap válido só com a inicial', () => {
    const xml = montarSitemap({ apartamentos: [] });
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<loc>https://www.pinheiramar.com.br/</loc>');
  });
});
