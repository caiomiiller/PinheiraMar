// C é um objecto mutável partilhado — os componentes fazem `import { C } from './constants'`
// e lêem propriedades em cada render, por isso para trocar de tema por imóvel basta
// mutar as chaves de C (ver applyTheme) em vez de reatribuir a exportação.
// Paleta do Grupo PinheiraMar (ver src/components/Brand.jsx): marinho para
// títulos e ações, noite para fundos escuros, pedra para texto de apoio.
// As chaves antigas (ocean, coral…) mantêm-se para não partir componentes;
// "coral" deixou de ser laranja — as ações do grupo são em marinho.
const PALETA = {
    // marca
    ocean: '#1B1C46', oceanDeep: '#14152F', brisa: '#2D7F9D',
    coral: '#1B1C46', coralDeep: '#14152F',            // chaves antigas (= marinho)
    // texto, linhas e fundos
    ink: '#1B1C46', inkSoft: '#6F6B64', white: '#FFFFFF',
    line: '#E2E0DB', bordaForte: '#8A8A8A', inativo: '#BBBBBB',
    espuma: '#F2F1F5', fundoSuave: '#F8F8F6', areia: '#EDE3D3', areiaSoft: '#F6F1EA',
    // estados: sucesso · aviso · erro · informação (texto, fundo, borda)
    sucesso: '#1C7A5B', sucessoBg: '#E1F0EC', sucessoBorda: '#6EE7B7',
    aviso: '#7B5600', avisoBg: '#FFF4D6', avisoBorda: '#EBD9C0',
    erro: '#B42318', erroBg: '#FEF3F2', erroBorda: '#F0C6C6',
    info: '#1A4A7A', infoBg: '#EEF6FF', infoBorda: '#BDD9F8',
};
// Todas as cores de interface vêm daqui (C.<nome>) — não escrever #hex nos componentes.
export const C = { ...PALETA };
// Cantos: só quatro valores — campo (8), botão/cartão (12), modal (16) e pílula (999).
// Círculos continuam '50%'. Não escrever números soltos em borderRadius.
export const R = { campo: 8, cartao: 12, modal: 16, pilula: 999 };
export const F = {
  // uma só família em todo o grupo: Montserrat (carregada em index.html)
  disp: "'Montserrat','Segoe UI',system-ui,-apple-system,Roboto,sans-serif",
  sans: "'Montserrat','Segoe UI',system-ui,-apple-system,Roboto,sans-serif",
};

// WhatsApp é o canal principal de contacto do site (substitui e-mail/telefone
// nas páginas públicas) — link fixo do titular do WhatsApp Business.
export const WHATSAPP_URL = 'https://api.whatsapp.com/send/?phone=%2B5548984761800&text&type=phone_number&app_absent=0';

// Assinatura horizontal de cada residencial (versão positiva, sem o endosso
// do grupo) e a largura com que aparece — na mesma escala, para o nome dos
// dois ter a mesma altura. Usada no site (cabeçalho de cada residencial) e
// no e-mail de confirmação (server/email.js), que mostra a do residencial do
// apartamento reservado.
export const LOGO_RESIDENCIAL = {
  pinheiramar: { src: '/brand/pinheiramar-horizontal.png', largura: 200 },
  novoimovel: { src: '/brand/caminho-horizontal.png', largura: 252 },
};
// Mostrado quando o site não consegue carregar os dados (aí não há o telefone do residencial à mão).
export const TELEFONE_CONTATO = '(48) 98476-1800';

// Foto do topo do site quando o residencial ainda usa a imagem genérica do
// Unsplash (a de origem) — uma foto real, tirada do próprio residencial.
export const FOTO_TOPO_PADRAO = '/fotos/a305/2.jpg';
export const fotoTopo = (url) => (!url || /images\.unsplash\.com\/photo-1507525428034/.test(url) ? FOTO_TOPO_PADRAO : url);

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
  pinheiramar: { ...PALETA },
  novoimovel: { ...PALETA },
};

// Muta C in-place para o tema do imóvel indicado, mantendo a mesma referência
// de objecto que todos os módulos já importaram — evita ter de passar "theme"
// como prop por toda a árvore de componentes.
export function applyTheme(residencialId) {
  const t = THEMES[residencialId] || THEMES.pinheiramar;
  Object.assign(C, t);
}
