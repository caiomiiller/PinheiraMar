// Idioma do site público. Antes só a lista de apartamentos era traduzida —
// ao abrir um apartamento ou reservar, tudo voltava ao português. Agora o
// idioma escolhido vale para todas as telas do hóspede (detalhe, reserva,
// confirmação, calendário, destino), e as datas saem no formato do idioma.
import React, { createContext, useContext, useMemo } from 'react';
import { TRANSLATIONS } from './translations';
import { TEXTOS } from './textos';
import { parseYMD } from './helpers';

export const LOCALES = { pt: 'pt-BR', es: 'es-AR', en: 'en-US' };
const IdiomaContext = createContext('pt');

export function IdiomaProvider({ lang, children }) {
  return <IdiomaContext.Provider value={LOCALES[lang] ? lang : 'pt'}>{children}</IdiomaContext.Provider>;
}

export function traduzir(lang, chave, ...args) {
  const v = TEXTOS[lang]?.[chave] ?? TRANSLATIONS[lang]?.[chave] ?? TEXTOS.pt[chave] ?? TRANSLATIONS.pt[chave];
  if (typeof v === 'function') return v(...args);
  return v ?? chave;
}

export function ferramentasIdioma(lang) {
  const locale = LOCALES[lang] || 'pt-BR';
  const tr = (chave, ...args) => traduzir(lang, chave, ...args);
  const data = (s, opcoes) => (s ? parseYMD(s).toLocaleDateString(locale, opcoes) : '');
  return {
    lang, locale, tr,
    // valores que vêm dos dados em português (piso, vista, camas, comodidades):
    // traduz os conhecidos; o resto aparece como está
    dado: (v) => (v && TEXTOS[lang]?.['d:' + v]) || v,
    existe: (chave) => !!(TEXTOS[lang]?.[chave] ?? TRANSLATIONS[lang]?.[chave] ?? TEXTOS.pt[chave] ?? TRANSLATIONS.pt[chave]),
    fmtCurta: (s) => data(s, { day: '2-digit', month: 'short' }),
    fmtLonga: (s) => data(s, { day: '2-digit', month: 'long', year: 'numeric' }),
    fmtDiaSemana: (s) => data(s, { weekday: 'short', day: '2-digit', month: 'short' }),
    nomeMes: (ano, mes) => new Date(ano, mes, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
    // Dom..Sáb (curto) no idioma — para o cabeçalho do calendário
    diasSemana: () => Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 4 + i).toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')),
  };
}

export function useIdioma() {
  const lang = useContext(IdiomaContext) || 'pt';
  return useMemo(() => ferramentasIdioma(lang), [lang]);
}
