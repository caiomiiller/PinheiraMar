import React, { useState } from 'react';
import { Check, X, ChevronLeft, ChevronRight, Waves, MapPin, GripVertical,
  AlertCircle, BedDouble, Wifi, Car, Minus, Plus, Info, LogIn, LogOut } from 'lucide-react';
import { C, F } from '../lib/constants';

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${C.line}`, background: C.white, color: C.ink, fontSize: '14px', outline: 'none', fontFamily: F.sans };

export const TextInput = (p) => <input {...p} className="pmf" style={{ ...inputStyle, ...(p.style || {}) }} />;
export const DateInput = (p) => <input type="date" {...p} className="pmf" style={{ ...inputStyle, ...(p.style || {}) }} />;
export const NumberInput = (p) => <input type="number" {...p} className="pmf" style={{ ...inputStyle, ...(p.style || {}) }} />;
export const Select = ({ children, ...p }) => <select {...p} className="pmf" style={{ ...inputStyle, appearance: 'auto', ...(p.style || {}) }}>{children}</select>;
export const Textarea = (p) => <textarea {...p} className="pmf" style={{ ...inputStyle, minHeight: 70, resize: 'vertical', ...(p.style || {}) }} />;

export function Btn({ variant = 'primary', size = 'md', children, style, icon: Icon, ...p }) {
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: F.sans, fontWeight: 600, borderRadius: '10px', cursor: 'pointer', border: '1px solid transparent', transition: 'all .15s ease', whiteSpace: 'nowrap' };
  const sizes = { sm: { padding: '7px 12px', fontSize: 13 }, md: { padding: '10px 16px', fontSize: 14 }, lg: { padding: '13px 22px', fontSize: 15 } };
  const variants = {
    primary: { background: C.ocean, color: '#fff' },
    accent: { background: C.coral, color: '#fff' },
    ghost: { background: 'transparent', color: C.ocean, border: `1px solid ${C.line}` },
    soft: { background: C.areiaSoft, color: C.ink, border: `1px solid ${C.areia}` },
    danger: { background: 'transparent', color: '#B23B3B', border: '1px solid #E7C4C4' },
  };
  return (
    <button {...p} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.94)'; }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
      {Icon && <Icon size={size === 'sm' ? 15 : 17} />}{children}
    </button>
  );
}

export function Modal({ title, subtitle, onClose, onBack, headerActions, children, footer, wide, progress }) {
  return (
    <div onClick={onClose} className="pm-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(10,40,46,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 14px', zIndex: 100, overflowY: 'auto', backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} className="pm-pop pm-modal-card" style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: wide ? 760 : 520, boxShadow: '0 24px 70px rgba(10,40,46,.35)', overflow: 'hidden', marginTop: 12 }}>
        <div className="pm-modal-header" style={{ padding: '18px 22px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
            {onBack && (
              <button onClick={onBack} title="Voltar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ink, padding: '2px 0 0', flexShrink: 0, display: 'flex' }}>
                <ChevronLeft size={22} />
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontFamily: F.disp, fontSize: 22, color: C.ink, margin: 0, lineHeight: 1.1 }}>{title}</h3>
              {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: C.inkSoft }}>{subtitle}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {headerActions}
            <button onClick={onClose} style={{ background: C.espuma, border: 'none', borderRadius: 9, width: 34, height: 34, cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.inkSoft, flexShrink: 0 }}><X size={18} /></button>
          </div>
        </div>
        <div className="pm-modal-body" style={{ padding: '20px 22px' }}>{children}</div>
        {progress && (
          <div className="pm-modal-progress" style={{ display: 'flex', gap: 6, padding: '0 22px 14px', flexShrink: 0 }}>
            {Array.from({ length: progress.total }).map((_, i) => (
              <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < progress.step ? C.ink : C.line, transition: 'background .2s' }} />
            ))}
          </div>
        )}
        {footer && <div className="pm-modal-footer" style={{ padding: '16px 22px', borderTop: `1px solid ${C.line}`, background: C.espuma, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

export const Field = ({ label, children, hint, required }) => (
  <label style={{ display: 'block' }}>
    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.inkSoft, marginBottom: 6, letterSpacing: '.01em' }}>
      {label}{required && <span style={{ color: C.coral }}> *</span>}
    </span>
    {children}
    {hint && <span style={{ display: 'block', fontSize: 12, color: C.inkSoft, marginTop: 5 }}>{hint}</span>}
  </label>
);

// Modelo de 5 estados (a pedido do Caio, 2026-09-16): a cor representa só o
// pagamento/disponibilidade, nunca o check-in físico — isso agora é
// registado à parte pelos checkboxes "Check-in realizado"/"Check-out
// realizado" (ver CheckinBadge/CheckoutBadge abaixo e Reservations.jsx).
//   pendente   (cinza)          — nenhum pagamento registado ainda
//   reservado  (amarelo)        — sinal de 50% confirmado (automático via
//                                 Mercado Pago, ou marcado manualmente para
//                                 reservas por telefone/WhatsApp)
//   confirmado (verde)          — pagamento dos 100% confirmado
//   bloqueio   (cinza riscado)  — período bloqueado, não disponível
//   cancelada  (vermelho)       — reserva cancelada, período liberto
export const STATUS = {
  pendente: { label: 'Pendente', bg: '#EDEFEF', fg: '#5C6B6A', bar: '#AEB8B7' },
  reservado: { label: 'Reservado', bg: '#FBEFD9', fg: '#9A6A14', bar: '#E0A23A' },
  confirmado: { label: 'Confirmado', bg: '#E1F0EC', fg: '#1C7A5B', bar: '#2E9E78' },
  bloqueio: { label: 'Bloqueio', bg: '#E9ECEC', fg: '#5C6B6A', bar: '#8A9896', hatch: true },
  cancelada: { label: 'Cancelada', bg: '#F3E3E3', fg: '#A24C4C', bar: '#C98B8B' },
  // pseudo-estado, só para cor/etiqueta (ver displayStatus abaixo) — nunca é
  // uma opção do seletor "Estado" nem entra na legenda do calendário.
  checkout: { label: 'Check-out', bg: '#F3E3E3', fg: '#A24C4C', bar: '#C98B8B' },
};

// Estado "efetivo" para pintar uma reserva concreta (barra do calendário,
// Badge, cartões): a pedido do Caio, a reserva só fica vermelha de
// check-out quando JÁ está Confirmado (100% pago) E o check-out foi
// marcado — nos outros estados (Pendente/Reservado) o checkbox de
// check-out não muda a cor, continua a mostrar o status de pagamento.
// Usar sempre displayStatus(r), nunca r.status diretamente, em qualquer
// sítio que pinte a reserva. STATUS[r.status] continua a ser o que se
// lê/grava no formulário.
export const displayStatus = (r) => (r.status === 'confirmado' && r.checkoutRealizado ? 'checkout' : r.status);

export const Badge = ({ status }) => {
  const s = STATUS[status] || STATUS.pendente;
  return <span style={{ background: s.bg, color: s.fg, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>{s.label}</span>;
};

// Fundo da barra no calendário/legenda: bloqueio ganha um risco diagonal
// ("riscos", a pedido do Caio) para se distinguir à primeira vista mesmo
// sendo também acinzentado — os outros estados usam a cor sólida normal.
export const barBackground = (status) => {
  const s = STATUS[status] || STATUS.pendente;
  return s.hatch
    ? `repeating-linear-gradient(45deg, ${s.bar} 0px, ${s.bar} 6px, ${s.bg} 6px, ${s.bg} 12px)`
    : s.bar;
};

// Etiquetas de check-in/check-out realizados — independentes do status (que
// agora representa só o pagamento): marcam se o hóspede já chegou/saiu de
// facto. Ver Reservations.jsx (checkboxes) e Dashboard.jsx.
export const CheckinBadge = ({ compact }) => (
  <span title="Check-in já realizado"
    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: compact ? 10 : 10.5, fontWeight: 700, color: '#065F46', background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 999, padding: compact ? '1px 5px' : '2px 8px', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
    <LogIn size={compact ? 10 : 11} />{!compact && ' Check-in'}
  </span>
);
export const CheckoutBadge = ({ compact }) => (
  <span title="Check-out já realizado"
    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: compact ? 10 : 10.5, fontWeight: 700, color: '#8A2E2E', background: '#FBE3E3', border: '1px solid #EFB3B3', borderRadius: 999, padding: compact ? '1px 5px' : '2px 8px', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
    <LogOut size={compact ? 10 : 11} />{!compact && ' Check-out'}
  </span>
);

export function PhotoTile({ apt, h = 184, radius = 14 }) {
  if (apt.foto) {
    // Usa <img> em vez de background-image: os browsers aplicam um
    // reamostragem de maior qualidade a <img> ao reduzir fotos grandes
    // para miniaturas pequenas — com background-image ficavam com um ar
    // "esborratado"/pixelado nos cartões pequenos, apesar de as mesmas
    // fotos abrirem nítidas em tamanho grande (galeria/lightbox).
    return <div style={{ height: h, borderRadius: radius, overflow: 'hidden', position: 'relative' }}>
      <img src={apt.foto} alt={apt.nome || ''} loading="lazy" decoding="async"
        style={{ width: '100%', height: '100%', display: 'block' }} />
      <span style={tilePill}>{apt.vista}</span>
    </div>;
  }
  let seed = 0; for (const ch of (apt.id || apt.nome || 'x')) seed = (seed * 31 + ch.charCodeAt(0)) % 360;
  const sky = `hsl(${198 + seed % 16}, 64%, 87%)`;
  const sea1 = `hsl(${189 + seed % 18}, 50%, 53%)`;
  const sea2 = `hsl(${196 + seed % 14}, 58%, 37%)`;
  return (
    <div style={{ position: 'relative', height: h, borderRadius: radius, overflow: 'hidden', background: `linear-gradient(180deg, ${sky} 0%, ${sea1} 56%, ${sea2} 100%)` }}>
      <div style={{ position: 'absolute', top: 16, right: 18, width: 32, height: 32, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #FFF4D8, #F9CE74)', boxShadow: '0 0 22px rgba(249,206,116,.75)' }} />
      <svg viewBox="0 0 400 130" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '48%' }}>
        <path d="M0,42 C60,12 120,72 200,46 C280,20 340,76 400,46 L400,130 L0,130 Z" fill="rgba(255,255,255,.22)" />
        <path d="M0,72 C70,46 140,96 210,72 C290,48 350,92 400,70 L400,130 L0,130 Z" fill="#ECDCB9" />
      </svg>
      <span style={tilePill}>{apt.vista}</span>
    </div>
  );
}
export const tilePill = { position: 'absolute', left: 12, top: 12, background: 'rgba(14,74,88,.78)', color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999, backdropFilter: 'blur(3px)' };

/* ═══════════════════════════ PUBLIC BOOKING SITE ═══════════════════════════ */
/* ═══════════════════════════ i18n ═══════════════════════════ */
export const PageHead = ({ title, sub, action }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
    <div>
      <h1 style={{ fontFamily: F.disp, fontSize: 30, margin: 0, color: C.ink }}>{title}</h1>
      {sub && <p style={{ margin: '4px 0 0', color: C.inkSoft, fontSize: 14 }}>{sub}</p>}
    </div>
    {action}
  </div>
);
export const Card = ({ children, style, ...rest }) => <div {...rest} style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.line}`, ...style }}>{children}</div>;

