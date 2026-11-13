import { describe, it, expect } from 'vitest';
import { STATUS, displayStatus } from '../src/components/ui.jsx';
import { reservaToRow } from '../src/lib/csvUtils.js';

const base = { codigo: 'X1', hospede: 'Ana Teste', apartamentoId: 'a1', checkIn: '2027-01-10', checkOut: '2027-01-12', total: 900, precoTabela: 900 };

describe('estado cortesia', () => {
  it('existe como estado com etiqueta própria', () => {
    expect(STATUS.cortesia.label).toBe('Cortesia');
    expect(displayStatus({ ...base, status: 'cortesia', checkOut: '2099-01-01' })).toBe('cortesia');
  });
  it('exportação: cortesia não leva valor, as outras mantêm', () => {
    const apts = [{ id: 'a1', nome: 'Apto 1' }];
    const c = reservaToRow({ ...base, status: 'cortesia' }, apts);
    expect(c['Revenue']).toBe(0);
    expect(c['Subtotal']).toBe(0);
    expect(reservaToRow({ ...base, status: 'confirmado' }, apts)['Revenue']).toBe(900);
  });
});
