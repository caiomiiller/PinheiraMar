import React from 'react';
import { useIdioma } from '../lib/i18n';

// Selo discreto (na cor da marca) para taxas no detalhe do preço. Antes era
// "OBR"/"OPC" em verde — abreviações que o hóspede não percebia.
export function SeloTaxa({ tipo }) {
  const { tr } = useIdioma();
  const obrig = tipo === 'obrigatoria';
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, letterSpacing: '.02em', borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap',
      border: `1px solid ${obrig ? 'rgba(27,28,70,.35)' : 'rgba(111,107,100,.45)'}`, color: obrig ? '#1B1C46' : '#6F6B64', background: '#fff',
    }}>
      {obrig ? tr('taxa_obrigatoria') : tr('taxa_opcional')}
    </span>
  );
}
