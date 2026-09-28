-- PinheiraMar · desfazer 04-fotos-upload.sql
-- Remove as políticas de storage.objects e o bucket "fotos-apartamentos".
-- NÃO apaga fotos já enviadas: se o bucket ainda tiver ficheiros dentro,
-- o DELETE do bucket falha de propósito (é assim que o Postgres protege
-- ficheiros de storage) — em vez de perder fotos por engano, o comando
-- simplesmente não termina e avisa no erro. Para desfazer de vez, apague
-- as fotos primeiro (pelo painel do Supabase, em Storage) e corra de novo.
begin;
drop policy if exists "fotos-apartamentos: leitura publica" on storage.objects;
drop policy if exists "fotos-apartamentos: admin envia" on storage.objects;
drop policy if exists "fotos-apartamentos: admin atualiza" on storage.objects;
drop policy if exists "fotos-apartamentos: admin apaga" on storage.objects;
delete from storage.buckets where id = 'fotos-apartamentos';
commit;
