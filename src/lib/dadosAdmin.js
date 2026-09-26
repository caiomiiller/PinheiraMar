// Dados do PAINEL DE GESTÃO — leitura e gravação do estado completo, como
// utilizador autenticado (Supabase Auth) e com verificação de versão.
//
// Porque é assim (revisão de 2026-09-25):
// • Cada gravação levava o JSON inteiro que aquele navegador tinha em
//   memória — um painel aberto de manhã apagava à tarde as reservas feitas
//   entretanto. Agora cada alteração é uma FUNÇÃO sobre o estado: antes de
//   gravar confere a versão; se alguém gravou entretanto, recarrega e aplica
//   a mesma função sobre os dados novos.
// • O aviso em tempo real do Supabase chega sem o JSON quando a linha passa
//   de 1 MB (a nossa tem vários) — o painel recarrega a linha ao receber o
//   aviso, em vez de depender do conteúdo do aviso.
// • Nunca se grava o "seed" de demonstração por cima de dados reais.
import { supabase, APP_STATE_TABLE, APP_STATE_ROW_ID } from './supabaseClient';
import { MODO_DEMO } from './config';
import { lerDemo, gravarDemo } from './dadosPublico';
import { provisoriaParaLimpar } from './reservas.js';

export class ErroDados extends Error {
  constructor(codigo, detalhes) { super(codigo); this.codigo = codigo; this.detalhes = detalhes; }
}

/* ───────────── sessão (login do painel) ───────────── */
let sessaoDemo = null;

export async function sessaoAtual() {
  if (MODO_DEMO) return sessaoDemo;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export function aoMudarSessao(cb) {
  if (MODO_DEMO) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_evento, s) => cb(s));
  return () => data?.subscription?.unsubscribe();
}

export async function entrar(email, senha) {
  const e = String(email || '').trim();
  if (MODO_DEMO) { sessaoDemo = { user: { email: e || 'demo@exemplo.com' }, demo: true }; return { ok: true, sessao: sessaoDemo }; }
  const { data, error } = await supabase.auth.signInWithPassword({ email: e, password: senha });
  if (error) return { ok: false, erro: /invalid/i.test(error.message || '') ? 'credenciais' : 'rede' };
  return { ok: true, sessao: data.session };
}

export async function sair() {
  if (MODO_DEMO) { sessaoDemo = null; return; }
  await supabase.auth.signOut().catch(() => {});
}

/* ───────────── leitura ───────────── */
const semColunaVersao = (e) => !!e && (e.code === '42703' || e.code === 'PGRST204' || /versao/i.test(e.message || ''));

export async function carregarAdmin() {
  if (MODO_DEMO) return { data: await lerDemo(), versao: null, updatedAt: null };
  let r = await supabase.from(APP_STATE_TABLE).select('data, versao, updated_at').eq('id', APP_STATE_ROW_ID).maybeSingle();
  if (r.error && semColunaVersao(r.error)) r = await supabase.from(APP_STATE_TABLE).select('data, updated_at').eq('id', APP_STATE_ROW_ID).maybeSingle();
  if (r.error) throw new ErroDados('leitura_falhou', r.error.message);
  // Com as regras novas, um utilizador que não está em `admins` não vê a
  // linha (vem vazio, sem erro). Nunca tratar isto como "banco vazio".
  if (!r.data) throw new ErroDados('sem_acesso_ou_vazio');
  if (!r.data.data || !Array.isArray(r.data.data.reservas)) throw new ErroDados('estado_invalido');
  return { data: r.data.data, versao: r.data.versao ?? null, updatedAt: r.data.updated_at || null };
}

