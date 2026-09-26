import React, { useState } from 'react';
import { MapPin, Waves, Map, Car, Plane, Bus, Fish, Sunset, ShieldCheck, Umbrella, Star, MessageCircle, Navigation } from 'lucide-react';
import { C, F, WHATSAPP_URL } from '../../lib/constants';
import { Faixa, BRAND } from '../../components/Brand';
import { useIdioma } from '../../lib/i18n';

// "Conheça a Pinheira" — textos no idioma escolhido e ícones de linha da
// marca (antes eram emojis e a paleta antiga, verde-água).
const ATRATIVOS = [
  { id: 'pontao', destaque: false },
  { id: 'baixo', destaque: true },
  { id: 'urubu', destaque: false },
  { id: 'cima', destaque: false },
  { id: 'prainha', destaque: false },
  { id: 'guarda', destaque: true },
  { id: 'maco', destaque: false },
  { id: 'tabuleiro', destaque: false },
];

const icone = { size: 22, strokeWidth: 1.5, color: BRAND.marinho };

export function DestinoSection({ residenciais = [], lang, setLang, idiomasAtivos = [] }) {
  const { tr } = useIdioma();
  const [tab, setTab] = useState('destino');

  const TABS_DEST = [
    { id: 'destino', Icon: Waves, label: tr('ds_tab_pinheira') },
    { id: 'atrativos', Icon: Map, label: tr('ds_tab_atrativos') },
    { id: 'chegar', Icon: Car, label: tr('ds_tab_chegar') },
  ];
  const motivos = [
    [Waves, 'ds_motivo_1'], [Fish, 'ds_motivo_2'], [Sunset, 'ds_motivo_3'],
    [Umbrella, 'ds_motivo_4'], [ShieldCheck, 'ds_motivo_5'], [MapPin, 'ds_motivo_6'],
  ];
  const comoChegar = [
    { Icon: Plane, titulo: tr('ds_aviao'), texto: tr('ds_aviao_txt') },
    { Icon: Car, titulo: tr('ds_carro'), texto: tr('ds_carro_txt') },
    { Icon: Bus, titulo: tr('ds_onibus'), texto: tr('ds_onibus_txt') },
    { Icon: MapPin, titulo: tr('ds_distancias'), texto: tr('ds_distancias_txt') },
  ];
  const h3 = { fontSize: 28, fontWeight: 300, lineHeight: 1.2, margin: '0 0 10px', color: C.ink };
  const par = { fontSize: 16, color: '#4A4843', lineHeight: 1.75, margin: '0 0 18px' };

  return (
    <section style={{ background: '#fff', borderTop: '1px solid #eee' }}>
      {/* faixa de abertura em marinho */}
      <div style={{ background: `linear-gradient(160deg, ${BRAND.noite} 0%, ${BRAND.marinho} 70%)`, color: '#fff', textAlign: 'center', padding: '64px 24px 56px' }}>
        {/* idioma — barra de bandeiras (voltou a ser assim, não um menu),
            centralizada junto a este bloco, a pedido do Caio (2026-09-26) —
            antes ficava no cabeçalho, disputando espaço com os filtros. */}
        {idiomasAtivos.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 22 }}>
            {idiomasAtivos.map(id => (
              <button key={id.codigo} onClick={() => setLang(id.codigo)} title={id.nativo} aria-label={id.nativo} aria-pressed={lang === id.codigo}
                style={{ width: 40, height: 40, borderRadius: '50%', border: lang === id.codigo ? '1px solid rgba(255,255,255,.7)' : '1px solid transparent', background: lang === id.codigo ? 'rgba(255,255,255,.12)' : 'transparent', cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center' }}>
                {id.bandeira}
              </button>
            ))}
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 400, letterSpacing: '.22em', textTransform: 'uppercase', opacity: .8, marginBottom: 14 }}>{tr('ps_hero_local')}</div>
        <h2 style={{ fontFamily: F.disp, fontSize: 'clamp(30px,4.6vw,48px)', fontWeight: 200, margin: '0 auto 16px', lineHeight: 1.12, maxWidth: 720 }}>{tr('ds_titulo')}</h2>
        <Faixa height={4} width={180} tone="negativo" style={{ margin: '0 auto 20px' }} />
        <p style={{ fontSize: 16.5, opacity: .9, maxWidth: 600, lineHeight: 1.65, margin: '0 auto' }}>{tr('ds_sub')}</p>
      </div>

      <div className="pm-destino-wrap" style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px 64px' }}>
        <div role="tablist" style={{ display: 'flex', gap: 0, borderBottom: '2px solid #eee', marginBottom: 36, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS_DEST.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 52, padding: '0 22px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? C.ink : '#5f5f5f', borderBottom: tab === t.id ? `3px solid ${BRAND.marinho}` : '3px solid transparent', marginBottom: -2, whiteSpace: 'nowrap', fontFamily: F.sans }}>
              <t.Icon size={18} strokeWidth={1.5} /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'destino' && (
          <div className="pm-destino-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 56, alignItems: 'start' }}>
            <div>
              <h3 style={h3}>{tr('ds_viva')}</h3>
              <Faixa height={2} width={44} style={{ marginBottom: 20 }} />
              <p style={par}>{tr('ds_p1')}</p>
              <p style={par}>{tr('ds_p2')}</p>
              <p style={{ ...par, margin: 0 }}>{tr('ds_p3')}</p>
            </div>
            <div>
              <h4 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 12px', color: C.ink }}>{tr('ds_origem')}</h4>
              <p style={{ ...par, margin: '0 0 24px' }}>{tr('ds_origem_txt')}</p>
              <h4 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 14px', color: C.ink }}>{tr('ds_por_que')}</h4>
              <div style={{ display: 'grid', gap: 10 }}>
                {motivos.map(([Icon, chave], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: '#f7f7f5', borderRadius: 10 }}>
                    <Icon {...icone} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 15.5, color: '#333', lineHeight: 1.5 }}>{tr(chave)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'atrativos' && (
          <div>
            <div className="pm-destino-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40, alignItems: 'start' }}>
              <div>
                <h3 style={h3}>{tr('ds_atrativos_titulo')}</h3>
                <Faixa height={2} width={44} style={{ marginBottom: 16 }} />
                <p style={{ ...par, color: '#5f5f5f' }}>{tr('ds_atrativos_sub')}</p>
                <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.line}`, height: 240 }}>
                  <iframe title={tr('ds_mapa_enseada')}
                    src="https://maps.google.com/maps?q=Praia+da+Pinheira,+Palhoça,+SC&output=embed&zoom=13"
                    width="100%" height="240" style={{ border: 0, display: 'block' }}
                    loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
                <p style={{ fontSize: 14, color: '#5f5f5f', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={15} strokeWidth={1.5} /> {tr('ds_enseada')}</p>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                {ATRATIVOS.filter(a => a.destaque).map(a => (
                  <div key={a.id} style={{ padding: '18px 20px', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, borderLeft: `4px solid ${BRAND.marinho}` }}>
                    <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 6, color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {tr('ds_at_' + a.id)} <Star size={16} strokeWidth={1.5} color={BRAND.vermelho} aria-label={tr('ds_destaque')} />
                    </div>
                    <div style={{ fontSize: 15.5, color: '#4A4843', lineHeight: 1.6 }}>{tr('ds_at_' + a.id + '_txt')}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pm-destino-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 18 }}>
              {ATRATIVOS.filter(a => !a.destaque).map(a => (
                <div key={a.id} style={{ padding: '16px 18px', background: '#fafaf8', border: '1px solid #eee', borderRadius: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, color: C.ink }}>{tr('ds_at_' + a.id)}</div>
                  <div style={{ fontSize: 15, color: '#4A4843', lineHeight: 1.6 }}>{tr('ds_at_' + a.id + '_txt')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'chegar' && (
          <div className="pm-destino-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 48, alignItems: 'start' }}>
            <div>
              <h3 style={h3}>{tr('ds_chegar_titulo')}</h3>
              <Faixa height={2} width={44} style={{ marginBottom: 22 }} />
              <div style={{ display: 'grid', gap: 16 }}>
                {comoChegar.map((it, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, padding: '16px 18px', background: '#f7f7f5', borderRadius: 14 }}>
                    <it.Icon size={26} strokeWidth={1.5} color={BRAND.marinho} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 5, color: C.ink }}>{it.titulo}</div>
                      <div style={{ fontSize: 15, color: '#4A4843', lineHeight: 1.6 }}>{it.texto}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.line}`, marginBottom: 16 }}>
                <iframe title={tr('ds_mapa_enseada')}
                  src="https://maps.google.com/maps?q=Praia+da+Pinheira,+Palhoça,+SC&output=embed&zoom=14"
                  width="100%" height="380" style={{ border: 0, display: 'block' }}
                  loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
              {/* os dois residenciais, cada um com o seu endereço e o botão de rota */}
              <div style={{ display: 'grid', gap: 12 }}>
                {residenciais.map(r => {
                  const completo = [r.endereco, r.cidade].filter(Boolean).join(', ');
                  return (
                    <div key={r.id} style={{ padding: '16px 18px', background: C.espuma, borderRadius: 12, fontSize: 15.5, color: C.ink, lineHeight: 1.65 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={16} strokeWidth={1.5} /> {r.nome}</div>
                      {r.endereco}<br />{r.cidade}{r.cep ? ` · CEP ${r.cep}` : ''}
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(completo)}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, color: BRAND.marinho, fontWeight: 700, textDecoration: 'none' }}>
                          <Navigation size={16} strokeWidth={1.5} /> {tr('ds_rota')}
                        </a>
                        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, color: BRAND.marinho, fontWeight: 700, textDecoration: 'none' }}>
                          <MessageCircle size={16} strokeWidth={1.5} /> WhatsApp
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
