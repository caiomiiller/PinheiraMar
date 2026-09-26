// POST /api/admin/enviar-confirmacao { reservaId } — (re)envia o e-mail de
// confirmação de uma reserva. Só para quem entrou no painel (token do
// Supabase Auth + e-mail na tabela `admins`). O e-mail sai do servidor.
import { lerEstado } from '../../server/estado.js';
import { verificarAdmin } from '../../server/auth.js';
import { enviarConfirmacao, registarEnvio } from '../../server/email.js';
import { corpoJSON, responder } from '../../server/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { ok: false, erro: 'metodo_nao_permitido' });
  const admin = await verificarAdmin(req);
  if (!admin?.email) return responder(res, admin?.erro === 'configuracao_pendente' ? 503 : 401, { ok: false, erro: admin?.erro || 'nao_autorizado' });
  const b = corpoJSON(req) || {};
  const id = String(b.reservaId || '');
  try {
    const { data } = await lerEstado();
    const r = (data.reservas || []).find(x => x.id === id);
    if (!r) return responder(res, 404, { ok: false, erro: 'reserva_nao_encontrada' });
    if (r.status === 'cancelada' || r.status === 'bloqueio') return responder(res, 422, { ok: false, erro: 'reserva_' + r.status });
    if (!r.email) return responder(res, 422, { ok: false, erro: 'sem_email' });
    // numa reserva conjunta vai um e-mail só, com a reserva principal à frente
    const ref = r.pagamentoRef || r.id;
    const grupo = (r.pagamentoRef ? data.reservas.filter(x => x.id === ref || x.pagamentoRef === ref) : [r])
      .filter(x => x.status !== 'cancelada')
      .sort((a, b2) => (a.id === ref ? -1 : b2.id === ref ? 1 : 0))
      .map(x => ({ reserva: x, apt: (data.apartamentos || []).find(a => a.id === x.apartamentoId) }));
    const residencial = (data.residenciais || []).find(x => x.id === grupo[0]?.apt?.residencialId) || (data.residenciais || [])[0];
    const env = await enviarConfirmacao(grupo.length ? grupo : [{ reserva: r, apt: (data.apartamentos || []).find(a => a.id === r.apartamentoId) || null }], residencial);
    const quando = new Date().toISOString();
    if (env.ok) await registarEnvio(grupo.length ? grupo.map(g => g.reserva.id) : [r.id], quando);
    return responder(res, env.ok ? 200 : 502, { ok: !!env.ok, motivo: env.motivo || null, enviadoEm: env.ok ? quando : null });
  } catch (err) {
    console.error('[admin/enviar-confirmacao]', err.codigo || err);
    return responder(res, 503, { ok: false, erro: 'servico_indisponivel' });
  }
}
