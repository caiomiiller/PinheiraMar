// GET /api/estado-publico — o que o site público precisa para funcionar
// (apartamentos, temporadas/preços, taxas, textos dos residenciais e as
// datas ocupadas), SEM dados pessoais de hóspedes. Ver server/publico.js.
import { lerEstado } from '../server/estado.js';
import { estadoPublico } from '../server/publico.js';
import { responder } from '../server/http.js';
import { migrarDados } from '../src/lib/migracoes.js';
import { hojeISO } from '../src/lib/reservas.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return responder(res, 405, { erro: 'metodo_nao_permitido' });
  try {
    const { data } = await lerEstado();
    const corpo = estadoPublico(migrarDados(data).data, hojeISO());
    // Pode ficar uns segundos em cache na CDN da Vercel (menos leituras do
    // banco inteiro). A disponibilidade é sempre conferida de novo pelo
    // servidor no momento de reservar (/api/reservar).
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=5, stale-while-revalidate=25');
    return res.status(200).json(corpo);
  } catch (err) {
    console.error('[estado-publico] falhou:', err.codigo || err, err.detalhes || '');
    return responder(res, 503, { erro: err.codigo || 'indisponivel' });
  }
}
