import { describe, it, expect } from 'vitest';
import { whatsappUrl, msgGeral, msgApartamento, msgErroReserva, msgReserva } from '../src/lib/whatsapp';
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
