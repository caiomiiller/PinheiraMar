import { describe, it, expect } from 'vitest';
import middleware, { destinoPrevia, ehRoboDePrevia, config } from '../middleware.js';

const WA = 'WhatsApp/2.23.20.0 A';
const FB = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('middleware da prévia (?apto=)', () => {
  it('só corre na raiz do site', () => {
    expect(config.matcher).toBe('/');
  });

  it('reconhece os robôs de prévia e não os navegadores', () => {
    expect(ehRoboDePrevia(WA)).toBe(true);
    expect(ehRoboDePrevia(FB)).toBe(true);
    expect(ehRoboDePrevia('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(ehRoboDePrevia(CHROME)).toBe(false);
    expect(ehRoboDePrevia('')).toBe(false);
    expect(ehRoboDePrevia(undefined)).toBe(false);
  });

  it('manda o robô para /api/previa com o mesmo apartamento', () => {
    expect(destinoPrevia('https://www.pinheiramar.com.br/?apto=a207', WA))
      .toBe('https://www.pinheiramar.com.br/api/previa?apto=a207');
  });

  it('visitante normal, sem ?apto= ou fora da raiz: segue normal', () => {
    expect(destinoPrevia('https://www.pinheiramar.com.br/?apto=a207', CHROME)).toBeNull();
    expect(destinoPrevia('https://www.pinheiramar.com.br/', WA)).toBeNull();
    expect(destinoPrevia('https://www.pinheiramar.com.br/?apto=', WA)).toBeNull();
    expect(destinoPrevia('https://www.pinheiramar.com.br/index.html?apto=a207', WA)).toBeNull();
    expect(destinoPrevia('lixo', WA)).toBeNull();
  });

  it('não deixa o ?apto= mudar o host nem crescer sem limite', () => {
    const d = new URL(destinoPrevia('https://www.pinheiramar.com.br/?apto=' + 'x'.repeat(200) + '&outro=1', WA));
    expect(d.host).toBe('www.pinheiramar.com.br');
    expect(d.pathname).toBe('/api/previa');
    expect(d.searchParams.get('apto')).toHaveLength(40);
    expect(d.searchParams.has('outro')).toBe(false);
  });

  it('responde com a reescrita para robôs e nada para pessoas', () => {
    const pedido = (ua) => new Request('https://www.pinheiramar.com.br/?apto=a207', { headers: { 'user-agent': ua } });
    const r = middleware(pedido(WA));
    expect(r.headers.get('x-middleware-rewrite')).toBe('https://www.pinheiramar.com.br/api/previa?apto=a207');
    expect(middleware(pedido(CHROME))).toBeUndefined();
  });
});