// Só a "impressão digital" da linha (poucos bytes) — para saber se a cópia
// deste painel ainda é a mais recente sem descarregar tudo.
export async function frescura() {
  if (MODO_DEMO) return { versao: null, updatedAt: null };
  let r = await supabase.from(APP_STATE_TABLE).select('versao, updated_at').eq('id', APP_STATE_ROW_ID).maybeSingle();
  if (r.error && semColunaVersao(r.error)) r = await supabase.from(APP_STATE_TABLE).select('updated_at').eq('id', APP_STATE_ROW_ID).maybeSingle();
  if (r.error || !r.data) throw new ErroDados('leitura_falhou', r.error?.message);
  return { versao: r.data.versao ?? null, updatedAt: r.data.updated_at || null };
}

/* ───────────── gravação ───────────── */
// Igual ao servidor (server/estado.js): provisórias vencidas não contam.
export function reducaoSuspeita(antes, depois, agora = Date.now()) {
  const a = (antes?.reservas || []).filter(r => !provisoriaParaLimpar(r, agora)).length;
  const d = (depois?.reservas || []).length;
  return d < a - 20 && d < a * 0.9;
}

async function gravarLinha(novo, lido, { permitirReducao = false } = {}) {
  const agora = new Date().toISOString();
  // "Restaurar backup" com um arquivo mais antigo (menos reservas, de
  // propósito): passa pela função do banco que avisa o gatilho de
  // supabase/02-trava-reducao-reservas.sql a não recusar ESTA gravação —
  // qualquer outra gravação continua sujeita à verificação normal.
  if (permitirReducao) {
    const { data, error } = await supabase.rpc('gravar_app_state_ignorando_reducao', { p_data: novo, p_versao: lido.versao });
    if (error) {
      // Função ainda não existe (02-trava-reducao-reservas.sql não
      // aplicado): grava do jeito de sempre, sem a proteção do banco.
      if (error.code === '42883' || error.code === 'PGRST202') return gravarLinha(novo, lido, { permitirReducao: false });
      throw new ErroDados('gravacao_falhou', error.message);
    }
    const linha = Array.isArray(data) ? data[0] : data;
    if (!linha) return { ok: false, conflito: true };
    return { ok: true, versao: linha.nova_versao, updatedAt: linha.atualizado_em || agora };
  }
  if (lido.versao != null) {
    const { data, error } = await supabase.from(APP_STATE_TABLE)
      .update({ data: novo, versao: lido.versao + 1, updated_at: agora })
      .eq('id', APP_STATE_ROW_ID).eq('versao', lido.versao).select('versao, updated_at');
    if (error) throw new ErroDados('gravacao_falhou', error.message);
    if (!data || !data.length) return { ok: false, conflito: true };
    return { ok: true, versao: data[0].versao, updatedAt: data[0].updated_at || agora };
  }
  // SQL de supabase/01-seguranca.sql ainda não aplicado (sem `versao`):
  // grava sem verificação — mas só depois de ter relido os dados frescos.
  const { data, error } = await supabase.from(APP_STATE_TABLE)
    .update({ data: novo, updated_at: agora }).eq('id', APP_STATE_ROW_ID).select('updated_at');
  if (error) throw new ErroDados('gravacao_falhou', error.message);
  if (!data || !data.length) throw new ErroDados('sem_permissao');
  return { ok: true, versao: null, updatedAt: data[0].updated_at || agora };
}

// Aplica `fn` ao estado MAIS RECENTE e grava. `base` é a cópia que o painel
// tem ({ data, versao, updatedAt }); `pre` é o resultado já calculado de
// fn(base.data) — usado tal-qual se ninguém tiver gravado entretanto (assim
// ids gerados dentro de `fn` não mudam). Devolve a nova base.
export async function gravarAdmin(fn, base, { pre, permitirReducao = false, tentativas = 4 } = {}) {
  if (MODO_DEMO) {
    const atual = await lerDemo();
    const novo = fn(structuredClone(atual));
    gravarDemo(novo);
    return { data: novo, versao: null, updatedAt: null };
  }
  let atual = base;
  let resultado = pre;
  for (let t = 1; t <= tentativas; t++) {
    const f = await frescura();
    const mudou = !atual || f.versao !== atual.versao || f.updatedAt !== atual.updatedAt;
    if (mudou) { atual = await carregarAdmin(); resultado = undefined; }
    const novo = resultado !== undefined ? resultado : fn(structuredClone(atual.data));
    if (!novo || !Array.isArray(novo.reservas)) throw new ErroDados('estado_invalido');
    if (!permitirReducao && reducaoSuspeita(atual.data, novo)) {
      throw new ErroDados('reducao_suspeita', { antes: atual.data.reservas.length, depois: novo.reservas.length });
    }
    const w = await gravarLinha(novo, atual, { permitirReducao });
    if (w.ok) return { data: novo, versao: w.versao, updatedAt: w.updatedAt };
    atual = null; resultado = undefined; // conflito: recarrega e reaplica
    await new Promise(r => setTimeout(r, 150 * t));
  }
  throw new ErroDados('conflito_persistente');
}

