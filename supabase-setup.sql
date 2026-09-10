-- PinheiraMar — configuração do Supabase para sincronizar os dados
-- (reservas, apartamentos, temporadas, etc.) entre dispositivos.
--
-- Como usar: Supabase → seu projeto → SQL Editor → cole tudo isto → Run.
-- Pode executar mais de uma vez sem problema (usa "if not exists"/"or replace").
--
-- Guarda-se TUDO numa única linha (id = 'main') de uma única tabela, em
-- formato JSON — é exactamente a mesma "forma" de dados que já vivia no
-- localStorage do navegador (ver src/lib/seed.js), só que agora partilhada.

create table if not exists app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security precisa de estar ligado para a API aceitar pedidos com
-- a chave pública (anon) — a política abaixo liberta leitura E escrita para
-- essa chave. Isto é necessário porque tanto o site público (hóspedes a
-- criar reservas) como o painel de gestão (protegido pelo PIN, mas do lado
-- do navegador) usam a mesma chave pública para gravar dados; não há hoje
-- um sistema de utilizadores/autenticação "a sério" por trás do PIN.
--
-- Nota de segurança: com esta política, qualquer pessoa com conhecimento
-- técnico que inspecione o site consegue, em teoria, ler ou alterar os
-- dados directamente pela API do Supabase (incluindo nome/e-mail/telefone
-- de hóspedes), sem passar pelo PIN do painel. Antes disto, os dados nunca
-- saíam do navegador de cada pessoa — este é o "custo" de passar a
-- sincronizar entre dispositivos sem construir um sistema de autenticação
-- próprio. Se um dia quiser reforçar isto, o caminho é mover as escritas
-- do painel para trás de uma função no servidor (Supabase Edge Function)
-- que valide o PIN antes de gravar.
alter table app_state enable row level security;

drop policy if exists "allow anon read/write on app_state" on app_state;
create policy "allow anon read/write on app_state" on app_state
  for all
  using (true)
  with check (true);

-- Sincronização em tempo real: quando um dispositivo grava, os outros
-- recebem a atualização na hora, sem precisar de recarregar a página.
alter publication supabase_realtime add table app_state;
