import React, { useEffect, useState, useCallback } from 'react';
import { Waves, MessageCircle, RefreshCw } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { carregarPublico } from '../../lib/dadosPublico';

// Página pública e sem login — pensada para ser um link que o Caio pode
// mandar direto para um cliente (WhatsApp, e-mail) mostrando as políticas
// de hospedagem e cancelamento. Lê os mesmos dados públicos do site
// (/api/estado-publico), que já incluem o texto das políticas de cada
// residencial — nada de pessoal, nada de autenticação necessária.
//
// Uso: pinheiramar.com.br/?politicas            → mostra os dois residenciais
//      pinheiramar.com.br/?politicas=pinheiramar → só esse residencial
// (aceita o id interno ou o nome do residencial, sem acentos/maiúsculas)

function normalizar(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function waLink(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (!digitos) return null;
  const numero = digitos.startsWith('55') ? digitos : `55${digitos}`;
  return `https://api.whatsapp.com/send/?phone=%2B${numero}&text&type=phone_number&app_absent=0`;
}

function BlocoPolitica({ titulo, texto }) {
  if (!texto) return null;
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontFamily: F.disp, fontSize: 19, color: C.ocean, marginBottom: 10 }}>{titulo}</div>
      <div style={{ fontSize: 14.5, lineHeight: 1.7, color: '#333', whiteSpace: 'pre-wrap', background: '#F9FAFA', border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 18px' }}>
        {texto}
      </div>
    </div>
  );
}

function CartaoResidencial({ residencial }) {
  const pol = residencial.politicas || {};
  const wa = waLink(residencial.telefone);
  if (!pol.reservas?.texto && !pol.cancelamento?.texto) return null;
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: '26px 24px', marginBottom: 22 }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{residencial.nome}</div>
      {residencial.endereco && <div style={{ fontSize: 13.5, color: C.inkSoft, marginBottom: 20 }}>{residencial.endereco}{residencial.cidade ? ` · ${residencial.cidade}` : ''}</div>}
      <BlocoPolitica titulo={pol.reservas?.titulo || 'Termos e Políticas de Hospedagem'} texto={pol.reservas?.texto} />
      <BlocoPolitica titulo={pol.cancelamento?.titulo || 'Política de Cancelamento'} texto={pol.cancelamento?.texto} />
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4, padding: '10px 16px', borderRadius: 10, background: '#25D366', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
          <MessageCircle size={17} /> Falar no WhatsApp
        </a>
      )}
    </div>
  );
}

export function PoliticasPublicas({ filtro }) {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    setErro(false);
    try { setData(await carregarPublico()); }
    catch (e) { console.warn('[politicas] não foi possível carregar', e); setErro(true); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const voltar = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('politicas');
      window.location.href = url.pathname + url.search + url.hash;
    } catch { window.location.href = '/'; }
  };

  if (erro) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: C.espuma, fontFamily: F.sans, padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center', color: C.ink }}>
          <Waves size={32} color={C.brisa} />
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: '12px 0 8px' }}>Não foi possível carregar</h1>
          <p style={{ fontSize: 15, color: C.inkSoft, lineHeight: 1.6 }}>Verifique a sua conexão e tente de novo.</p>
          <button onClick={carregar} style={{ marginTop: 16, minHeight: 44, padding: '0 18px', border: 'none', borderRadius: 10, background: C.ocean, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: F.sans }}>
            <RefreshCw size={16} /> Tentar de novo
          </button>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: C.espuma, fontFamily: F.sans, color: C.inkSoft }}>
        <div style={{ textAlign: 'center' }}><Waves size={30} color={C.brisa} /><div style={{ marginTop: 10, fontSize: 15 }}>Carregando…</div></div>
      </div>
    );
  }

  const alvo = normalizar(filtro);
  const residenciais = (data.residenciais || []).filter(r => {
    if (!alvo) return true;
    return normalizar(r.id) === alvo || normalizar(r.nome).includes(alvo);
  });
  const mostrar = residenciais.length ? residenciais : (data.residenciais || []);

  return (
    <div style={{ minHeight: '100vh', background: C.espuma, fontFamily: F.sans }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 18px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Waves size={22} color={C.ocean} />
          <div style={{ fontFamily: F.disp, fontSize: 15, letterSpacing: '.14em', textTransform: 'uppercase', color: C.ocean}}>Grupo PinheiraMar</div>
        </div>
        <h1 style={{ fontFamily: F.disp, fontSize: 30, fontWeight: 400, color: C.ink, margin: '4px 0 8px' }}>Políticas de Hospedagem e Cancelamento</h1>
        <p style={{ fontSize: 15, color: C.inkSoft, marginBottom: 30, lineHeight: 1.6 }}>
          Estes são os termos que valem para a sua reserva. Qualquer dúvida, fale connosco pelo WhatsApp.
        </p>

        {mostrar.map(r => <CartaoResidencial key={r.id} residencial={r} />)}

        <div style={{ textAlign: 'center', marginTop: 30 }}>
          <button onClick={voltar} style={{ background: 'none', border: 'none', color: C.brisa, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: F.sans }}>← Voltar ao site</button>
        </div>
      </div>
    </div>
  );
}
