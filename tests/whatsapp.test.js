import { describe, it, expect } from 'vitest';
import { whatsappUrl, msgGeral, msgApartamento, msgErroReserva, msgReserva, msgPedidoMinimo, msgCombinacao } from '../src/lib/whatsapp';
import { WHATSAPP_URL } from '../src/lib/constants';

const texto = (url) => new URL(url).searchParams.get('text');

describe('links de WhatsApp com mensagem', () => {
  it('mantém o número e os outros parâmetros, só preenche o texto', () => {
    const url = whatsappUrl('Olá! Tudo bem?');
    expect(url).toMatch(/^https:\/\/api\.whatsapp\.com\/send\/\?phone=%2B5548984761800&text=/);
    expect(url).toMatch(/&type=phone_number&app_absent=0$/);
    expect(texto(url)).toBe('Olá! Tudo bem?');
  });
  it('sem texto devolve o link original', () => {
    expect(whatsappUrl('')).toBe(WHATSAPP_URL);
  });
  it('aceita o número de um residencial', () => {
    const base = 'https://api.whatsapp.com/send/?phone=%2B5548999990000&text&type=phone_number&app_absent=0';
    expect(whatsappUrl('oi', base)).toBe('https://api.whatsapp.com/send/?phone=%2B5548999990000&text=oi&type=phone_number&app_absent=0');
  });
  it('apartamento sem datas', () => {
    expect(msgApartamento({ aptos: 'Apto 102', residencial: 'Residencial PinheiraMar' }))
      .toBe('Olá! Tenho interesse no Apto 102 (Residencial PinheiraMar). Pode me ajudar?');
  });
  it('apartamento com datas e pessoas', () => {
    expect(msgApartamento({ aptos: ['Apto 102'], residencial: 'Residencial PinheiraMar', ci: '2027-01-10', co: '2027-01-15', hospedes: 4 }))
      .toBe('Olá! Tenho interesse no Apto 102 (Residencial PinheiraMar), de 10/01/2027 a 15/01/2027, para 4 pessoas. Pode me ajudar?');
  });
  it('só uma data não entra na mensagem', () => {
    expect(msgApartamento({ aptos: 'Apto 102', ci: '2027-01-10', hospedes: 1 }))
      .toBe('Olá! Tenho interesse no Apto 102, para 1 pessoa. Pode me ajudar?');
  });
  it('erro ao reservar dois apartamentos', () => {
    expect(msgErroReserva({ aptos: ['Apto 102', 'Apto 103'], ci: '2027-01-10', co: '2027-01-15' }))
      .toBe('Olá! Tentei reservar o Apto 102 + Apto 103, de 10/01/2027 a 15/01/2027 pelo site e não consegui concluir. Pode me ajudar?');
  });
  it('depois da reserva leva o código', () => {
    expect(msgReserva({ codigo: 'PM-ABC123', aptos: ['Apto 102'], ci: '2027-01-10', co: '2027-01-15' }))
      .toBe('Olá! Fiz a reserva PM-ABC123 (Apto 102, de 10/01/2027 a 15/01/2027) pelo site.');
    expect(msgReserva({ codigo: 'PM-ABC123', aptos: ['Apto 102'], ci: '2027-01-10', co: '2027-01-15', falhou: true }))
      .toMatch(/PM-ABC123.*pagamento não foi concluído\. Pode me ajudar\?$/);
  });
  it('contato geral', () => {
    expect(msgGeral('Residencial Caminho do Mar')).toBe('Olá! Vim pelo site e gostaria de informações sobre o Residencial Caminho do Mar.');
    expect(msgGeral()).toBe('Olá! Vim pelo site e gostaria de informações.');
  });
});

describe('msgPedidoMinimo (reserva abaixo do mínimo de noites)', () => {
  it('leva apartamento, datas, noites, pessoas, valor e o mínimo', () => {
    expect(msgPedidoMinimo({ aptos: ['Apto 102'], ci: '2026-12-28', co: '2026-12-30', noites: 2, hospedes: 2, total: 'R$ 1.315,00', minimo: 3 }))
      .toBe('Olá! Gostaria de reservar o Apto 102 de 28/12/2026 a 30/12/2026 (2 noites), para 2 pessoas, no valor de R$ 1.315,00. Vi no site que o mínimo nestas datas é de 3 noites — é possível aprovar esta reserva?');
  });
  it('dois apartamentos e uma noite, sem pessoas nem valor', () => {
    expect(msgPedidoMinimo({ aptos: ['Apto 01', 'Apto 03'], ci: '2026-12-24', co: '2026-12-25', noites: 1, minimo: 2 }))
      .toBe('Olá! Gostaria de reservar o Apto 01 + Apto 03 de 24/12/2026 a 25/12/2026 (1 noite). Vi no site que o mínimo nestas datas é de 2 noites — é possível aprovar esta reserva?');
  });
});

describe('msgCombinacao (dois apartamentos cobrem as datas)', () => {
  it('com o valor total das duas partes', () => {
    expect(msgCombinacao({ partes: [{ apto: 'Apto 102', ci: '2026-12-20', co: '2026-12-23' }, { apto: 'Apto 101', ci: '2026-12-23', co: '2026-12-26' }], hospedes: 2, total: 'R$ 3.100,00' }))
      .toBe('Olá! Vi no site uma combinação para as minhas datas: Apto 102 de 20/12/2026 a 23/12/2026 e Apto 101 de 23/12/2026 a 26/12/2026, para 2 pessoas, no valor total de R$ 3.100,00. É possível reservar assim?');
  });
  it('leva cada parte com as datas e as pessoas', () => {
    expect(msgCombinacao({ partes: [{ apto: 'Apto 211', ci: '2026-12-20', co: '2026-12-22' }, { apto: 'Apto 212', ci: '2026-12-22', co: '2026-12-26' }], hospedes: 2 }))
      .toBe('Olá! Vi no site uma combinação para as minhas datas: Apto 211 de 20/12/2026 a 22/12/2026 e Apto 212 de 22/12/2026 a 26/12/2026, para 2 pessoas. É possível reservar assim?');
  });
});
