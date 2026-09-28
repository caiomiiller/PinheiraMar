// Envio de fotos direto do dispositivo (telemóvel/computador) para o
// Supabase Storage, no bucket "fotos-apartamentos" (ver
// supabase/04-fotos-upload.sql). Antes só era possível colar o URL de uma
// foto já hospedada noutro lugar — isto dá autonomia para enviar a foto
// original e ficar com um URL público pronto a guardar no apartamento.
//
// Cada imagem é redimensionada e comprimida no navegador antes do envio
// (máx. ~1600px no lado maior, JPEG ~82%), para não gastar armazenamento
// nem deixar o painel lento com fotos de câmara/telemóvel muito grandes.
import { supabase, supabaseConfigured } from './supabaseClient';

const BUCKET = 'fotos-apartamentos';
const MAX_LADO = 1600;
const QUALIDADE_JPEG = 0.82;

// Reduz uma imagem para no máximo MAX_LADO px no lado maior e recodifica
// como JPEG. HEIC/HEIF (fotos de iPhone) não são desenháveis em <canvas> em
// todos os navegadores — nesse caso devolve o ficheiro original sem mexer,
// e o Supabase Storage aceita-o na mesma (o bucket permite image/heic).
function comprimirImagem(file) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type === 'image/heic' || file.type === 'image/heif') {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
      const w = Math.round(img.width * escala);
      const h = Math.round(img.height * escala);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], renomearParaJpeg(file.name), { type: 'image/jpeg' }) : file),
        'image/jpeg', QUALIDADE_JPEG
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function renomearParaJpeg(nome) {
  return String(nome || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
}

function extensaoDe(file) {
  const porNome = /\.([a-z0-9]+)$/i.exec(file.name || '');
  if (porNome) return porNome[1].toLowerCase();
  const porTipo = /\/(\w+)/.exec(file.type || '');
  return porTipo ? porTipo[1].toLowerCase() : 'jpg';
}

function caminhoAleatorio(residencialId, apartamentoId, file) {
  const aleatorio = Math.random().toString(36).slice(2, 10);
  return `${residencialId || 'sem-residencial'}/${apartamentoId || 'novo'}/${Date.now()}-${aleatorio}.${extensaoDe(file)}`;
}

// Envia uma foto e devolve o URL público. Lança erro (com mensagem em
// português, pronta para mostrar ao Caio) se algo falhar.
export async function enviarFotoApartamento(file, { residencialId, apartamentoId } = {}) {
  if (!supabaseConfigured) throw new Error('Envio de fotos não está configurado (Supabase).');
  if (!file) throw new Error('Nenhum ficheiro selecionado.');
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" não é uma imagem.`);
  if (file.size > 8 * 1024 * 1024) throw new Error(`"${file.name}" passa de 8 MB — escolha uma foto menor.`);

  const preparado = await comprimirImagem(file);
  const caminho = caminhoAleatorio(residencialId, apartamentoId, preparado);

  const { error: erroEnvio } = await supabase.storage.from(BUCKET).upload(caminho, preparado, {
    cacheControl: '31536000',
    contentType: preparado.type || file.type,
    upsert: false,
  });
  if (erroEnvio) {
    if (/bucket.*not.*found/i.test(erroEnvio.message || '')) {
      throw new Error('O espaço de armazenamento de fotos ainda não foi criado — corra supabase/04-fotos-upload.sql no Supabase.');
    }
    throw new Error(`Falha ao enviar "${file.name}": ${erroEnvio.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
  if (!data?.publicUrl) throw new Error(`Não foi possível obter o link de "${file.name}" depois do envio.`);
  return data.publicUrl;
}

// Envia várias fotos em sequência, chamando onProgresso(indiceAtual, total)
// antes de cada envio. Devolve { urls, erros } — continua mesmo se uma foto
// falhar, para não perder as que já deram certo.
export async function enviarFotosApartamento(files, opts, onProgresso) {
  const urls = [];
  const erros = [];
  const lista = Array.from(files || []);
  for (let idx = 0; idx < lista.length; idx++) {
    onProgresso?.(idx, lista.length);
    try { urls.push(await enviarFotoApartamento(lista[idx], opts)); }
    catch (e) { erros.push(e.message || String(e)); }
  }
  return { urls, erros };
}
