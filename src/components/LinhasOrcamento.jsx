import React from 'react';
import { money } from '../lib/helpers';
import { useIdioma } from '../lib/i18n';
import { SeloTaxa } from './SeloTaxa';

// Detalhe do preço de UM apartamento: as noites agrupadas por preço
// ("R$ 285 × 3 noites" + "R$ 330 × 2 noites") e as taxas — a soma das linhas
// é sempre exatamente o total. Antes mostrava a média arredondada × noites
// (ex.: "R$ 302 × 5 = R$ 1.511", que não fecha a conta).
export function LinhasOrcamento({ o, titulo }) {
  const { tr } = useIdioma();
  if (!o) return null;
  const linha = { display: 'flex', justifyContent: 'space-between', gap: 10 };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {titulo && <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#555', marginTop: 4 }}>{titulo}</div>}
      {o.grupos.map((g, i) => (
        <div key={'g' + i} style={linha}>
          <span>{money(g.rate)} × {tr('noites', g.n)}{o.grupos.length > 1 && g.fimSemana ? ` (${tr('fim_de_semana')})` : ''}</span>
          <span>{money(g.subtotal)}</span>
        </div>
      ))}
      {[...o.obrigatorios, ...o.opcionais].map((e, i) => (
        <div key={'e' + i} style={linha}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <SeloTaxa tipo={e.tipo} />{e.nome}{e.qtd > 1 ? ` × ${e.qtd}` : ''}
          </span>
          <span>{money(e.subtotal)}</span>
        </div>
      ))}
    </div>
  );
}