// Diálogo de confirmação genérico — usado antes de qualquer eliminação
// permanente (apartamento, taxa, idioma, meio de pagamento, temporada...),
// para evitar que um toque acidental na lixeira apague algo sem querer.
export function ConfirmDialog({ title = 'Confirmar exclusão', message, confirmLabel = 'Eliminar', onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}
      footer={<>
        <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
        <Btn variant="danger" icon={undefined} onClick={onConfirm} style={{ background: '#B23B3B', color: '#fff', border: '1px solid #B23B3B' }}>{confirmLabel}</Btn>
      </>}>
      <p style={{ fontSize: 14, color: C.ink, lineHeight: 1.55, margin: 0 }}>{message}</p>
    </Modal>
  );
}

// Reordenação por arrastar-e-soltar para qualquer lista de gestão.
export const Row = ({ k, v, strong, accent }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
    <span style={{ color: C.inkSoft }}>{k}</span>
    <span style={{ fontWeight: strong || accent ? 700 : 500, color: accent ? C.coralDeep : C.ink, textAlign: 'right' }}>{v}</span>
  </div>
);

/* ═══════════════════════════ ADMIN — GESTÃO ═══════════════════════════ */
export function duplicateInList(list, id, makeCopy) {
  const idx = list.findIndex(x => x.id === id);
  if (idx < 0) return list;
  const copy = makeCopy(list[idx]);
  const a = [...list]; a.splice(idx + 1, 0, copy); return a;
}
export const DragGrip = (props) => <span {...props}><GripVertical size={18} /></span>;

