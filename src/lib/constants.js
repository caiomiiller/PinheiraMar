// C é a paleta única do site: os componentes fazem `import { C } from './constants'`
// e usam C.<nome> — não escrever #hex nos componentes. Marinho para títulos e
// ações, noite para fundos escuros, pedra para texto de apoio (ver Brand.jsx).
// Os dois residenciais usam a mesma paleta; a cor própria de cada um
// (vermelho / azul) entra só nas peças da marca.
const PALETA = Object.freeze({
    // marca
    ocean: '#1B1C46', oceanDeep: '#14152F', brisa: '#2D7F9D',
    acao: '#1B1C46', acaoEscura: '#14152F',            // botões e ações (hoje = marinho)
    // texto, linhas e fundos
    ink: '#1B1C46', inkSoft: '#6F6B64', white: '#FFFFFF',
    line: '#E2E0DB', bordaForte: '#8A8A8A', inativo: '#BBBBBB',
    espuma: '#F2F1F5', fundoSuave: '#F8F8F6', areia: '#EDE3D3', areiaSoft: '#F6F1EA',
    // estados: sucesso · aviso · erro · informação (texto, fundo, borda)
    sucesso: '#156B4E', sucessoBg: '#E1F0EC', sucessoBorda: '#6EE7B7',
    aviso: '#7B5600', avisoBg: '#FFF4D6', avisoBorda: '#EBD9C0',
    erro: '#B42318', erroBg: '#FEF3F2', erroBorda: '#F0C6C6',
    info: '#1A4A7A', infoBg: '#EEF6FF', infoBorda: '#BDD9F8',
});
// Todas as cores de interface vêm daqui (C.<nome>) — não escrever #hex nos componentes.
export const C = PALETA;
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

// Foto do topo do site. A de 2026-11-12 vem do original sem efeitos (terraço,
// 9000×12000 px), em 2560 px de largura: a anterior (/fotos/a305/2.jpg, 1536 px
// com efeitos de saturação e contorno) perdia qualidade ao ser esticada na faixa
// toda. Quem ainda tem a foto antiga ou a genérica do Unsplash gravada nos dados
// passa a ver a nova; uma foto escolhida de propósito no painel continua a valer.
export const FOTO_TOPO_PADRAO = '/fotos/hero/pinheiramar-2560.jpg';
const FOTO_TOPO_ANTIGA = '/fotos/a305/2.jpg';
export const fotoTopo = (url) => (!url || url === FOTO_TOPO_ANTIGA || /images\.unsplash\.com\/photo-1507525428034/.test(url) ? FOTO_TOPO_PADRAO : url);
// Versões da foto de abertura (WebP e JPG, 1280 e 2560 px) — só para a padrão.
export const heroVersoes = (url) => (url === FOTO_TOPO_PADRAO ? {
  webp: '/fotos/hero/pinheiramar-1280.webp 1280w, /fotos/hero/pinheiramar-2560.webp 2560w',
  jpg: '/fotos/hero/pinheiramar-1280.jpg 1280w, /fotos/hero/pinheiramar-2560.jpg 2560w',
} : null);

// Avaliação real do perfil Google Meu Negócio "PinheiraMar Residencial"
// (não é calculada pela aplicação — atualizar manualmente de vez em quando,
// consultando o próprio perfil no Google). Substitui a nota fixa "4,9" que
// não correspondia a avaliações reais nenhumas.
export const GOOGLE_RATING = {
  value: '4,7',
  count: 168,
  url: 'https://www.google.com/maps/search/?api=1&query=PinheiraMar+Residencial+R.+Dom+Patr%C3%ADcio+82+Palho%C3%A7a+SC',
};
