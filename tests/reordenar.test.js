import { describe, it, expect, vi } from 'vitest';
vi.mock('react', () => ({ useState: () => [null, () => {}] }));
vi.mock('../src/lib/constants', () => ({ C: {} }));
const { reordenarPorIds, moverPorId } = await import('../src/hooks/useReorder.js');

describe('reordenar sem perder alterações de outros', () => {
  it('aplica a nova ordem à lista atual (item novo fica no fim, apagado não volta)', () => {
    const atual = [{ id: 'a', v: 2 }, { id: 'c', v: 1 }, { id: 'n', v: 1 }]; // 'b' foi apagado, 'n' é novo, 'a' mudou
    const ordenada = [{ id: 'c' }, { id: 'b' }, { id: 'a', v: 1 }];
    expect(reordenarPorIds(atual, ordenada)).toEqual([{ id: 'c', v: 1 }, { id: 'a', v: 2 }, { id: 'n', v: 1 }]);
  });
  it('moverPorId move um item para a posição de outro', () => {
    const l = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(moverPorId(l, 3, 1).map(x => x.id)).toEqual([3, 1, 2]);
    expect(moverPorId(l, 9, 1)).toBe(l);
  });
});
