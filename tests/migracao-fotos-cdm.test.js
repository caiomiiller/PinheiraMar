import { describe, it, expect } from 'vitest';
import { migrarDados, DATA_VERSION } from '../src/lib/migracoes.js';

const cdm = (id, nome, fotos) => ({ id, nome, residencialId: 'novoimovel', fotos, foto: fotos[0] || '' });
const base = (apartamentos, versaoDados = 6) => ({ versaoDados, reservas: [{ id: 'r1', status: 'confirmado', valorPago: 10, checkIn: '2026-12-01', checkOut: '2026-12-03' }], apartamentos });

describe('migração v7 — fotos novas do Caminho do Mar', () => {
  it('troca as fotos antigas pelas 10 novas (por id e, no Apto 06, pelo nome)', () => {
    const d = base([
      cdm('n01', 'Apto 01', ['/fotos/n01/6.jpg', '/fotos/n01/1.jpg']),
      cdm('azxei18g', 'Apto 06', ['/fotos/n05/9.jpg', '/fotos/n05/1.jpg']),
    ]);
    const { data } = migrarDados(d);
    expect(data.versaoDados).toBe(DATA_VERSION);
    const [a1, a6] = data.apartamentos;
    expect(a1.fotos).toHaveLength(10);
    expect(a1.fotos[0]).toBe('/fotos/cdm01/1.jpg');
    expect(a1.foto).toBe('/fotos/cdm01/1.jpg');
    expect(a6.fotos[9]).toBe('/fotos/cdm06/10.jpg');
  });
  it('não mexe em fotos mudadas à mão, nem no PinheiraMar, nem nas reservas', () => {
    const manual = cdm('n02', 'Apto 02', ['https://exemplo.supabase.co/x.jpg']);
    const pm = { id: 'a101', nome: 'Apto 101', residencialId: 'pinheiramar', fotos: ['/fotos/a101/5.jpg'], foto: '/fotos/a101/5.jpg' };
    const d = base([manual, pm]);
    const { data } = migrarDados(d);
    expect(data.apartamentos[0]).toEqual(manual);
    expect(data.apartamentos[1]).toEqual(pm);
    expect(data.reservas).toEqual(d.reservas);
  });
  it('corre uma vez só: dados já na v7 ficam iguais', () => {
    const d = base([cdm('n03', 'Apto 03', ['/fotos/n03/1.jpg'])], 7);
    expect(migrarDados(d).data).toBe(d);
  });
});