// Banco vazio (instalação nova ou desastre): cria a linha a partir de um
// backup. É um INSERT — se a linha já existir, falha em vez de substituir.
export async function criarLinhaInicial(dados) {
  if (MODO_DEMO) { gravarDemo(dados); return { ok: true }; }
  const { error } = await supabase.from(APP_STATE_TABLE).insert({ id: APP_STATE_ROW_ID, data: dados, updated_at: new Date().toISOString() });
  if (!error) return { ok: true };
  if (error.code === '23505') return { ok: false, motivo: 'existe' };
  return { ok: false, motivo: error.message || 'erro' };
}

/* ───────────── tempo real ───────────── */
// Chama `cb({ versao, updatedAt })` quando outra pessoa grava. O conteúdo
// não vem no aviso (a linha passa de 1 MB) — quem ouve decide recarregar.
export function ouvirAlteracoes(cb) {
  if (MODO_DEMO) return () => {};
  const canal = supabase
    .channel('app_state_painel')
    .on('postgres_changes', { event: '*', schema: 'public', table: APP_STATE_TABLE, filter: `id=eq.${APP_STATE_ROW_ID}` },
      (p) => cb({ versao: p.new?.versao ?? null, updatedAt: p.new?.updated_at || null }))
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}

/* ───────────── encerrar sessões (kill switch) ─────────────
   Força a saída de TODOS os administradores, em qualquer dispositivo —
   inclusive de quem aciona (é preciso entrar de novo depois). Existe para
   os momentos em que se quer ter a certeza de que nenhuma aba antiga do
   painel fica gravando por cima (ex.: antes de aplicar uma migração de
   banco). Não substitui a trava do banco (supabase/02-trava-reducao-
   reservas.sql), que protege sempre, mesmo sem ninguém lembrar de clicar
   aqui — isto é um botão de conforto operacional para os casos em que se
   quer mesmo garantir uma "página em branco". */
export async function encerrarTodasSessoes() {
  if (MODO_DEMO) return { ok: false, motivo: 'demo' };
  const s = await sessaoAtual();
  try {
    const resp = await fetch('/api/admin/encerrar-sessoes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s?.access_token || ''}` },
    });
    const j = await resp.json().catch(() => ({}));
    return { ok: resp.ok && j.ok !== false, motivo: j.motivo || j.erro || (resp.ok ? null : 'http_' + resp.status), contas: j.contas ?? null };
  } catch {
    return { ok: false, motivo: 'rede' };
  }
}

/* ───────────── e-mail de confirmação (pelo servidor) ───────────── */
export async function enviarConfirmacaoReserva(reservaId) {
  if (MODO_DEMO) return { ok: false, motivo: 'demo' };
  const s = await sessaoAtual();
  try {
    const resp = await fetch('/api/admin/enviar-confirmacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token || ''}` },
      body: JSON.stringify({ reservaId }),
    });
    const j = await resp.json().catch(() => ({}));
    return { ok: resp.ok && j.ok !== false, motivo: j.motivo || j.erro || (resp.ok ? null : 'http_' + resp.status), enviadoEm: j.enviadoEm || null };
  } catch {
    return { ok: false, motivo: 'rede' };
  }
}
