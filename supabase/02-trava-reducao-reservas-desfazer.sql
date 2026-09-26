-- PinheiraMar · desfazer 02-trava-reducao-reservas.sql (EMERGÊNCIA)
-- Remove o gatilho e a função de restauração — volta a permitir qualquer
-- gravação em app_state, sem checar quedas no nº de reservas. Use só se,
-- depois de aplicar 02-trava-reducao-reservas.sql, alguma gravação legítima
-- (que não seja "Restaurar backup") passar a ser recusada por engano.
begin;
drop trigger if exists trg_app_state_bloquear_reducao on app_state;
drop function if exists public.app_state_bloquear_reducao_suspeita();
drop function if exists public.gravar_app_state_ignorando_reducao(jsonb, bigint);
drop function if exists public.safe_ts(text);
drop function if exists public.safe_num(text);
commit;
