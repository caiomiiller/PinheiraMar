import { describe, it, expect } from 'vitest';
import { secoesPrivacidade } from '../src/lib/privacidade.js';

describe('política de privacidade', () => {
  const secs = secoesPrivacidade({ email: 'contato@exemplo.com', telefone: '48 90000-0000' });
  const tudo = secs.map(s => `${s.titulo} ${s.texto}`).join('\n');
  it('tem as partes que a LGPD pede, com ids únicos', () => {
    expect(new Set(secs.map(s => s.id)).size).toBe(secs.length);
    for (const id of ['quem', 'dados', 'uso', 'compartilhamento', 'prazo', 'direitos', 'seguranca']) {
      expect(secs.some(s => s.id === id)).toBe(true);
    }
    expect(tudo).toContain('art. 18');
  });
  it('cita o contato para exercer os direitos e os fornecedores que tratam os dados', () => {
    expect(tudo).toContain('contato@exemplo.com · 48 90000-0000');
    for (const f of ['Mercado Pago', 'Supabase', 'Vercel', 'EmailJS']) expect(tudo).toContain(f);
  });
  it('sem contato cadastrado, aponta para o WhatsApp do rodapé (nunca "undefined")', () => {
    const t = secoesPrivacidade().map(s => s.texto).join(' ');
    expect(t).not.toContain('undefined');
    expect(t).toContain('WhatsApp');
  });
});
