// Acesso ao estado (linha única 'main' da tabela app_state) a partir das
// funções da Vercel. Três regras que resolvem os problemas da revisão:
//
// 1. Ler sempre fresco, logo antes de alterar — nunca gravar uma cópia velha.
// 2. Gravar com "compare-and-swap" pela coluna `versao`: só grava se ninguém
//    gravou entretanto; se gravou, lê de novo e reaplica a MESMA alteração
//    (alterarEstado). Antes, a última gravação apagava as anteriores.
// 3. Nunca semear nem gravar por cima quando a leitura falha ou vem vazia.
//
// Enquanto o SQL de supabase/ não tiver sido aplicado (sem coluna `versao`),
// continua a funcionar: relê logo antes de gravar e grava sem a verificação.
import { createClient } from '@supabase/supabase-js';
import { provisoriaParaLimpar } from '../src/lib/reservas.js';

export const TABELA = 'app_state';
export const LINHA = 'main';

export class ErroServidor extends Error {
  constructor(codigo, detalhes = {}) { super(codigo); this.codigo = codigo; this.detalhes = detalhes; }
}

export function configServidor() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return { url, chave: service || anon, temServiceRole: !!service };
}

let cache = null;
export function clienteServidor() {
  const { url, chave } = configServidor();
  if (!url || !chave) return null;
  const k = url + '|' + chave;
  if (!cache || cache.k !== k) {
    cache = { k, sb: createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) };
  }
  return cache.sb;
}

const semColunaVersao = (e) => !!e && (e.code === '42703' || e.code === 'PGRST204' || /versao/i.test(e.message || ''));

export async function lerEstado(sb = clienteServidor()) {
  if (!sb) throw new ErroServidor('supabase_nao_configurado');
  let r = await sb.from(TABELA).select('data, versao, updated_at').eq('id', LINHA).maybeSingle();
  if (r.error && semColunaVersao(r.error)) {
    r = await sb.from(TABELA).select('data, updated_at').eq('id', LINHA).maybeSingle();
  }
  if (r.error) throw new ErroServidor('leitura_falhou', { causa: r.error.message || String(r.error) });
  // Sem linha: banco vazio OU sem permissão para a ver (ex.: falta a
  // SUPABASE_SERVICE_ROLE_KEY na Vercel depois de aplicar as regras novas).
  if (!r.data) throw new ErroServidor('estado_vazio_ou_sem_acesso');
  if (!r.data.data || !Array.isArray(r.data.data.reservas)) throw new ErroServidor('estado_invalido');
  return { data: r.data.data, versao: r.data.versao ?? null, updatedAt: r.data.updated_at || null };
}

// Cinto de segurança contra apagões: nenhuma alteração "normal" faz o número
// de reservas cair de repente. Só o restaurar de backup (permitirReducao) pode.
// As provisórias do site que já venceram (e que a arrumação apaga) não
// contam: senão, muitas reservas abandonadas bloqueavam todas as gravações.
export function reducaoSuspeita(antes, depois, agora = Date.now()) {
  const a = (antes?.reservas || []).filter(r => !provisoriaParaLimpar(r, agora)).length;
  const d = (depois?.reservas || []).length;
  return d < a - 20 && d < a * 0.9;
}

export async function gravarEstado(sb, novo, lido, { permitirReducao = false } = {}) {
  if (!novo || !Array.isArray(novo.reservas)) throw new ErroServidor('estado_invalido');
  if (!permitirReducao && reducaoSuspeita(lido.data, novo)) {
    throw new ErroServidor('reducao_suspeita', { antes: lido.data.reservas.length, depois: novo.reservas.length });
  }
  const agora = new Date().toISOString();
  if (lido.versao != null) {
    const { data, error } = await sb.from(TABELA)
      .update({ data: novo, versao: lido.versao + 1, updated_at: agora })
      .eq('id', LINHA).eq('versao', lido.versao)
      .select('versao');
    if (error) throw new ErroServidor('gravacao_falhou', { causa: error.message || String(error) });
    if (!data || data.length === 0) return { ok: false, conflito: true };
    return { ok: true, versao: data[0].versao, updatedAt: agora };
  }
  const { data, error } = await sb.from(TABELA).update({ data: novo, updated_at: agora }).eq('id', LINHA).select('updated_at');
  if (error) throw new ErroServidor('gravacao_falhou', { causa: error.message || String(error) });
  // 0 linhas alteradas sem erro = as regras do banco não deixaram gravar
  // (nunca dar isto como gravado)
  if (!data || data.length === 0) throw new ErroServidor('sem_permissao');
  return { ok: true, versao: null, updatedAt: data[0].updated_at || agora, semVersao: true };
}

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

// Lê fresco → aplica `fn` → grava com verificação de versão; em conflito,
// repete tudo (a alteração é reaplicada sobre os dados novos). `fn` recebe
// uma CÓPIA do estado e devolve { estado, resultado } — `estado: null`
// significa "não há nada para gravar".
export async function alterarEstado(fn, { tentativas = 5, permitirReducao = false, sb = clienteServidor() } = {}) {
  if (!sb) throw new ErroServidor('supabase_nao_configurado');
  for (let t = 1; t <= tentativas; t++) {
    const lido = await lerEstado(sb);
    const r = (await fn(structuredClone(lido.data), lido)) || {};
    if (!r.estado) return { gravado: false, resultado: r.resultado, estado: lido.data };
    const w = await gravarEstado(sb, r.estado, lido, { permitirReducao });
    if (w.ok) return { gravado: true, resultado: r.resultado, estado: r.estado, versao: w.versao };
    await esperar(60 * t + Math.floor(Math.random() * 120));
  }
  throw new ErroServidor('conflito_persistente');
}
