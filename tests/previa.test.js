import { describe, it, expect } from 'vitest';
import { apartamentoAtivo, dadosPrevia, montarPrevia } from '../server/previa.js';
import { origemEstatica } from '../api/previa.js';
import { estado, apt } from './fixtures.js';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('prévia do apartamento', () => {
  it('troca título, descrição, url e imagem no index.html', () => {
    const e = estado();
    const a = e.apartamentos[0];
    const out = montarPrevia(html, dadosPrevia(e, a, 'https://exemplo.com/'));
    expect(out).toContain('<title>Apto a1 · Residencial Teste</title>');
    expect(out).toContain('<meta property="og:title" content="Apto a1 · Residencial Teste" />');
    expect(out).toContain('<meta property="og:url" content="https://exemplo.com/?apto=a1" />');
    expect(out).toContain('<meta property="og:image" content="https://exemplo.com/og-image.jpg" />');
    expect(out).not.toContain('Apartamentos na Praia da Pinheira, SC" />');
    // o resto da página fica intacto
    expect(out).toContain('<div id="root"></div>');
    expect(out).toContain('og:image:width');
  });
  it('usa a descrição do apartamento quando existe e escapa aspas e tags', () => {
    const e = estado();
    const a = apt('x1', { nome: 'Apto "<b>1</b>"', descricao: 'Vista do mar & sol. Quarto com <script>alert(1)</script>' });
    const out = montarPrevia(html, dadosPrevia(e, a));
    expect(out).not.toContain('<script>alert');
    expect(out).not.toContain('<b>1</b>');
    expect(out).toContain('&quot;&lt;b&gt;1&lt;/b&gt;&quot;');
    expect(out).toContain('Vista do mar &amp; sol.');
  });
  it('só encontra apartamentos ativos e existentes', () => {
    const e = estado();
    e.apartamentos.push(apt('off', { ativo: false }));
    expect(apartamentoAtivo(e, 'a1')?.id).toBe('a1');
    expect(apartamentoAtivo(e, 'off')).toBeNull();
    expect(apartamentoAtivo(e, '<x>')).toBeNull();
    expect(apartamentoAtivo(e, undefined)).toBeNull();
    expect(apartamentoAtivo(e, ['a1'])).toBeNull();
  });
  it('não lê o index.html de um host qualquer', () => {
    expect(origemEstatica('www.pinheiramar.com.br')).toBe('https://www.pinheiramar.com.br');
    expect(origemEstatica('pinheiramar-abc.vercel.app')).toBe('https://pinheiramar-abc.vercel.app');
    expect(origemEstatica('evil.example.com')).toBe('https://www.pinheiramar.com.br');
    expect(origemEstatica('a.vercel.app@evil.com')).toBe('https://www.pinheiramar.com.br');
    expect(origemEstatica(undefined)).toBe('https://www.pinheiramar.com.br');
  });
});
