import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { estado } from './fixtures.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
let lerEstadoImpl;
vi.mock('../server/estado.js', () => ({ lerEstado: () => lerEstadoImpl() }));

const resp = () => {
  const r = { headers: {}, code: null, body: null, loc: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.send = (b) => { r.body = b; return r; };
  r.redirect = (c, l) => { r.code = c; r.loc = l; return r; };
  r.end = () => r;
  return r;
};
const req = (apto) => ({ method: 'GET', query: { apto }, headers: { host: 'www.pinheiramar.com.br' } });

describe('api/previa', () => {
  let handler;
  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn(async () => ({ ok: true, text: async () => html }));
    lerEstadoImpl = async () => ({ data: estado() });
    handler = (await import('../api/previa.js')).default;
  });
  afterEach(() => vi.restoreAllMocks());

  it('apartamento válido: HTML com a prévia dele e cache curto', async () => {
    const r = resp(); await handler(req('a2'), r);
    expect(r.code).toBe(200);
    expect(r.body).toContain('<title>Apto a2 · Residencial Teste</title>');
    expect(r.headers['Content-Type']).toContain('text/html');
    expect(r.headers['Cache-Control']).toContain('s-maxage=600');
  });
  it('id inexistente: devolve o index.html genérico, sem erro', async () => {
    const r = resp(); await handler(req('nao-existe'), r);
    expect(r.code).toBe(200);
    expect(r.body).toBe(html);
  });
  it('banco indisponível: prévia genérica, o link abre', async () => {
    lerEstadoImpl = async () => { throw new Error('sem banco'); };
    const r = resp(); await handler(req('a1'), r);
    expect(r.code).toBe(200);
    expect(r.body).toBe(html);
  });
  it('index.html indisponível: redireciona para /index.html?apto=… (sem laço)', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 }));
    const r = resp(); await handler(req('a1'), r);
    expect(r.code).toBe(302);
    expect(r.loc).toBe('/index.html?apto=a1');
  });
});
