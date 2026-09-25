import React from 'react';

/* ── Marca do Grupo PinheiraMar ──────────────────────────────────────────
   Regras: "Briefing de marca V1 · setembro 2026" e "Grupo PinheiraMar
   Branding". O grupo é azul-marinho; vermelho (PinheiraMar) e azul (Caminho
   do Mar) pertencem aos residenciais e, no grupo, só aparecem na faixa.
   Uma só família tipográfica: Montserrat (quanto maior o texto, mais leve). */
export const BRAND = {
  marinho: '#1B1C46',   // grupo · títulos · ícones · 1º segmento da faixa
  noite: '#14152F',     // fundos escuros
  vermelho: '#D1301B',  // PinheiraMar Residencial
  azul: '#2D7F9D',      // Caminho do Mar Residencial
  pedra: '#6F6B64',     // texto de apoio
  vermelhoNeg: '#F0604D', // faixa sobre fundo escuro
  azulNeg: '#4FA6C6',
  font: "'Montserrat','Segoe UI',system-ui,-apple-system,Roboto,sans-serif",
};

// ordem do portfólio: grupo, PinheiraMar, Caminho do Mar (ids do código)
export const FAIXA_INDEX = { pinheiramar: 1, novoimovel: 2 };

/* A faixa: segmentos de igual largura; intervalo = 1,3 × a altura.
   tone="negativo" sobe um tom no vermelho e no azul (fundos escuros).
   lit=<índice> é o "indicador de residencial": esse segmento aceso, os
   outros a 15%. */
export function Faixa({ height = 3, width = '100%', tone = 'normal', lit = null, style }) {
  const cores = tone === 'negativo'
    ? ['#FFFFFF', BRAND.vermelhoNeg, BRAND.azulNeg]
    : [BRAND.marinho, BRAND.vermelho, BRAND.azul];
  return (
    <div aria-hidden style={{ display: 'flex', gap: Math.max(2, height * 1.3), width, ...style }}>
      {cores.map((c, i) => (
        <span key={i} style={{ flex: 1, height, background: c, opacity: lit == null || lit === i ? 1 : 0.15 }} />
      ))}
    </div>
  );
}

/* Assinatura do grupo, desenhada em texto (nítida em qualquer tamanho).
   variant: "principal" (2a) · "horizontal" (2b) · "negativo" (2c, sobre escuro)
   size = altura da fonte de PINHEIRAMAR em px. */
export function GroupLogo({ variant = 'principal', size = 28, style }) {
  const neg = variant === 'negativo';
  const cor = neg ? '#FFFFFF' : BRAND.marinho;
  // faixa = 1/10 da altura das maiúsculas (Montserrat ≈ 0,7 em)
  const fh = Math.max(2, Math.round(size * 0.7 / 10 * 10) / 10);
  const nome = (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: Math.max(3, size * 0.22) }}>
      <span style={{ fontFamily: BRAND.font, fontWeight: 300, fontSize: size, lineHeight: 1, letterSpacing: '.03em', color: cor, whiteSpace: 'nowrap' }}>PINHEIRAMAR</span>
      <Faixa height={fh} tone={neg ? 'negativo' : 'normal'} />
    </span>
  );
  const grupo = (
    <span style={{ fontFamily: BRAND.font, fontWeight: 400, fontSize: Math.max(8, size * 0.3), lineHeight: 1, letterSpacing: '.42em', color: cor }}>GRUPO</span>
  );
  if (variant === 'horizontal') return (
    <span role="img" aria-label="Grupo PinheiraMar" style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.55, ...style }}>
      {grupo}
      <span style={{ width: 1, alignSelf: 'stretch', background: cor, opacity: .35, minHeight: size * 1.25 }} />
      {nome}
    </span>
  );
  return (
    <span role="img" aria-label="Grupo PinheiraMar" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: size * 0.3, ...style }}>
      {grupo}
      {nome}
    </span>
  );
}
