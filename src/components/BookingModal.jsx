import React, { useState } from 'react';
import { ChevronDown, Minus, Plus, PawPrint, Umbrella, SquareParking, Sparkles, Users, Home, AlertCircle, MessageCircle } from 'lucide-react';
import { C } from '../lib/constants';
import { money } from '../lib/helpers';
import { orcamentoReserva } from '../lib/precos';
import { validarHospede } from '../lib/reservas';
import { guardarUltimaReserva } from '../lib/dadosPublico';
import { useIdioma } from '../lib/i18n';
import { WHATSAPP_URL } from '../lib/constants';
import { Btn, Modal, Field, TextInput, PhotoTile } from './ui';
import { LinhasOrcamento } from './LinhasOrcamento';

// Ícone de linha (Lucide) para cada serviço extra, pelo nome — antes eram emojis.
function IconeExtra({ nome }) {
  const s = String(nome || '').toLowerCase();
  const p = { size: 24, strokeWidth: 1.5, color: C.ocean };
  if (s.includes('pet') || s.includes('animal')) return <PawPrint {...p} />;
  if (s.includes('praia') || s.includes('cadeira') || s.includes('guarda')) return <Umbrella {...p} />;
  if (s.includes('estacion') || s.includes('vaga') || s.includes('garagem')) return <SquareParking {...p} />;
  return <Sparkles {...p} />;
}

