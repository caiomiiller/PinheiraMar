import { describe, it, expect } from 'vitest';
import { lerPesquisaDaUrl, montarLinkPesquisa, semParametrosPesquisa } from '../src/lib/linkPesquisa.js';

const hoje = '2026-11-18';
describe('link de pesquisa compartilhável', () => {
  it('lê datas, pessoas e idioma válidos', () => {
    expect(lerPesquisaDaUrl('?entrada=2026-12-20&saida=2026-12-27&pessoas=4&lang=es', { hoje }))
      .toEqual({ ci: '2026-12-20', co: '2026-12-27', hosp: 4, lang: 'es' });
  });
  it('ignora em silêncio o que não serve', () => {
    expect(lerPesquisaDaUrl('?entrada=2026-11-01&saida=2026-11-05', { hoje })).toEqual({});           // já passou
    expect(lerPesquisaDaUrl('?entrada=2026-12-27&saida=2026-12-20', { hoje })).toEqual({});           // saída antes
    expect(lerPesquisaDaUrl('?entrada=2026-02-30&saida=2026-03-02', { hoje: '2026-01-01' })).toEqual({}); // data inexistente
    expect(lerPesquisaDaUrl('?entrada=2026-12-01&saida=2027-06-01', { hoje })).toEqual({});           // longa demais
    expect(lerPesquisaDaUrl('?pessoas=0')).toEqual({});
    expect(lerPesquisaDaUrl('?pessoas=abc&lang=fr')).toEqual({});
    expect(lerPesquisaDaUrl('?pessoas=3')).toEqual({ hosp: 3 });
    expect(lerPesquisaDaUrl('?entrada=<script>&saida=x', { hoje })).toEqual({});
  });
  it('monta o link só com as partes válidas; português não vai no link', () => {
    const base = 'https://www.pinheiramar.com.br/';
    expect(montarLinkPesquisa(base, { ci: '2026-12-20', co: '2026-12-27', hosp: 4, lang: 'pt' }))
      .toBe(`${base}?entrada=2026-12-20&saida=2026-12-27&pessoas=4`);
    expect(montarLinkPesquisa(base, { apto: 'a207', ci: '2026-12-20', co: '2026-12-27', hosp: 0, lang: 'en' }))
      .toBe(`${base}?apto=a207&entrada=2026-12-20&saida=2026-12-27&lang=en`);
    expect(montarLinkPesquisa(base, {})).toBe(base);
  });
  it('ida e volta: o que o link leva é o que o site lê', () => {
    const url = new URL(montarLinkPesquisa('https://x.com/', { ci: '2026-12-20', co: '2026-12-27', hosp: 6, lang: 'es' }));
    expect(lerPesquisaDaUrl(url.search, { hoje })).toEqual({ ci: '2026-12-20', co: '2026-12-27', hosp: 6, lang: 'es' });
  });
  it('limpa só os parâmetros da pesquisa do endereço', () => {
    expect(semParametrosPesquisa('https://x.com/?apto=a1&entrada=2026-12-20&saida=2026-12-27&pessoas=2&lang=es')).toBe('/?apto=a1');
    expect(semParametrosPesquisa('https://x.com/?entrada=2026-12-20&saida=2026-12-27')).toBe('/');
  });
});
