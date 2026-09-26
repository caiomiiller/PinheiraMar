-- PinheiraMar · desfazer 01-seguranca.sql (EMERGÊNCIA)
-- Volta à política antiga: a chave pública lê e grava tudo. Use só se, depois
-- de fechar o banco, o site ou o painel deixarem de funcionar — e volte a
-- correr 01-seguranca.sql quando estiver resolvido. A coluna `versao` e a
-- tabela `admins` ficam (não atrapalham a versão antiga do site).
begin;
drop policy if exists "painel: ler" on app_state;
drop policy if exists "painel: alterar" on app_state;
drop policy if exists "painel: criar" on app_state;
drop policy if exists "allow anon read/write on app_state" on app_state;
create policy "allow anon read/write on app_state" on app_state
  for all using (true) with check (true);
commit;
