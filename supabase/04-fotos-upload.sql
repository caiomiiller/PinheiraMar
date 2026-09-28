-- ═════════════════════════════════════════════════════════════════════════
-- PinheiraMar · 04 — bucket de armazenamento para fotos de apartamentos
--                     enviadas do dispositivo (2026-09-28)
-- ══════════════════════════════════════════════════════════════════════
--
-- POR QUE EXISTE
--   Até aqui, a única forma de pôr uma foto num apartamento era colar o
--   URL de uma imagem já hospedada noutro lugar — o Caio não tinha como
--   enviar uma foto direto do telemóvel/computador pelo painel. Este
--   ficheiro cria um espaço de armazenamento (bucket) no Supabase Storage
--   para essas fotos, com leitura pública (o site precisa de mostrar as
--   fotos a qualquer visitante, sem login) e gravação só para quem está
--   autenticado no painel como admin — a mesma função is_admin() já usada
--   em 01-seguranca.sql.
--
-- O QUE FAZ
--   1. Cria o bucket "fotos-apartamentos" (público para leitura, limite de
--      8 MB por ficheiro, só imagens).
--   2. Políticas em storage.objects: qualquer pessoa lê (SELECT) ficheiros
--      desse bucket; só um admin autenticado pode enviar (INSERT), trocar
--      (UPDATE) ou apagar (DELETE).
--
-- Pode correr mais de uma vez. Para desfazer: 04-fotos-upload-desfazer.sql
-- (isso NÃO apaga as fotos já enviadas, só as políticas e o bucket — apagar
-- o bucket com fotos dentro falha de propósito, para não perder nada por
-- engano).
-- ═══════════════════════════════════════════════════════════════════════

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-apartamentos', 'fotos-apartamentos', true,
  8388608, -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

drop policy if exists "fotos-apartamentos: leitura publica" on storage.objects;
drop policy if exists "fotos-apartamentos: admin envia" on storage.objects;
drop policy if exists "fotos-apartamentos: admin atualiza" on storage.objects;
drop policy if exists "fotos-apartamentos: admin apaga" on storage.objects;

create policy "fotos-apartamentos: leitura publica"
  on storage.objects for select
  using (bucket_id = 'fotos-apartamentos');

create policy "fotos-apartamentos: admin envia"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'fotos-apartamentos' and public.is_admin());

create policy "fotos-apartamentos: admin atualiza"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'fotos-apartamentos' and public.is_admin());

create policy "fotos-apartamentos: admin apaga"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fotos-apartamentos' and public.is_admin());

commit;

-- Conferir depois:  select id, public, file_size_limit from storage.buckets where id = 'fotos-apartamentos';
