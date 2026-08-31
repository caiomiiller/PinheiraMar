import React, { useState } from 'react';
import { CreditCard, Check, X, ExternalLink, Star, Copy, Trash2, Database } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { uid } from '../../lib/helpers';
import { Card, PageHead, Btn, DragGrip, duplicateInList } from '../../components/ui';
import { useReorder } from '../../hooks/useReorder';
import { iconBtn } from './Reservations';

export function PaymentsView({ data, update }) {
  const toggle = (id) => update(prev => ({ ...prev, pagamentos: prev.pagamentos.map(p => p.id === id ? { ...p, conectado: !p.conectado } : p) }));
  const remove = (id) => update(prev => ({ ...prev, pagamentos: prev.pagamentos.filter(p => p.id !== id) }));
  const duplicate = (id) => update(prev => ({ ...prev, pagamentos: duplicateInList(prev.pagamentos, id, p => ({ ...p, id: 'pay' + uid(), nome: p.nome + ' (cópia)', conectado: false })) }));
  const dnd = useReorder(data.pagamentos, (arr) => update(prev => ({ ...prev, pagamentos: arr })));

  const RECOMENDADO = ['mercadopago', 'pix'];

  return (
    <div>
      <PageHead title="Pagamentos" sub="Configure como os hóspedes pagam o sinal e o saldo da reserva · arraste para reordenar." />

      {/* recommendation banner */}
      <div style={{ background: 'linear-gradient(135deg,#E8F4FD,#EEF6FF)', border: '1px solid #BDD9F8', borderRadius: 14, padding: '16px 20px', marginBottom: 22, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1A56DB', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Star size={18} color="#fff" fill="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1A3A6B', marginBottom: 4 }}>Recomendação para o {data.settings.nome}</div>
          <div style={{ fontSize: 13.5, color: '#1e3a5f', lineHeight: 1.6 }}>
            <b>Mercado Pago + Pix</b> é a combinação mais vantajosa para aluguel de temporada no Brasil. O Pix cobre o sinal de 50% (taxa zero, confirmação imediata) e o Mercado Pago oferece parcelamento em até 12x sem juros para o hóspede — aumentando a conversão em alta temporada. O saldo de 50% no check-in fica com <b>Pagamento presencial</b> (maquininha ou Pix directo).
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {data.pagamentos.map((p, idx) => (
          <Card key={p.id} {...dnd.zone(idx)} style={{ padding: '16px 18px', ...dnd.deco(idx) }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <DragGrip {...dnd.grip(idx)} style={{ marginTop: 4 }} />

              {/* colour badge */}
              <div style={{ width: 44, height: 44, borderRadius: 11, background: p.cor, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '-.02em' }}>{p.nome.slice(0, 2).toUpperCase()}</span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>{p.nome}</span>
                  {RECOMENDADO.includes(p.id) && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#FFF3CD', color: '#7B5600', border: '1px solid #F5C542', borderRadius: 999, padding: '2px 8px' }}>★ Recomendado</span>
                  )}
                  {p.conectado && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7', borderRadius: 999, padding: '2px 8px' }}>● Activo</span>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: p.cor, marginBottom: 6 }}>{p.taxa}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '3px 16px' }}>
                  {p.desc.map((d, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: C.inkSoft, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                      <span style={{ color: C.brisa, flexShrink: 0, marginTop: 1 }}>✓</span> {d}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                <Btn variant={p.conectado ? 'accent' : 'soft'} size="sm" icon={p.conectado ? Check : undefined} onClick={() => toggle(p.id)}>
                  {p.conectado ? 'Activo' : 'Activar'}
                </Btn>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: C.brisa, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Abrir site ↗
                  </a>
                )}
                <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                  <button onClick={() => duplicate(p.id)} title="Duplicar" style={iconBtn}><Copy size={14} /></button>
                  <button onClick={() => remove(p.id)} title="Eliminar" style={{ ...iconBtn, color: '#B23B3B' }}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* integration guide */}
      <Card style={{ padding: 22, marginTop: 18 }}>
        <h3 style={{ fontFamily: F.disp, fontSize: 18, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={17} color={C.brisa} /> Guia de integração
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {[
            { step: '1', title: 'Crie uma conta Business', desc: 'Abra uma conta no Mercado Pago em mercadopago.com.br. Use CNPJ para ter acesso à API completa e melhores taxas.', cor: C.brisa },
            { step: '2', title: 'Obtenha o Access Token', desc: 'Em "Credenciais" no painel Mercado Pago, copie o Access Token de produção. Este código liga o motor de reservas à sua conta.', cor: C.ocean },
            { step: '3', title: 'Configure o webhook', desc: 'Registe o URL do seu servidor para receber confirmações automáticas de pagamento e actualizar o estado da reserva em tempo real.', cor: C.coral },
            { step: '4', title: 'Fluxo no motor de reservas', desc: 'Reserva criada → Mercado Pago gera link de pagamento (50%) → Hóspede paga → Webhook confirma → Reserva muda para "Confirmada".', cor: '#7C3AED' },
          ].map(s => (
            <div key={s.step} style={{ padding: '14px 16px', background: C.espuma, borderRadius: 12, borderLeft: `4px solid ${s.cor}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: s.cor, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{s.step}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{s.title}</div>
              </div>
              <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '12px 14px', background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 10, fontSize: 13, color: '#7B5600', lineHeight: 1.55 }}>
          <b>Nota:</b> A integração automática de pagamentos requer um servidor backend (Node.js / PHP) com acesso à internet para receber os webhooks do gateway. O motor actual funciona em modo offline — para produção em <b>{data.settings.site || 'produção'}</b> será necessário configurar o servidor e as credenciais da API.
        </div>
      </Card>

      {/* pricing summary */}
      <Card style={{ padding: 20, marginTop: 14 }}>
        <h3 style={{ fontFamily: F.disp, fontSize: 17, margin: '0 0 12px' }}>Configuração de sinal</h3>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 14 }}>
          <div><div style={{ color: C.inkSoft, fontSize: 12.5 }}>Moeda</div><div style={{ fontWeight: 700, fontSize: 16 }}>{data.settings.moeda}</div></div>
          <div><div style={{ color: C.inkSoft, fontSize: 12.5 }}>Sinal antecipado</div><div style={{ fontWeight: 700, fontSize: 16, color: C.coralDeep }}>{data.settings.sinalPct}% do total</div></div>
          <div><div style={{ color: C.inkSoft, fontSize: 12.5 }}>Saldo restante</div><div style={{ fontWeight: 700, fontSize: 16 }}>{100 - data.settings.sinalPct}% no check-in</div></div>
          <div><div style={{ color: C.inkSoft, fontSize: 12.5 }}>Gateways activos</div><div style={{ fontWeight: 700, fontSize: 16 }}>{data.pagamentos.filter(p => p.conectado).length} de {data.pagamentos.length}</div></div>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 12.5, color: C.inkSoft }}>Altere a percentagem do sinal em <b>Configurações → Sinal exigido</b>.</p>
      </Card>
    </div>
  );
}

/* ═══════════════════════════ APP SHELL ═══════════════════════════ */
/* ───────────────────────── Auth gate ───────────────────────── */
