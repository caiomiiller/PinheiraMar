// C é um objecto mutável partilhado — os componentes fazem `import { C } from './constants'`
// e lêem propriedades em cada render, por isso para trocar de tema por imóvel basta
// mutar as chaves de C (ver applyTheme) em vez de reatribuir a exportação.
// Paleta do Grupo PinheiraMar (ver src/components/Brand.jsx): marinho para
// títulos e ações, noite para fundos escuros, pedra para texto de apoio.
// As chaves antigas (ocean, coral…) mantêm-se para não partir componentes;
// "coral" deixou de ser laranja — as ações do grupo são em marinho.
export const C = {
    ocean: '#1B1C46', oceanDeep: '#14152F', brisa: '#2D7F9D',
    espuma: '#F2F1F5', areia: '#EDE3D3', areiaSoft: '#F6F1EA',
    coral: '#1B1C46', coralDeep: '#14152F',
    ink: '#1B1C46', inkSoft: '#6F6B64', line: '#E2E0DB', white: '#FFFFFF',
};
export const F = {
  // uma só família em todo o grupo: Montserrat (carregada em index.html)
  disp: "'Montserrat','Segoe UI',system-ui,-apple-system,Roboto,sans-serif",
  sans: "'Montserrat','Segoe UI',system-ui,-apple-system,Roboto,sans-serif",
};

// WhatsApp é o canal principal de contacto do site (substitui e-mail/telefone
// nas páginas públicas) — link fixo do titular do WhatsApp Business.
export const WHATSAPP_URL = 'https://api.whatsapp.com/send/?phone=%2B5548984761800&text&type=phone_number&app_absent=0';

// Avaliação real do perfil Google Meu Negócio "PinheiraMar Residencial"
// (não é calculada pela aplicação — atualizar manualmente de vez em quando,
// consultando o próprio perfil no Google). Substitui a nota fixa "4,9" que
// não correspondia a avaliações reais nenhumas.
export const GOOGLE_RATING = {
  value: '4,7',
  count: 168,
  url: 'https://www.google.com/maps/search/?api=1&query=PinheiraMar+Residencial+R.+Dom+Patr%C3%ADcio+82+Palho%C3%A7a+SC',
};

/* ───────────────────────── Temas por imóvel ─────────────────────────
   Cada residencial tem a sua paleta. "pinheiramar" reproduz a paleta
   original (tons de mar/areia). "novo imóvel" usa tons de bairro/verde,
   para não competir visualmente com a marca da praia. */
export const THEMES = {
  // os dois residenciais partilham a paleta do grupo (a cor própria de cada
  // um — vermelho / azul — entra só nas suas peças e no seu segmento da faixa)
  pinheiramar: {
    ocean: '#1B1C46', oceanDeep: '#14152F', brisa: '#2D7F9D',
    espuma: '#F2F1F5', areia: '#EDE3D3', areiaSoft: '#F6F1EA',
    coral: '#1B1C46', coralDeep: '#14152F',
    ink: '#1B1C46', inkSoft: '#6F6B64', line: '#E2E0DB', white: '#FFFFFF',
  },
  novoimovel: {
    ocean: '#1B1C46', oceanDeep: '#14152F', brisa: '#2D7F9D',
    espuma: '#F2F1F5', areia: '#EDE3D3', areiaSoft: '#F6F1EA',
    coral: '#1B1C46', coralDeep: '#14152F',
    ink: '#1B1C46', inkSoft: '#6F6B64', line: '#E2E0DB', white: '#FFFFFF',
  },
};

// Muta C in-place para o tema do imóvel indicado, mantendo a mesma referência
// de objecto que todos os módulos já importaram — evita ter de passar "theme"
// como prop por toda a árvore de componentes.
export function applyTheme(residencialId) {
  const t = THEMES[residencialId] || THEMES.pinheiramar;
  Object.assign(C, t);
}
