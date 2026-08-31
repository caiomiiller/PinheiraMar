// C é um objecto mutável partilhado — os componentes fazem `import { C } from './constants'`
// e lêem propriedades em cada render, por isso para trocar de tema por imóvel basta
// mutar as chaves de C (ver applyTheme) em vez de reatribuir a exportação.
export const C = {
  ocean: '#0E4A58', oceanDeep: '#0A3742', brisa: '#2E7E8C',
  espuma: '#EEF4F3', areia: '#E7D7B6', areiaSoft: '#F4ECD9',
  coral: '#E8744F', coralDeep: '#D65F3C',
  ink: '#15302E', inkSoft: '#506764', line: '#D9E3E1', white: '#FFFFFF',
};
export const F = {
  disp: "Georgia, 'Times New Roman', serif",
  sans: "'Inter','Segoe UI',system-ui,-apple-system,Roboto,sans-serif",
};

/* ───────────────────────── Temas por imóvel ─────────────────────────
   Cada residencial tem a sua paleta. "pinheiramar" reproduz a paleta
   original (tons de mar/areia). "novo imóvel" usa tons de bairro/verde,
   para não competir visualmente com a marca da praia. */
export const THEMES = {
  pinheiramar: {
    ocean: '#0E4A58', oceanDeep: '#0A3742', brisa: '#2E7E8C',
    espuma: '#EEF4F3', areia: '#E7D7B6', areiaSoft: '#F4ECD9',
    coral: '#E8744F', coralDeep: '#D65F3C',
    ink: '#15302E', inkSoft: '#506764', line: '#D9E3E1', white: '#FFFFFF',
  },
  novoimovel: {
    ocean: '#3B5B3B', oceanDeep: '#28402A', brisa: '#6E8F5C',
    espuma: '#F1F3EC', areia: '#E3DAC2', areiaSoft: '#F6F1E4',
    coral: '#C97A3D', coralDeep: '#A9612C',
    ink: '#22271E', inkSoft: '#5C6354', line: '#DDE1D5', white: '#FFFFFF',
  },
};

// Muta C in-place para o tema do imóvel indicado, mantendo a mesma referência
// de objecto que todos os módulos já importaram — evita ter de passar "theme"
// como prop por toda a árvore de componentes.
export function applyTheme(residencialId) {
  const t = THEMES[residencialId] || THEMES.pinheiramar;
  Object.assign(C, t);
}
