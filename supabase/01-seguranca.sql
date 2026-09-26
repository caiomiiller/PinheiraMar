-- ═══════════════════════════════════════════════════════════════════════
-- PinheiraMar · 01 — fechar o banco e gravar com versão  (revisão 2026-09)
-- ═══════════════════════════════════════════════════════════════════════
--
-- O QUE FAZ
--   1. Acrescenta a coluna `versao` à tabela app_state (gravações passam a
--      verificar se ninguém gravou entretanto — ver server/estado.js).
--   2. Cria a tabela `admins` (quem pode entrar no painel) e a função
--      is_admin().
--   3. Troca a política antiga ("qualquer pessoa lê e grava tudo com a chave
--      pública") por: só utilizadores do painel (Supabase Auth, com o e-mail
--      em `admins`) leem/gravam. O site público passa a ler pelo servidor
--      (/api/estado-publico), sem dados pessoais.
--
-- ANTES DE CORRER (por esta ordem — ver README, secção "Publicar a revisão"):
--   a) Vercel → Settings → Environment Variables: SUPABASE_SERVICE_ROLE_KEY
--      (Supabase → Project Settings → API → service_role) — SEM prefixo VITE_.
--   b) Publicar (deploy) a versão nova do site e confirmar que abre.
--   c) Supabase → Authentication → Users → "Add user": criar o seu utilizador
--      (e-mail + senha). E em Authentication → Sign In / Providers: desligar
--      "Allow new users to sign up".
--   d) Trocar o e-mail na linha marcada abaixo (pode pôr mais do que um).
--
-- Pode correr mais de uma vez. Corre tudo numa transação: se algo falhar,
-- nada muda. Para desfazer: supabase/01-seguranca-desfazer.sql
-- ═══════════════════════════════════════════════════════════════════════

begin;

create table if not exists app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_state add column if not exists versao bigint not null default 0;

create table if not exists admins (email text primary key);
alter table admins enable row level security;          -- sem políticas: invisível pela API pública
revoke all on table admins from anon, authenticated;

-- ▼▼▼ TROQUE PELO(S) E-MAIL(S) DE QUEM GERE O PAINEL ▼▼▼
insert into admins (email) values
  ('SEU-EMAIL-AQUI@exemplo.com')
on conflict do nothing;
-- ▲▲▲ ─────────────────────────────────────────────── ▲▲▲

delete from admins where email = 'SEU-EMAIL-AQUI@exemplo.com';
update admins set email = lower(trim(email));

do $$
begin
  if (select count(*) from admins) = 0 then
    raise exception 'Nenhum e-mail em admins: troque SEU-EMAIL-AQUI@exemplo.com pelo seu e-mail antes de correr (senão ninguém consegue entrar no painel).';
  end if;
end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admins where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table app_state enable row level security;
drop policy if exists "allow anon read/write on app_state" on app_state;
drop policy if exists "painel: ler" on app_state;
drop policy if exists "painel: alterar" on app_state;
drop policy if exists "painel: criar" on app_state;
create policy "painel: ler"     on app_state for select to authenticated using (public.is_admin());
create policy "painel: alterar" on app_state for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "painel: criar"   on app_state for insert to authenticated with check (public.is_admin());
-- (sem política para `anon`: a chave pública deixa de ler ou gravar o banco)

-- tempo real para o painel (o aviso chega sem o JSON quando passa de 1 MB;
-- o painel recarrega a linha ao receber o aviso)
do $$
begin
  alter publication supabase_realtime add table app_state;
exception when duplicate_object then null;
end $$;

commit;

-- Conferir depois:  select email from admins;
--                   select id, versao, updated_at from app_state;
