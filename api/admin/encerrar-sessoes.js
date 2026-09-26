// POST /api/admin/encerrar-sessoes — encerra as sessões de TODOS os
// administradores (Supabase Auth), em qualquer dispositivo — inclusive de
// quem aciona. Só quem já está autenticado como admin pode chamar (mesma
// verificação de sempre, ver server/auth.js). Existe como um "botão de
// emergência" para os momentos em que se quer ter certeza de que nenhuma
// aba antiga do painel fica aberta gravando por cima de dados novos (ex.:
// antes de aplicar uma migração de banco) — complementa, mas não
// substitui, a trava do banco em supabase/02-trava-reducao-reservas.sql,
// que protege sempre, mesmo que ninguém clique aqui.
//
// AVISO: isto revoga os "refresh tokens" (ninguém consegue pedir um acesso
// novo depois de o atual vencer), mas um token de acesso já emitido
// continua válido até vencer sozinho (por padrão, até ~1h no Supabase) —
// não existe hoje um jeito de invalidar isso na hora. Ver
// supabase/03-encerrar-sessoes.sql para o detalhe.
import { verificarAdmin } from '../../server/auth.js';
import { clienteServidor, configServidor } from '../../server/estado.js';
import { responder } from '../../server/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { ok: false, erro: 'metodo_nao_permitido' });
  const admin = await verificarAdmin(req);
  if (!admin?.email) return responder(res, admin?.erro === 'configuracao_pendente' ? 503 : 401, { ok: false, erro: admin?.erro || 'nao_autorizado' });
  if (!configServidor().temServiceRole) return responder(res, 503, { ok: false, erro: 'sem_service_role' });
  const sb = clienteServidor();
  try {
    const { data, error } = await sb.rpc('encerrar_sessoes_admin');
    if (error) {
      // supabase/03-encerrar-sessoes.sql ainda não foi aplicado
      if (error.code === '42883' || error.code === 'PGRST202') return responder(res, 503, { ok: false, erro: 'configuracao_pendente' });
      throw error;
    }
    return responder(res, 200, { ok: true, contas: typeof data === 'number' ? data : null });
  } catch (err) {
    console.error('[admin/encerrar-sessoes]', err?.message || err);
    return responder(res, 503, { ok: false, erro: 'servico_indisponivel' });
  }
}
