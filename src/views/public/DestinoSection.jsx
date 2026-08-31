import React, { useState } from 'react';
import { MapPin, Sun, Waves, Phone } from 'lucide-react';
import { C, F } from '../../lib/constants';

export function DestinoSection({ residencial }) {
  const [tab, setTab] = useState('destino');
  const endereco = residencial?.endereco || 'Rua Dom Patrício, 82 — Praia da Pinheira';
  const cidade = residencial?.cidade || 'Palhoça - Santa Catarina, Brasil';
  const cep = residencial?.cep || '';
  const telefone = residencial?.telefone || '';
  const enderecoCompleto = `${endereco}, ${cidade}`;

  const TABS_DEST = [
    { id: 'destino',   label: '🌊 A Pinheira' },
    { id: 'atrativos', label: '🗺️ Atrativos' },
    { id: 'chegar',    label: '🚗 Como chegar' },
  ];

  const ATRATIVOS = [
    {
      nome: 'Pontão da Pinheira',
      desc: 'Conjunto de rochas entre a praia e o costão — local de beleza exuberante com piscinas naturais formadas pelas marés. Ideal para banhos de mar, pesca artesanal e contemplar o pôr do sol.',
      destaque: false,
    },
    {
      nome: 'Praia de Baixo',
      desc: 'Praia de enseada com 7 km de extensão, de águas calmas e límpidas. Perfeita para famílias, caminhadas, esportes aquáticos e náuticos. A pesca artesanal é um dos principais atrativos, com peixes frescos todos os dias.',
      destaque: true,
    },
    {
      nome: 'Pedra do Urubu',
      desc: 'Uma das vistas mais belas de Santa Catarina. Do alto avista-se a enseada da Pinheira, a Praia do Sonho, a Ponta dos Papagaios e a foz do Rio da Madre. Vale cada passo da subida.',
      destaque: false,
    },
    {
      nome: 'Praia de Cima',
      desc: 'Praia de águas limpas e conhecida pela beleza exuberante. Possui posto de salvavidas, bares, lojas, restaurantes e muita agitação para os veranistas.',
      destaque: false,
    },
    {
      nome: 'Prainha',
      desc: 'Praia deserta com ondas impressionantes para surfistas. Também conhecida como "Gaúcha Pelada" — águas agitadas, mas cristalinas e selvagens.',
      destaque: false,
    },
    {
      nome: 'Guarda do Embaú',
      desc: 'A 2 km da Pinheira, situada na foz do Rio da Madre com mar aberto e vista para a Ilha do Coral. Famosa em todo o Brasil por surfistas, artistas e modelos — um lugar de paz, beleza e curtição.',
      destaque: true,
    },
    {
      nome: 'Praia do Maço',
      desc: 'Praia deserta de águas limpas e ondas fortes. Acessada por três trilhas que começam no pé do morro da Pinheira e terminam na Praia de Cima. Para quem busca natureza selvagem e tranquilidade total.',
      destaque: false,
    },
    {
      nome: 'Parque Serra do Tabuleiro',
      desc: 'Com guias treinados, é possível fazer trilhas onde se avistam animais nativos e flora da região. Um dos maiores parques do Brasil em área contínua de preservação.',
      destaque: false,
    },
  ];

  return (
    <section style={{ background: '#fff', borderTop: '1px solid #eee' }}>

      {/* hero banner */}
      <div style={{ position: 'relative', height: 340, overflow: 'hidden', background: `linear-gradient(160deg,#0A3742 0%,#2E7E8C 60%,#5AAFBC 100%)` }}>
        {/* decorative wave overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#fff', textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .8, marginBottom: 14 }}>Praia da Pinheira · Palhoça · Santa Catarina</div>
          <h2 style={{ fontFamily: F.disp, fontSize: 'clamp(32px,5vw,54px)', fontWeight: 600, margin: '0 0 16px', lineHeight: 1.1, maxWidth: 700 }}>
            Conheça a Pinheira e seus Encantos
          </h2>
          <p style={{ fontSize: 16, opacity: .88, maxWidth: 580, lineHeight: 1.6, margin: 0 }}>
            Uma das praias mais frequentadas da região de Florianópolis — 35 km do centro, tradição açoriana, piscinas naturais e o melhor do litoral catarinense.
          </p>
        </div>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, width: '100%', height: 80 }}>
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#fff" />
        </svg>
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px 64px' }}>

        {/* tab nav */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #eee', marginBottom: 36, marginTop: -8, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS_DEST.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '14px 22px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? C.ocean : '#717171', borderBottom: tab === t.id ? `3px solid ${C.ocean}` : '3px solid transparent', marginBottom: -2, whiteSpace: 'nowrap', transition: 'color .15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── tab: A Pinheira ── */}
        {tab === 'destino' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 56, alignItems: 'start' }}>
            <div>
              <h3 style={{ fontFamily: F.disp, fontSize: 32, lineHeight: 1.15, margin: '0 0 16px', color: C.ink }}>
                Viva o Melhor da Vida
              </h3>
              <div style={{ width: 48, height: 3, background: C.coral, borderRadius: 2, marginBottom: 20 }} />
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, margin: '0 0 18px' }}>
                A Praia da Pinheira é uma das praias mais frequentadas da grande Florianópolis, recebendo visitantes de todos os estados do Brasil e estrangeiros.
              </p>
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, margin: '0 0 18px' }}>
                Localizada numa enseada a 35 km do centro do município e a 48 km de Florianópolis, é dividida em duas praias: Praia de Baixo e Praia de Cima, situadas em oposição uma a outra.
              </p>
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, margin: 0 }}>
                Hoje a Pinheira não é só um povoado de pescadores de tradição açoriana — o desenvolvimento chegou, mas a paz da convivência entre visitantes e nativos permanece, e os ranchos dos pescadores ainda caracterizam a praia.
              </p>
            </div>
            <div>
              <h4 style={{ fontFamily: F.disp, fontSize: 20, margin: '0 0 14px', color: C.ink }}>A origem do nome</h4>
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, margin: '0 0 20px' }}>
                Conta-se que havia uma enseada coberta por árvores de madeira leve e resistente, muito usada para fabricar boias para as redes dos pescadores. O fruto desta árvore parecia-se com uma pinha — e dai as árvores serem chamadas de <i>pinheira</i>. Como esta linda praia não tinha nome, os nativos chamaram-na de Pinheira.
              </p>
              <h4 style={{ fontFamily: F.disp, fontSize: 20, margin: '0 0 14px', color: C.ink }}>Por que escolher a Pinheira?</h4>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  ['🌊', 'Praia de baixo agitação e excelente para famílias'],
                  ['🐟', 'Pesca artesanal e gastronomia fresca todos os dias'],
                  ['🌅', 'Pôr do sol deslumbrante sobre o Pontão e as rochas'],
                  ['🏄', 'Praias vizinhas para todos os perfis — surf, mergulho, trilhas'],
                  ['🛡️', 'Comunidade acolhedora e ambiente seguro para crianças'],
                  ['🏖️', 'A 2 km da mundialmente famosa Guarda do Embaú'],
                ].map(([ic, txt], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: '#f8fafa', borderRadius: 10 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{ic}</span>
                    <span style={{ fontSize: 14, color: '#333', lineHeight: 1.5 }}>{txt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── tab: Atrativos ── */}
        {tab === 'atrativos' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40, alignItems: 'start' }}>
              <div>
                <h3 style={{ fontFamily: F.disp, fontSize: 28, margin: '0 0 8px', color: C.ink }}>Atrativos e Passeios</h3>
                <p style={{ fontSize: 15, color: '#717171', margin: '0 0 24px', lineHeight: 1.6 }}>
                  A Enseada da Pinheira oferece uma variedade impressionante de experiências — da praia deserta para surfistas ao passeio de barco para famílias, tudo a poucos minutos do Residencial.
                </p>
                {/* map image placeholder */}
                <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.line}`, height: 240 }}>
                  <iframe title="mapa-pinheira"
                    src="https://maps.google.com/maps?q=Praia+da+Pinheira,+Palhoça,+SC&output=embed&zoom=13"
                    width="100%" height="240" style={{ border: 0, display: 'block' }}
                    loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
                <p style={{ fontSize: 12.5, color: '#999', marginTop: 8 }}>📍 Enseada da Pinheira — Palhoça, Santa Catarina</p>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                {ATRATIVOS.filter(a => a.destaque).map((a, i) => (
                  <div key={i} style={{ padding: '18px 20px', background: `linear-gradient(135deg,${C.espuma},#fff)`, border: `1px solid ${C.line}`, borderRadius: 14, borderLeft: `4px solid ${C.coral}` }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: C.ink }}>{a.nome} ⭐</div>
                    <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>{a.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 18 }}>
              {ATRATIVOS.filter(a => !a.destaque).map((a, i) => (
                <div key={i} style={{ padding: '16px 18px', background: '#fafafa', border: '1px solid #eee', borderRadius: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: C.ocean }}>{a.nome}</div>
                  <div style={{ fontSize: 13.5, color: '#555', lineHeight: 1.6 }}>{a.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── tab: Como chegar ── */}
        {tab === 'chegar' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 48, alignItems: 'start' }}>
            <div>
              <h3 style={{ fontFamily: F.disp, fontSize: 28, margin: '0 0 22px', color: C.ink }}>Como chegar à Pinheira</h3>
              <div style={{ display: 'grid', gap: 18 }}>
                {[
                  { ic: '✈️', titulo: 'De avião', texto: 'Aeroporto Internacional Hercílio Luz (Florianópolis) — 48 km do Residencial. Aluguer de carro recomendado ou transfer privado.' },
                  { ic: '🚗', titulo: 'De carro', texto: `BR-101 Sul → SC-282 em direcção a Palhoça → seguir para Praia da Pinheira. GPS: "${residencial?.nome || 'Residencial PinheiraMar'}, Praia da Pinheira". Estacionamento gratuito (1 vaga por apartamento).` },
                  { ic: '🚌', titulo: 'De ônibus', texto: 'Terminal Rodoviário de Florianópolis → linha para Palhoça → van/mototáxi para a Pinheira. Tempo total aprox. 1h30.' },
                  { ic: '📍', titulo: 'Distâncias úteis', texto: 'Centro de Florianópolis: 35 km · Palhoça (centro): 22 km · Guarda do Embaú: 2 km · Garopaba: 28 km · Imbituba: 45 km.' },
                ].map((it, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, padding: '16px 18px', background: '#f8f8f8', borderRadius: 14 }}>
                    <span style={{ fontSize: 28, flexShrink: 0 }}>{it.ic}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 5, color: C.ink }}>{it.titulo}</div>
                      <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>{it.texto}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.line}`, marginBottom: 16 }}>
                <iframe title="mapa-como-chegar"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(enderecoCompleto)}&output=embed&zoom=14`}
                  width="100%" height="380" style={{ border: 0, display: 'block' }}
                  loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
              <div style={{ padding: '16px 18px', background: C.espuma, borderRadius: 12, fontSize: 14, color: C.ink, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>📍 Endereço completo</div>
                {endereco}<br />
                {cidade}{cep ? ` · CEP ${cep}` : ''}<br />
                {telefone && <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={14} color={C.ocean} /> {telefone}</div>}
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}


/* ═══════════════════════════ AptDetailPage ═══════════════════════════ */
