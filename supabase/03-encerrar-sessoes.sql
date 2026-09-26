-- ═══════════════════════════════════════════════════════════════════════
-- PinheiraMar · 03 — encerrar sessões de todos os administradores  (2026-09-26)
-- ═══════════════════════════════════════════════════════════════════════
--
-- POR QUE EXISTE
--   Um "botão de emergência" (Painel → Base de dados → Encerrar todas as
--   sessões do painel) para os momentos em que se quer ter a certeza de
--   que ninguém fica com uma aba antiga do painel aberta gravando por cima
--   — por exemplo, antes de aplicar uma migração de banco como esta.
--
--   AVISO IMPORTANTE — o que isto NÃO faz: apaga os "refresh tokens" (o
--   que permite pedir um acesso novo quando o atual vence), então ninguém
--   consegue continuar logado indefinidamente. Mas o token de acesso que
--   uma aba já tem guardado continua válido até vencer sozinho (por
--   padrão, Supabase usa até 1 hora) — não existe, hoje, um jeito de
--   invalidar um token já emitido na hora. Ou seja: isto reduz a janela de
--   risco de "indefinida" para "no máximo ~1h", não a zera. A trava de
--   verdade continua sendo o gatilho de 02-trava-reducao-reservas.sql, que
--   não depende disto.
--
--   Por segurança, a função só pode ser chamada pelo servidor (com a
--   SUPABASE_SERVICE_ROLE_KEY) — api/admin/encerrar-sessoes.js confere
--   antes que quem pediu é mesmo um admin logado (mesma verificação de
--   sempre). Não é possível chamar isto direto do navegador.
--
-- SE DER ERRO ao rodar (ex.: "relation auth.sessions does not exist" numa
-- instalação mais antiga): avise, porque aí o esquema do Supabase Auth do
-- projeto é diferente do que este script pressupõe, e precisa de um ajuste.
-- ═══════════════════════════════════════════════════════════════════════

begin;

create or replace function public.encerrar_sessoes_admin()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n integer := 0;
begin
  with alvo as (
    select u.id from auth.users u
    join public.admins a on lower(a.email) = lower(u.email)
  )
  delete from auth.sessions s using alvo where s.user_id = alvo.id;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Só o servidor (service_role) pode chamar — nunca o navegador, mesmo já
-- logado como admin. api/admin/encerrar-sessoes.js é o único chamador.
revoke all on function public.encerrar_sessoes_admin() from public, authenticated, anon;
grant execute on function public.encerrar_sessoes_admin() to service_role;

commit;