/* ── Dashboard ── */
export function Stepper({ value, set, min = 0, max = 99, disabled }) {
  const btn = { width: 36, height: 40, border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.ocean };
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden', opacity: disabled ? 0.5 : 1, background: '#fff' }}>
      <button type="button" disabled={disabled || value <= min} onClick={() => set(Math.max(min, value - 1))} style={{ ...btn, borderRight: `1px solid ${C.line}` }}><Minus size={15} /></button>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 600, minWidth: 44 }}>{value}</div>
      <button type="button" disabled={disabled || value >= max} onClick={() => set(Math.min(max, value + 1))} style={{ ...btn, borderLeft: `1px solid ${C.line}` }}><Plus size={15} /></button>
    </div>
  );
}
export const MoneyInput = ({ value, onChange, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 8px', background: '#fff', ...style }}>
    <span style={{ fontSize: 12, color: C.inkSoft }}>R$</span>
    <input className="pmf" type="number" step="1" value={value} onChange={onChange}
      style={{ width: '100%', border: 'none', outline: 'none', padding: '7px 0', fontSize: 13, fontFamily: F.sans, background: 'transparent', color: C.ink }} />
  </div>
);

export const Note = ({ children, color, bg }) => <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: bg, color, padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{children}</div>;

/* ── Apartments ── */