// Botão −/+ de 44 px (alvo de toque confortável para o público 50+).
function BotaoContador({ tipo, onClick, disabled, rotulo }) {
  return (
    <button type="button" aria-label={rotulo} onClick={onClick} disabled={disabled}
      style={{ width: 44, height: 44, borderRadius: '50%', border: `1.5px solid ${disabled ? '#ddd' : '#8a8a8a'}`, background: '#fff', color: disabled ? '#bbb' : '#222', cursor: disabled ? 'default' : 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      {tipo === 'menos' ? <Minus size={18} /> : <Plus size={18} />}
    </button>
  );
}

const MENSAGEM_ERRO = {
  indisponivel: 'err_indisponivel', preco_mudou: 'err_preco_mudou', minimo_noites: 'err_minimo_noites', maximo_noites: 'err_maximo_noites',
  capacidade: 'err_capacidade', data_passada: 'err_datas', datas_invalidas: 'err_datas', datas_fechadas: 'err_datas_fechadas',
  estadia_longa: 'err_estadia_longa', apartamento_inexistente: 'err_generico', apartamentos_invalidos: 'err_generico',
  muitas_pendentes: 'err_muitas_pendentes',
};

export function BookingModal({ sel, ci, co, data, onClose, onReservar, onConfirmed }) {
  const { tr, lang, fmtCurta, dado } = useIdioma();
  const { apt, apt2, g1: initG1, g2: initG2 } = sel;
  const hasApt2 = !!apt2;

  const taxasOpc = (data.taxasAdicionais || []).filter(tx => tx.tipo === 'opcional');
  const hasExtras = taxasOpc.length > 0;

  // passos: resumo da estadia → extras (se houver) → dados do hóspede → revisão
  const steps = hasExtras ? ['resumo', 'extras', 'dados', 'revisao'] : ['resumo', 'dados', 'revisao'];
  const [step, setStep] = useState(steps[0]);
  const stepIdx = steps.indexOf(step);
  const goBack = () => { if (stepIdx > 0) setStep(steps[stepIdx - 1]); };
  const goNext = () => { if (stepIdx < steps.length - 1) setStep(steps[stepIdx + 1]); };

  const [extrasQty, setExtrasQty] = useState(() => Object.fromEntries(taxasOpc.map(t => [t.id, 0])));
  const [extrasScope, setExtrasScope] = useState(() => Object.fromEntries(taxasOpc.map(t => [t.id, t.por === 'noite' ? 'per_apt' : 'group'])));

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [tel, setTel] = useState('');
  const [website, setWebsite] = useState(''); // campo-isca: invisível para pessoas, robôs preenchem
  const [erroCampos, setErroCampos] = useState({});
  const [g, setG] = useState(Math.max(1, Math.min(initG1 || 2, apt.capacidade)));
  const [gB, setGB] = useState(Math.max(1, Math.min(initG2 || 1, apt2 ? apt2.capacidade : 8)));

  // O preço mostrado sai da MESMA função que o servidor usa para cobrar.
  const opcionais = taxasOpc.filter(t => (extrasQty[t.id] || 0) > 0)
    .map(t => ({ taxaId: t.id, unidades: extrasQty[t.id], escopo: hasApt2 ? extrasScope[t.id] : 'group' }));
  const orc = orcamentoReserva({
    itens: [{ apt, hospedes: g }, hasApt2 ? { apt: apt2, hospedes: gB } : null].filter(Boolean),
    seasons: data.seasons, taxas: data.taxasAdicionais, checkIn: ci, checkOut: co, opcionais, sinalPct: data.settings.sinalPct,
  });
  const o1 = orc?.partes[0]?.orcamento;
  const o2 = orc?.partes[1]?.orcamento;
  const total = orc?.total || 0;
  const sinal = orc?.sinal || 0;
  const noites = o1?.noites || 0;
  const opcTotal = [o1, o2].filter(Boolean).reduce((s, o) => s + o.opcionais.reduce((a, e) => a + e.subtotal, 0), 0);

  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const cancelPol = data.settings.politicas?.cancelamento;

  const [paying, setPaying] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(null);
  const nomes = hasApt2 ? `${apt.nome} + ${apt2.nome}` : apt.nome;

  const dadosOk = validarHospede({ nome, email, telefone: tel });

  const handleConfirm = async () => {
    if (!dadosOk.ok) { setErroCampos(dadosOk.erros); setStep('dados'); return; }
    if (!orc) return;
    setPaying(true); setErroEnvio(null);
    const pedido = {
      itens: [{ apartamentoId: apt.id, hospedes: g }, ...(hasApt2 ? [{ apartamentoId: apt2.id, hospedes: gB }] : [])],
      checkIn: ci, checkOut: co, opcionais,
      hospede: { nome: nome.trim(), email: email.trim(), telefone: tel.trim() },
      totalEsperado: total, sinalEsperado: sinal, idioma: lang, website,
    };
    const r = await onReservar(pedido);
    if (r.ok) {
      const info = { reservas: r.reservas, total: r.total, sinal: r.sinal, aptos: [apt, apt2].filter(Boolean).map(a => ({ id: a.id, nome: a.nome, vista: a.vista, residencialId: a.residencialId })), sinalPct: data.settings.sinalPct };
      if (r.initPoint) { guardarUltimaReserva(info); window.location.href = r.initPoint; return; }
      setPaying(false);
      onConfirmed(info);
      return;
    }
    setPaying(false);
    if (r.erro === 'dados_hospede') { setErroCampos(r.campos || {}); setStep('dados'); return; }
    setErroEnvio(r);
  };

  const modalNav = { onClose, onBack: stepIdx > 0 ? goBack : undefined, progress: { step: stepIdx + 1, total: steps.length }, wide: true, rotuloVoltar: tr('ap_voltar'), rotuloFechar: tr('ap_fechar') };
  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 0', borderBottom: `1px solid ${C.line}` };

  if (!orc) {
    return (
      <Modal {...modalNav} title={tr('bk_titulo_resumo')} footer={<Btn variant="primary" style={{ width: '100%', minHeight: 52 }} onClick={onClose}>{tr('bk_escolher_datas')}</Btn>}>
        <p style={{ fontSize: 16 }}>{tr('bk_sem_datas')}</p>
      </Modal>
    );
  }

  // ── Passo: resumo da estadia ─────────────────────────────────────────────
  if (step === 'resumo') {
    return (
      <Modal {...modalNav} title={tr('bk_titulo_resumo')} subtitle={nomes}
        footer={<Btn variant="primary" style={{ width: '100%', minHeight: 52, fontSize: 16 }} onClick={goNext}>{tr('bk_continuar')}</Btn>}>
        <div style={{ fontSize: 15.5 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 16, borderBottom: `1px solid ${C.line}` }}>
            <div style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}><PhotoTile apt={apt} h={72} radius={12} /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{nomes}</div>
              <div style={{ fontSize: 15, color: C.inkSoft, marginTop: 2 }}>{dado(apt.piso)} · {dado(apt.vista)}</div>
            </div>
          </div>

          <div style={row}>
            <div>
              <div style={{ fontSize: 15, color: C.inkSoft }}>{tr('bk_datas')}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{fmtCurta(ci)} – {fmtCurta(co)}</div>
              <div style={{ fontSize: 15, color: C.inkSoft }}>{tr('noites', noites)}</div>
            </div>
            <button type="button" onClick={onClose} style={{ minHeight: 44, padding: '0 16px', border: '1px solid #bbb', borderRadius: 999, background: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', color: '#222' }}>{tr('bk_alterar')}</button>
          </div>

          {!hasApt2 ? (
            <div style={row}>
              <div>
                <div style={{ fontSize: 15, color: C.inkSoft }}>{tr('bk_pessoas')}</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{tr('pessoas', g)}</div>
                <div style={{ fontSize: 14, color: C.inkSoft }}>{tr('bk_maximo', apt.capacidade)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <BotaoContador tipo="menos" rotulo={tr('bk_menos_pessoa')} onClick={() => setG(v => Math.max(1, v - 1))} disabled={g <= 1} />
                <b style={{ minWidth: 18, textAlign: 'center', fontSize: 18 }}>{g}</b>
                <BotaoContador tipo="mais" rotulo={tr('bk_mais_pessoa')} onClick={() => setG(v => Math.min(apt.capacidade, v + 1))} disabled={g >= apt.capacidade} />
              </div>
            </div>
          ) : (
            <div style={{ ...row, alignItems: 'flex-start', flexDirection: 'column' }}>
              <div style={{ fontSize: 15, color: C.inkSoft }}>{tr('bk_pessoas_por_apto')}</div>
              {[[apt, g, setG], [apt2, gB, setGB]].map(([a, val, set]) => (
                <div key={a.id} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div><div style={{ fontWeight: 700, fontSize: 16 }}>{a.nome}</div><div style={{ fontSize: 14, color: C.inkSoft }}>{tr('bk_maximo', a.capacidade)}</div></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <BotaoContador tipo="menos" rotulo={tr('bk_menos_pessoa_em', a.nome)} onClick={() => set(v => Math.max(1, v - 1))} disabled={val <= 1} />
                    <b style={{ minWidth: 18, textAlign: 'center', fontSize: 18 }}>{val}</b>
                    <BotaoContador tipo="mais" rotulo={tr('bk_mais_pessoa_em', a.nome)} onClick={() => set(v => Math.min(a.capacidade, v + 1))} disabled={val >= a.capacidade} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: '16px 0', borderBottom: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 15, color: C.inkSoft }}>{hasApt2 ? tr('bk_total_combinado') : tr('bk_total')}</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>{money(total)}</div>
            <div style={{ marginTop: 10, fontSize: 15, color: '#444', display: 'grid', gap: 10 }}>
              <LinhasOrcamento o={o1} titulo={hasApt2 ? apt.nome : null} />
              {o2 && <LinhasOrcamento o={o2} titulo={apt2.nome} />}
            </div>
          </div>

          <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, background: C.espuma, display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 16.5, fontWeight: 700, color: C.coralDeep }}>
              <span>{tr('bk_sinal_para_reservar', data.settings.sinalPct)}</span><span>{money(sinal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 15, color: '#444' }}>
              <span>{tr('bk_restante')}</span><span>{money(total - sinal)}</span>
            </div>
            <div style={{ fontSize: 14, color: C.inkSoft, marginTop: 2 }}>{tr('bk_nada_cobrado')}</div>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Passo: extras opcionais ──────────────────────────────────────────────
  if (step === 'extras') return (
    <Modal {...modalNav} title={tr('bk_titulo_extras')} subtitle={tr('bk_sub_extras')}
      footer={<Btn variant="primary" style={{ width: '100%', minHeight: 52, fontSize: 16 }} onClick={goNext}>{tr('bk_continuar')}</Btn>}>
      <div style={{ display: 'grid', gap: 12 }}>
        {taxasOpc.map(taxa => {
          const qty = extrasQty[taxa.id] || 0;
          return (
            <div key={taxa.id} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 14, alignItems: 'center', background: C.espuma, borderRadius: 12, padding: '14px 16px', border: qty > 0 ? `2px solid ${C.ocean}` : '2px solid transparent' }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: '#fff', display: 'grid', placeItems: 'center' }}><IconeExtra nome={taxa.nome} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{taxa.nome}</div>
                <div style={{ fontSize: 14, color: C.inkSoft, marginTop: 2 }}>{money(taxa.preco)} {tr('bk_por_' + (taxa.por || 'reserva'))}</div>
                {hasApt2 && qty > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {['group', 'per_apt'].map(sc => (
                      <button type="button" key={sc} onClick={() => setExtrasScope(s => ({ ...s, [taxa.id]: sc }))}
                        style={{ minHeight: 36, fontSize: 14, padding: '0 12px', borderRadius: 20, cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${extrasScope[taxa.id] === sc ? C.ocean : '#ccc'}`, background: extrasScope[taxa.id] === sc ? 'rgba(27,28,70,.07)' : '#fff', color: C.ink }}>
                        {sc === 'group' ? <><Users size={15} /> {tr('bk_escopo_grupo')}</> : <><Home size={15} /> {tr('bk_escopo_apto')}</>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BotaoContador tipo="menos" rotulo={tr('bk_menos_extra', taxa.nome)} onClick={() => setExtrasQty(q => ({ ...q, [taxa.id]: Math.max(0, (q[taxa.id] || 0) - 1) }))} disabled={qty <= 0} />
                <b style={{ minWidth: 20, textAlign: 'center', fontSize: 17 }}>{qty}</b>
                <BotaoContador tipo="mais" rotulo={tr('bk_mais_extra', taxa.nome)} onClick={() => setExtrasQty(q => ({ ...q, [taxa.id]: (q[taxa.id] || 0) + 1 }))} />
              </div>
            </div>
          );
        })}
        {opcTotal > 0 && <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 16, color: C.ocean }}>{tr('bk_extras_total')}: {money(opcTotal)}</div>}
      </div>
    </Modal>
  );

  // ── Passo: dados do hóspede ──────────────────────────────────────────────
  if (step === 'dados') {
    const avancar = () => { if (dadosOk.ok) { setErroCampos({}); goNext(); } else setErroCampos(dadosOk.erros); };
    const erroDe = (c) => erroCampos[c] ? <div role="alert" style={{ color: '#B42318', fontSize: 14, marginTop: 5 }}>{tr('bk_erro_' + c)}</div> : null;
    return (
      <Modal {...modalNav} title={tr('bk_titulo_dados')} subtitle={nomes}
        footer={<Btn variant="primary" style={{ width: '100%', minHeight: 52, fontSize: 16 }} onClick={avancar}>{tr('bk_continuar')}</Btn>}>
        <div style={{ display: 'grid', gap: 14 }}>
          <Field label={tr('bk_nome')} required>
            <TextInput value={nome} onChange={e => setNome(e.target.value)} placeholder={tr('bk_nome_ph')} autoComplete="name" />
            {erroDe('nome')}
          </Field>
          <Field label={tr('bk_email')} required>
            <TextInput type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" autoComplete="email" />
            {erroDe('email')}
          </Field>
          <Field label={tr('bk_telefone')} required>
            <TextInput type="tel" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="(48) 99999-9999" autoComplete="tel" />
            {erroDe('telefone')}
          </Field>
          {/* campo-isca anti-robôs (escondido de pessoas e de leitores de tela) */}
          <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={e => setWebsite(e.target.value)} name="website"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
          <p style={{ fontSize: 14, color: C.inkSoft, margin: 0, lineHeight: 1.5 }}>{tr('bk_privacidade')}</p>
        </div>
      </Modal>
    );
  }

  // ── Passo: revisão e confirmação ─────────────────────────────────────────
  const textoErro = erroEnvio ? tr(MENSAGEM_ERRO[erroEnvio.erro] || 'err_generico', erroEnvio) : null;
  return (
    <Modal {...modalNav} title={tr('bk_titulo_revisao')} subtitle={nomes}
      footer={<Btn variant="accent" disabled={paying} style={{ width: '100%', minHeight: 52, fontSize: 16, opacity: paying ? .6 : 1 }} onClick={handleConfirm}>{paying ? tr('bk_processando') : tr('bk_confirmar')}</Btn>}>
      <div style={{ fontSize: 15.5 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 16, borderBottom: `1px solid ${C.line}`, marginBottom: 4 }}>
          <div style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}><PhotoTile apt={apt} h={64} radius={12} /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16.5 }}>{nomes}</div>
            <div style={{ fontSize: 14.5, color: C.inkSoft, marginTop: 2 }}>{dado(apt.piso)} · {dado(apt.vista)}</div>
          </div>
        </div>

        <RevRow label={tr('bk_datas')} value={`${fmtCurta(ci)} – ${fmtCurta(co)} · ${tr('noites', noites)}`} />
        <RevRow label={tr('bk_pessoas')} value={hasApt2 ? `${g} + ${gB} = ${tr('pessoas', g + gB)}` : tr('pessoas', g)} />
        <RevRow label={tr('bk_nome')} value={nome.trim() || '—'} />
        <RevRow label={tr('bk_email')} value={email.trim() || '—'} />
        <RevRow label={tr('bk_telefone')} value={tel.trim() || '—'} />

        <div style={{ padding: '14px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 14.5, color: C.inkSoft, fontWeight: 600 }}>{hasApt2 ? tr('bk_total_combinado') : tr('bk_total')}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{money(total)}</div>
            </div>
            <button type="button" onClick={() => setShowBreakdown(s => !s)} style={linkBtnStyle} aria-expanded={showBreakdown}>
              {showBreakdown ? tr('bk_ocultar') : tr('bk_detalhes')} <ChevronDown size={16} style={{ transform: showBreakdown ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
          </div>
          {showBreakdown && (
            <div style={{ marginTop: 12, fontSize: 15, color: '#444', display: 'grid', gap: 10 }}>
              <LinhasOrcamento o={o1} titulo={hasApt2 ? apt.nome : null} />
              {o2 && <LinhasOrcamento o={o2} titulo={apt2.nome} />}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 0', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15.5, fontWeight: 700, color: C.coralDeep }}>{tr('bk_sinal_agora', data.settings.sinalPct)}</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: C.coralDeep }}>{money(sinal)}</span>
        </div>

        {cancelPol && (
          <div style={{ padding: '14px 0', borderBottom: `1px solid ${C.line}` }}>
            <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 4 }}>{cancelPol.titulo}</div>
            <div style={{ fontSize: 15, color: C.inkSoft, lineHeight: 1.5 }}>
              {tr('bk_cancelamento_resumo')}{' '}
              <button type="button" onClick={() => setShowPolicy(s => !s)} style={linkBtnStyle} aria-expanded={showPolicy}>{showPolicy ? tr('bk_ocultar') : tr('bk_ver_politica')}</button>
            </div>
            {showPolicy && <div style={{ marginTop: 10, fontSize: 14.5, color: '#444', whiteSpace: 'pre-wrap', background: C.espuma, borderRadius: 10, padding: 12, lineHeight: 1.6 }}>{cancelPol.texto}</div>}
          </div>
        )}

        {textoErro && (
          <div role="alert" style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: '#FEF3F2', border: '1px solid #FDA29B', color: '#7A271A', fontSize: 15, lineHeight: 1.5, display: 'grid', gap: 8 }}>
            <span style={{ display: 'flex', gap: 8 }}><AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />{textoErro}</span>
            {erroEnvio.erro === 'indisponivel'
              ? <button type="button" onClick={onClose} style={{ ...linkBtnStyle, fontSize: 15 }}>{tr('bk_escolher_outras_datas')}</button>
              : <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{ ...linkBtnStyle, fontSize: 15, textDecoration: 'none' }}><MessageCircle size={16} /> {tr('bk_falar_whatsapp')}</a>}
          </div>
        )}

        {hasApt2 && <p style={{ fontSize: 14, color: C.inkSoft, marginTop: 12, marginBottom: 0, background: C.espuma, borderRadius: 8, padding: '8px 10px' }}>{tr('bk_duas_reservas')}</p>}
        <p style={{ fontSize: 14, color: C.inkSoft, marginTop: 10, marginBottom: 0 }}>{tr('bk_sinal_confirma')}</p>
      </div>
    </Modal>
  );
}

function RevRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${C.line}` }}>
      <span style={{ fontSize: 15, color: C.inkSoft }}>{label}</span>
      <span style={{ fontSize: 15.5, fontWeight: 700, textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );
}

export const readBox = { padding: '10px 12px', borderRadius: 10, background: C.areiaSoft, border: `1px solid ${C.areia}`, fontSize: 15, fontWeight: 600 };
const linkBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', color: C.ocean, fontWeight: 700, fontSize: 14.5, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 0', minHeight: 36 };
