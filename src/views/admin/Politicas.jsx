import React, { useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { Card, PageHead, Btn } from '../../components/ui';
import { PolicyBlock } from '../../components/PolicyBlock';

export const POLITICAS_SEED = {
  reservas: {
    titulo: 'Termos e Políticas de Hospedagem',
    texto: `IMPORTANTE

• Por questões de segurança e privacidade dos demais hóspedes, visitas e convidados só serão permitidos mediante autorização prévia. As dependências do residencial — incluindo áreas internas e apartamentos — são de uso exclusivo dos hóspedes registados.

• Mínimo de 2 (duas) diárias em períodos regulares. Em feriados e datas festivas, o mínimo varia conforme o pacote — consulte nossos canais de atendimento.

• O Residencial oferece apartamentos mobiliados para locação de temporada. Não estão incluídos: café da manhã, roupas de cama/mesa/banho, itens de higiene pessoal nem utensílios de praia.

CHECK-IN: 13h00 | CHECK-OUT: 10h00

---

1. PAGAMENTO

• Para pagamento via cartão de crédito ou Pix/transferência bancária: 50% do valor total antecipado para confirmar a reserva; os 50% restantes + taxas devem ser pagos no check-in.
• Tarifas Promocionais: pagamento de 100% no acto da reserva. Não reembolsável.
• A confirmação da reserva é efectuada somente após a recepção do sinal de 50%.

---

2. HOSPEDAGEM

• Lei do silêncio: das 22h às 7h (excepto Réveillon e Carnaval).
• O acesso aos apartamentos é restrito exclusivamente aos hóspedes registados.
• A chave é retirada no check-in e devolvida no check-out. Perda da chave ou controle de portão: R$ 50,00.
• Danos ou extravios do patrimônio do residencial serão cobrados pelo valor de reposição.
• É proibido pendurar roupas em áreas comuns.

---

3. POLÍTICA DE PETS

• Aceitos cães e gatos com mais de 6 meses e até 10 kg (máximo 2 pets por apartamento).
• Taxa única de R$ 150,00 por pet.
• O proprietário é responsável pela limpeza, silêncio e uso de tapete higiênico dentro do apartamento.

---

4. ESTACIONAMENTO

• Cada apartamento tem direito a 1 vaga de garagem.
• Vaga adicional: taxa única de R$ 50,00 por automóvel (sujeito a disponibilidade).

---

5. LOCAÇÕES DISPONÍVEIS

Jogo de lençol R$ 28,00 · Manta R$ 30,00 · Toalha (banho + rosto) R$ 13,00 · Rede R$ 15,00 · Cooler R$ 25,00 · Cadeira de praia R$ 10,00/dia.`,
  },
  cancelamento: {
    titulo: 'Política de Cancelamento',
    texto: `Solicitações de cancelamento são aceitas exclusivamente por ligação ou WhatsApp: (48) 98476-1800, pelo titular da reserva.

PRAZOS E CONDIÇÕES

• Mais de 31 dias de antecedência do check-in:
  Emissão de Voucher no valor já antecipado, válido para nova reserva.

• Entre 16 e 30 dias de antecedência do check-in:
  Cobrança de 50% do valor total da estadia. Sem reembolso do restante.

• Menos de 15 dias de antecedência do check-in:
  Cobrança de 100% do valor total da estadia. Sem reembolso.

• No-show (não comparecimento sem aviso prévio):
  Cobrança de 100% do valor total da hospedagem. Sem reembolso.

• Cancelamentos ou alterações após o check-in:
  Cobrança de 100% do valor total da hospedagem. Sem reembolso.

• Tarifas Promocionais:
  Não reembolsáveis em nenhuma situação.

NOTA: A contagem de dias é feita em relação à data de check-in, em dias corridos.`,
  },
};


export function PoliticasView({ data, update }) {
  // Merge saved data on top of seed — so text always appears even when storage has an older version
  const merge = (key) => ({
    titulo: data.settings.politicas?.[key]?.titulo || POLITICAS_SEED[key].titulo,
    texto: data.settings.politicas?.[key]?.texto || POLITICAS_SEED[key].texto,
  });

  const [reservas, setReservas] = useState(() => merge('reservas'));
  const [cancelamento, setCancelamento] = useState(() => merge('cancelamento'));
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    update(prev => ({ ...prev, settings: { ...prev.settings, politicas: { reservas, cancelamento } } }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  };

  return (
    <div>
      <PageHead
        title="Políticas"
        sub="Defina os termos que os hóspedes aceitam ao fazer uma reserva."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" onClick={() => {
              setReservas(merge('reservas'));
              setCancelamento(merge('cancelamento'));
              setSaved(false);
            }}>Cancelar</Btn>
            <Btn variant="primary" icon={saved ? Check : undefined} onClick={onSave}>
              {saved ? 'Guardado ✓' : 'Salvar'}
            </Btn>
          </div>
        }
      />

      <PolicyBlock
        label="Política de Reservas"
        hint="Será solicitado que seus hóspedes aceitem estes termos no checkout."
        titleValue={reservas.titulo}
        onTitleChange={v => { setReservas(p => ({ ...p, titulo: v })); setSaved(false); }}
        value={reservas.texto}
        onChange={v => { setReservas(p => ({ ...p, texto: v })); setSaved(false); }}
      />

      <PolicyBlock
        label="Política de Cancelamento"
        hint="Apresentada ao hóspede durante a reserva e no e-mail de confirmação."
        titleValue={cancelamento.titulo}
        onTitleChange={v => { setCancelamento(p => ({ ...p, titulo: v })); setSaved(false); }}
        value={cancelamento.texto}
        onChange={v => { setCancelamento(p => ({ ...p, texto: v })); setSaved(false); }}
      />

      {/* Preview card */}
      <Card style={{ padding: 22, marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: 0 }}>Pré-visualização</h3>
          <span style={{ fontSize: 12.5, color: C.inkSoft }}>Como ficará visível para o hóspede no site</span>
        </div>
        {[
          { pol: reservas, accent: C.ocean },
          { pol: cancelamento, accent: C.coralDeep },
        ].map(({ pol, accent }) => (
          <div key={pol.titulo} style={{ marginBottom: 22, padding: '18px 20px', background: C.espuma, borderRadius: 12, border: `1px solid ${C.line}` }}>
            <div style={{ fontFamily: F.disp, fontSize: 17, color: accent, marginBottom: 12 }}>{pol.titulo}</div>
            <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.72, whiteSpace: 'pre-wrap' }}>
              {pol.texto.split('\n').map((line, idx) => {
                if (line.trim().startsWith('•') || line.trim().startsWith('*') || line.trim().startsWith('-')) {
                  return <div key={idx} style={{ paddingLeft: 14, position: 'relative' }}><span style={{ position: 'absolute', left: 0 }}>•</span>{line.replace(/^[\s•*\-→]+/, '')}</div>;
                }
                if (line.trim() === '---') return <hr key={idx} style={{ border: 'none', borderTop: `1px solid ${C.line}`, margin: '10px 0' }} />;
                if (!line.trim()) return <div key={idx} style={{ height: 8 }} />;
                return <div key={idx}>{line}</div>;
              })}
            </div>
          </div>
        ))}
      </Card>

      {/* reminder */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px', background: '#EEF6FF', border: '1px solid #BDD9F8', borderRadius: 12, marginTop: 16, fontSize: 13.5, color: '#1A4A7A' }}>
        <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>As políticas são apresentadas ao hóspede na página de reserva do site e podem ser incluídas no e-mail de confirmação. Clique em <b>Salvar</b> para que as alterações entrem em vigor.</span>
      </div>
    </div>
  );
}

