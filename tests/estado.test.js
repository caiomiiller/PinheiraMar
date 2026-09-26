import { describe, it, expect } from 'vitest';
import { alterarEstado, lerEstado, ErroServidor } from '../server/estado.js';
import { estado, reserva } from './fixtures.js';

// Supabase de mentira: só o necessário para select/update na linha 'main'.
function fakeSupabase({ linha, comVersao = true, bloquearEscrita = false } = {}) {
  const db = { linha: linha ? structuredClone(linha) : null, escritas: 0 };
  const colunas = (row, cols) => Object.fromEntries(String(cols || '').split(',').map(c => c.trim()).filter(Boolean).map(c => [c, row[c]]));
  const from = () => {
    let op = null, payload = null, cols = '';
    const filtros = [];
    async function run() {
      const pedeVersao = /versao/.test(cols) || (payload && 'versao' in payload);
      if (!comVersao && pedeVersao) return { data: null, error: { code: '42703', message: 'column app_state.versao does not exist' } };
      const casa = !!db.linha && filtros.every(([k, v]) => db.linha[k] === v);
      if (op === 'select') return { data: casa ? colunas(db.linha, cols) : null, error: null };
      if (!casa || bloquearEscrita) return { data: [], error: null };
      Object.assign(db.linha, structuredClone(payload));
      db.escritas++;
      return { data: [colunas(db.linha, cols)], error: null };
    }
    const q = {
      select(c) { if (!op) op = 'select'; cols = c; return q; },
      update(p) { op = 'update'; payload = p; return q; },
      eq(k, v) { filtros.push([k, v]); return q; },
      maybeSingle: () => run(),
      then: (ok, erro) => run().then(ok, erro),
    };
    return q;
  };
  return { from, db };
}
const linha = (extra = {}) => ({ id: 'main', data: estado({ reservas: [reserva({ id: 'r1' })] }), versao: 7, updated_at: '2026-11-20T15:00:00Z', ...extra });

describe('alterarEstado (servidor)', () => {
  it('lê fresco, aplica e grava com versão + 1', async () => {
    const sb = fakeSupabase({ linha: linha() });
    const r = await alterarEstado((e) => ({ estado: { ...e, reservas: [...e.reservas, reserva({ id: 'r2' })] }, resultado: 'ok' }), { sb });
    expect(r.gravado).toBe(true);
    expect(sb.db.linha.versao).toBe(8);
    expect(sb.db.linha.data.reservas.map(x => x.id)).toEqual(['r1', 'r2']);
  });
  it('se outra pessoa gravou entretanto, relê e reaplica (nada se perde)', async () => {
    const sb = fakeSupabase({ linha: linha() });
    let chamadas = 0;
    const r = await alterarEstado((e) => {
      chamadas++;
      if (chamadas === 1) { // outra gravação acontece "ao mesmo tempo"
        sb.db.linha.data = { ...sb.db.linha.data, reservas: [...sb.db.linha.data.reservas, reserva({ id: 'do-painel' })] };
        sb.db.linha.versao = 8;
      }
      return { estado: { ...e, reservas: [...e.reservas, reserva({ id: 'do-site' })] } };
    }, { sb });
    expect(r.gravado).toBe(true);
    expect(chamadas).toBe(2);
    expect(sb.db.linha.data.reservas.map(x => x.id)).toEqual(['r1', 'do-painel', 'do-site']);
    expect(sb.db.linha.versao).toBe(9);
  });
  it('bloqueia uma alteração que apagaria muitas reservas de uma vez', async () => {
    const muitas = Array.from({ length: 100 }, (_, i) => reserva({ id: 'x' + i }));
    const sb = fakeSupabase({ linha: linha({ data: estado({ reservas: muitas }) }) });
    await expect(alterarEstado((e) => ({ estado: { ...e, reservas: [] } }), { sb })).rejects.toMatchObject({ codigo: 'reducao_suspeita' });
    expect(sb.db.escritas).toBe(0);
    await alterarEstado((e) => ({ estado: { ...e, reservas: [] } }), { sb, permitirReducao: true });
    expect(sb.db.linha.data.reservas).toEqual([]);
  });
  it('estado: null = nada para gravar', async () => {
    const sb = fakeSupabase({ linha: linha() });
    const r = await alterarEstado(() => ({ estado: null, resultado: 'nada' }), { sb });
    expect(r).toMatchObject({ gravado: false, resultado: 'nada' });
    expect(sb.db.escritas).toBe(0);
  });
  it('linha vazia ou sem acesso: erro, nunca grava dados de exemplo', async () => {
    const sb = fakeSupabase({ linha: null });
    let chamou = false;
    await expect(alterarEstado(() => { chamou = true; return { estado: estado() }; }, { sb })).rejects.toMatchObject({ codigo: 'estado_vazio_ou_sem_acesso' });
    expect(chamou).toBe(false);
    expect(sb.db.escritas).toBe(0);
  });
  it('sem a coluna versao (SQL ainda não aplicado): continua a funcionar', async () => {
    const sb = fakeSupabase({ linha: linha(), comVersao: false });
    const lido = await lerEstado(sb);
    expect(lido.versao).toBeNull();
    const r = await alterarEstado((e) => ({ estado: { ...e, reservas: [...e.reservas, reserva({ id: 'r3' })] } }), { sb });
    expect(r.gravado).toBe(true);
    expect(sb.db.linha.data.reservas).toHaveLength(2);
  });
  it('0 linhas alteradas sem erro (regras do banco) nunca conta como gravado', async () => {
    const sb = fakeSupabase({ linha: linha(), comVersao: false, bloquearEscrita: true });
    await expect(alterarEstado((e) => ({ estado: { ...e } }), { sb })).rejects.toBeInstanceOf(ErroServidor);
    await expect(alterarEstado((e) => ({ estado: { ...e } }), { sb })).rejects.toMatchObject({ codigo: 'sem_permissao' });
  });
});

describe('guarda contra apagões', () => {
  it('apagar muitas provisórias vencidas (arrumação) não é bloqueado', async () => {
    const { reducaoSuspeita } = await import('../server/estado.js');
    const agora = Date.parse('2026-11-22T12:00:00Z');
    const reais = Array.from({ length: 100 }, (_, i) => reserva({ id: 'r' + i }));
    const vencidas = Array.from({ length: 60 }, (_, i) => reserva({ id: 'v' + i, status: 'pendente', origem: 'Site', expiraEm: '2026-11-20T10:00:00Z' }));
    expect(reducaoSuspeita({ reservas: [...reais, ...vencidas] }, { reservas: reais }, agora)).toBe(false);
    expect(reducaoSuspeita({ reservas: [...reais, ...vencidas] }, { reservas: reais.slice(0, 50) }, agora)).toBe(true);
  });
});
