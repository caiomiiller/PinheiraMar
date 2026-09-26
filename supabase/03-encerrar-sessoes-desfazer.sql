-- PinheiraMar · desfazer 03-encerrar-sessoes.sql
-- Remove a função "encerrar sessões" e o acesso a ela. O botão no painel
-- passa a devolver erro (função não existe) até rodar 03 de novo.
begin;
drop function if exists public.encerrar_sessoes_admin();
commit;
