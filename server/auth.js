// Quem está a chamar uma função "de gestão"? Confere o token de sessão do
// Supabase Auth (login do painel) e se o e-mail está na tabela `admins`
// (ver supabase/01-seguranca.sql). Sem isto, qualquer pessoa que criasse uma
// conta no Supabase contaria como "autenticada".
import { clienteServidor } from './estado.js';

// Devolve { email } ou { erro: 'nao_autorizado' | 'configuracao_pendente' }.
export async function verificarAdmin(req) {
  const auth = String(req.headers?.authorization || '');
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === auth) return { erro: 'nao_autorizado' };
  const sb = clienteServidor();
  if (!sb) return { erro: 'configuracao_pendente' };
  try {
    const { data, error } = await sb.auth.getUser(token);
    const email = data?.user?.email?.toLowerCase();
    if (error || !email) return { erro: 'nao_autorizado' };
    // igualdade exata (o SQL guarda os e-mails em minúsculas) — com "ilike",
    // "_" e "%" no e-mail funcionariam como curingas
    const { data: linhas, error: e2 } = await sb.from('admins').select('email').eq('email', email).limit(1);
    if (e2) {
      // tabela admins ainda não existe: falta correr supabase/01-seguranca.sql
      if (e2.code === '42P01' || e2.code === 'PGRST205' || /admins/i.test(e2.message || '')) return { erro: 'configuracao_pendente' };
      return { erro: 'nao_autorizado' };
    }
    if (!linhas?.length) return { erro: 'nao_autorizado' };
    return { email };
  } catch {
    return { erro: 'nao_autorizado' };
  }
}
