-- ═══════════════════════════════════════════════════════════════════════
-- PinheiraMar · 02 — travar gravações que apagam reservas  (2026-09-26)
-- ═══════════════════════════════════════════════════════════════════════
--
-- POR QUE EXISTE
--   O 01-seguranca.sql resolveu QUEM pode gravar em app_state (só admin
--   autenticado). Mas não resolve SE a gravação é segura: essa verificação
--   (não deixar o nº de reservas cair de repente) vivia só no código do
--   navegador (server/estado.js, src/lib/dadosAdmin.js). Uma aba do painel
--   ainda com o código de ANTES desta revisão — aberta por alguém da
--   equipa, em qualquer fuso, sem que ninguém tivesse como saber — continua
--   autenticada e continua a gravar o JSON inteiro por cima, sem essa
--   verificação, porque ela não existe nesse código antigo. Foi assim que
--   2 reservas (PM-RAGV, PM-UP2J) desapareceram em 25/09.
--
--   Este ficheiro move a mesma verificação para dentro do banco, como um
--   gatilho (trigger) que corre em QUALQUER gravação em app_state — não
--   importa se veio do painel novo, de uma aba antiga esquecida aberta, ou
--   de outra coisa qualquer no futuro. Resolve na raiz; não depende de
--   ninguém lembrar de fechar sessões antes de publicar uma revisão.
--
-- O QUE FAZ
--   Antes de qualquer UPDATE em app_state, compara o nº de reservas de
--   antes com o de depois (ignorando reservas provisórias do site que já
--   venceram há mais de 24h e nunca foram pagas — essas podem mesmo sumir,
--   é a arrumação normal). Se a queda for grande (mais de 20 E menos de
--   90% do que tinha antes), a gravação inteira é recusada — nada é
--   alterado, e quem tentou gravar recebe um erro claro.
--
--   Isto é uma rede de segurança adicional (o painel já tem a sua própria,
--   client-side) — pensada para nunca travar uma operação legítima por
--   engano: se algo inesperado impedir o próprio cálculo de rodar (um
--   formato de dados que eu não previ), a gravação passa mesmo assim, em
--   vez de travar o painel inteiro por causa de um bug aqui.
--
--   O "Restaurar backup" do painel (Base de dados → Importar → escolher um
--   .json) é a ÚNICA operação que legitimamente pode reduzir bastante o nº
--   de reservas (restaurar um backup mais antigo, de propósito). Por isso
--   ela passa a gravar por uma função própria (gravar_app_state_ignorando_
--   reducao) que avisa o gatilho, só naquela gravação, para não bloquear.
--   Qualquer outra gravação (painel normal, aba antiga, o que for) continua
--   sujeita à verificação.
--
-- PARA DESFAZER: supabase/02-trava-reducao-reservas-desfazer.sql
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- Conversões "seguras": nunca dão erro — devolvem null se o texto não for
-- um número/data válido. Usadas para nunca deixar um registo antigo com um
-- campo estranho travar TODAS as gravações futuras.
create or replace function public.safe_ts(t text) returns timestamptz
language plpgsql immutable as $$
begin
  return t::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public.safe_num(t text) returns numeric
language plpgsql immutable as $$
begin
  return t::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.app_state_bloquear_reducao_suspeita()
returns trigger
language plpgsql
as $$
declare
  limite timestamptz := clock_timestamp() - interval '24 hours';
  efetivo_antes integer;
  depois integer;
begin
  -- Só a função gravar_app_state_ignorando_reducao (o "Restaurar backup" do
  -- painel) liga isto, e só para a gravação dela mesma — nunca persiste,
  -- nunca vem de fora, e uma aba antiga jamais saberia ligar isto.
  if coalesce(current_setting('app_state.permitir_reducao', true), '') = 'on' then
    return NEW;
  end if;

  -- Sem "antes" válido para comparar (linha a ser criada de novo, ou já
  -- estava num formato que não reconhecemos) — nada a proteger aqui.
  if OLD.data is null or jsonb_typeof(OLD.data->'reservas') is distinct from 'array' then
    return NEW;
  end if;
  -- NEW inválido é outro problema (a aplicação já recusa isto do seu lado);
  -- este gatilho só cuida de quedas suspeitas, não de validar a forma.
  if NEW.data is null or jsonb_typeof(NEW.data->'reservas') is distinct from 'array' then
    return NEW;
  end if;
  if NEW.data->'reservas' = OLD.data->'reservas' then
    return NEW; -- reservas não mudaram nesta gravação
  end if;

  begin
    select count(*) into efetivo_antes
    from jsonb_array_elements(OLD.data->'reservas') r
    where not (
      (r->>'status') = 'pendente'
      and (r->>'expiraEm') is not null
      and public.safe_ts(r->>'expiraEm') is not null
      and public.safe_ts(r->>'expiraEm') <= limite
      and coalesce(public.safe_num(r->>'valorPago'), 0) <= 0
      and coalesce(jsonb_array_length(r->'registrosPagamento'), 0) = 0
      and coalesce((r->>'pagamentoDivergente')::boolean, false) = false
      and coalesce(r->>'pagamentoStatus', '') <> 'approved'
    );
  exception when others then
    -- Algo nos dados de OLD que não previmos: não arrisca travar o painel
    -- inteiro por causa de um bug aqui — deixa a gravação passar.
    return NEW;
  end;

  depois := jsonb_array_length(NEW.data->'reservas');

  if depois < efetivo_antes - 20 and depois < efetivo_antes * 0.9 then
    raise exception 'reducao_suspeita: % reservas antes (sem provisórias já vencidas), % depois — gravação recusada para conferir antes de perder dados.', efetivo_antes, depois
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_app_state_bloquear_reducao on app_state;
create trigger trg_app_state_bloquear_reducao
  before update on app_state
  for each row execute function public.app_state_bloquear_reducao_suspeita();

-- Gravação que o "Restaurar backup" do painel usa em vez do UPDATE direto,
-- exatamente quando o backup escolhido tem menos reservas do que o banco
-- hoje (a redução ali é intencional). `security invoker`: continua a valer
-- a política "painel: alterar" (só admin) — isto não abre nenhuma porta
-- nova, só avisa o gatilho acima para não recusar ESTA gravação em concreto.
create or replace function public.gravar_app_state_ignorando_reducao(p_data jsonb, p_versao bigint default null)
returns table(nova_versao bigint, atualizado_em timestamptz)
language plpgsql
security invoker
as $$
begin
  if not public.is_admin() then
    raise exception 'nao_autorizado' using errcode = '42501';
  end if;
  perform set_config('app_state.permitir_reducao', 'on', true); -- true = só nesta transação
  if p_versao is not null then
    return query
      update app_state set data = p_data, versao = p_versao + 1, updated_at = clock_timestamp()
      where id = 'main' and versao = p_versao
      returning versao, updated_at;
  else
    return query
      update app_state set data = p_data, updated_at = clock_timestamp()
      where id = 'main'
      returning versao, updated_at;
  end if;
end;
$$;
revoke all on function public.gravar_app_state_ignorando_reducao(jsonb, bigint) from public;
grant execute on function public.gravar_app_state_ignorando_reducao(jsonb, bigint) to authenticated;

commit;

-- Conferir depois: tente restaurar um backup antigo (Painel → Base de
-- dados → Importar) com bem menos reservas do que o banco tem hoje — deve
-- aparecer um erro em vez de apagar tudo. Um "Restaurar backup" legítimo
-- (poucas reservas a menos, ou o backup é mais recente) continua a
-- funcionar normalmente.
