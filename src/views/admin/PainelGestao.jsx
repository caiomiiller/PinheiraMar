// Porta de entrada do painel: login (Supabase Auth), carga do estado
// completo e a FILA de alterações — cada `update(fn)` das vistas entra na
// fila e é gravado com verificação de versão (ver lib/dadosAdmin.js). Se a
// gravação falhar, a alteração fica na fila, aparece um aviso e dá para
// tentar de novo; nada é "gravado só neste dispositivo" em silêncio.
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Waves, Home, LogOut, RefreshCw, AlertTriangle, Check, Eye, EyeOff, Upload } from 'lucide-react';
import { C, F } from '../../lib/constants';
import { Admin } from './Admin';
import {
  sessaoAtual, aoMudarSessao, entrar, sair, carregarAdmin, gravarAdmin, ouvirAlteracoes, frescura, criarLinhaInicial,
} from '../../lib/dadosAdmin';
import { migrarDados, limparProvisoriasCaducadas } from '../../lib/migracoes';
import { MODO_DEMO } from '../../lib/config';

const MENSAGENS_ERRO = {
  reducao_suspeita: 'A alteração apagaria muitas reservas de uma vez e foi bloqueada por segurança. Recarregue o painel e confira.',
  conflito_persistente: 'Outra pessoa está alterando os dados ao mesmo tempo. Tente de novo em alguns segundos.',
  sem_permissao: 'Este usuário não tem permissão para salvar. Confirme que o e-mail está na lista de administradores.',
  estado_invalido: 'A alteração não pôde ser aplicada (dados inválidos).',
};

function Tela({ children }) {
  return <div style={{ minHeight: '100vh', background: C.oceanDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.sans, padding: 24 }}>{children}</div>;
}
function Cartao({ children }) {
  return <div className="pm-pop" style={{ background: '#fff', borderRadius: 24, padding: '36px 32px', width: '100%', maxWidth: 400, boxShadow: '0 32px 80px rgba(0,0,0,.36)' }}>{children}</div>;
}
const campo = { width: '100%', boxSizing: 'border-box', padding: '13px 14px', fontSize: 16, border: `1.5px solid ${C.line}`, borderRadius: 12, outline: 'none', fontFamily: F.sans, color: C.ink, background: '#fff' };
const botao = { width: '100%', minHeight: 50, background: C.ocean, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 600, fontSize: 16, cursor: 'pointer', fontFamily: F.sans };

export function LoginScreen({ onEntrar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState(null);
  const [aguarde, setAguarde] = useState(false);
  const tentar = async (e) => {
    e?.preventDefault?.();
    setAguarde(true); setErro(null);
    const r = await onEntrar(email, senha);
    setAguarde(false);
    if (!r.ok) setErro(r.erro === 'credenciais' ? 'E-mail ou senha incorretos.' : 'Sem conexão com o servidor. Tente de novo.');
  };
  return (
    <Tela>
      <Cartao>
        <form onSubmit={tentar}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
            <img src="/icons/icon-192.png" alt="" style={{ width: 56, height: 56, borderRadius: '50%', marginBottom: 14 }} />
            <div style={{ fontSize: 22, fontWeight: 400, color: C.ink }}>Gestão dos residenciais</div>
            <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>Acesso ao painel</div>
          </div>
          {MODO_DEMO && <div style={{ fontSize: 13.5, background: '#FFF4D6', color: '#5C4400', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>Demonstração: entre com qualquer e-mail.</div>}
          <label htmlFor="pm-login-email" style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft, display: 'block', marginBottom: 6 }}>E-mail</label>
          <input id="pm-login-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} autoFocus style={{ ...campo, marginBottom: 14 }} />
          <label htmlFor="pm-login-senha" style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft, display: 'block', marginBottom: 6 }}>Senha</label>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input id="pm-login-senha" type={ver ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} style={{ ...campo, paddingRight: 50 }} />
            <button type="button" onClick={() => setVer(v => !v)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}
              style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: C.inkSoft, display: 'grid', placeItems: 'center' }}>
              {ver ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          {erro && <div role="alert" style={{ color: '#B42318', fontSize: 14, margin: '6px 0 4px', fontWeight: 600 }}>{erro}</div>}
          <button type="submit" disabled={aguarde || (!MODO_DEMO && (!email || !senha))} style={{ ...botao, marginTop: 14, opacity: aguarde ? .6 : 1 }}>
            {aguarde ? 'Entrando…' : 'Entrar no painel'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>
            Esqueceu a senha? Quem administra o Supabase pode redefini-la em Authentication → Users.
          </div>
        </form>
      </Cartao>
    </Tela>
  );
}

function AvisoPainel({ titulo, texto, children }) {
  return (
    <Tela>
      <Cartao>
        <div style={{ textAlign: 'center' }}>
          <AlertTriangle size={30} color="#B54708" />
          <div style={{ fontSize: 19, fontWeight: 500, color: C.ink, margin: '10px 0 8px' }}>{titulo}</div>
          <div style={{ fontSize: 15, color: C.inkSoft, lineHeight: 1.55, marginBottom: 18 }}>{texto}</div>
          <div style={{ display: 'grid', gap: 10 }}>{children}</div>
        </div>
      </Cartao>
    </Tela>
  );
}

export default function PainelGestao({ onVerSite }) {
  const [sessao, setSessao] = useState(undefined); // undefined = a verificar
  useEffect(() => {
    let vivo = true;
    sessaoAtual().then(s => { if (vivo) setSessao(s); }).catch(() => { if (vivo) setSessao(null); });
    const off = aoMudarSessao(s => setSessao(s));
    return () => { vivo = false; off(); };
  }, []);
  if (sessao === undefined) return <Tela><Waves size={34} color="#fff" /></Tela>;
  if (!sessao) {
    return <LoginScreen onEntrar={async (email, senha) => { const r = await entrar(email, senha); if (r.ok) setSessao(r.sessao); return r; }} />;
  }
  return <PainelComDados sessao={sessao} onVerSite={onVerSite} onSair={async () => { await sair(); setSessao(null); }} />;
}

function PainelComDados({ sessao, onVerSite, onSair }) {
  const [base, setBase] = useState(null);          // cópia do servidor { data, versao, updatedAt }
  const [erroCarga, setErroCarga] = useState(null);
  const [fila, setFila] = useState([]);            // alterações por gravar
  const [sync, setSync] = useState({ estado: 'ok' });
  const baseRef = useRef(null);
  const filaRef = useRef([]);
  const processando = useRef(false);
  // conta as vezes que a cópia do servidor foi trocada: uma recarga que
  // começou antes de uma gravação e termina depois dela é descartada (senão
  // o ecrã voltava a mostrar os dados de antes da gravação)
  const geracao = useRef(0);

  const aplicarBase = (b) => { geracao.current += 1; baseRef.current = b; setBase(b); };
  const aplicarFila = (f) => { filaRef.current = f; setFila(f); };

  const recarregar = useCallback(async () => {
    const g = geracao.current;
    try {
      const b = await carregarAdmin();
      if (geracao.current !== g) return baseRef.current; // chegou algo mais novo entretanto
      aplicarBase(b); setErroCarga(null); return b;
    } catch (e) {
      if (geracao.current === g) setErroCarga(e.codigo || 'leitura_falhou');
      return null;
    }
  }, []);

  const processar = useCallback(async () => {
    if (processando.current) return;
    processando.current = true;
    try {
      while (filaRef.current.length) {
        const item = filaRef.current[0];
        setSync({ estado: 'gravando' });
        try {
          const b = baseRef.current;
          const pre = b && item.cacheSobre === b.data ? item.cache : undefined;
          const nova = await gravarAdmin(item.fn, b, { pre, permitirReducao: !!item.opts?.permitirReducao });
          aplicarBase(nova);
          aplicarFila(filaRef.current.slice(1));
          item.resolve(nova.data);
        } catch (e) {
          const codigo = e.codigo || 'gravacao_falhou';
          if (codigo === 'reducao_suspeita' || codigo === 'estado_invalido') {
            // não adianta repetir: descarta esta alteração e avisa
            aplicarFila(filaRef.current.slice(1));
            item.reject(e);
          }
          setSync({ estado: 'erro', codigo });
          return; // o resto fica na fila; "Tentar de novo" volta a chamar processar()
        }
      }
      setSync({ estado: 'ok', em: Date.now() });
    } finally {
      processando.current = false;
    }
  }, []);

  const enfileirar = useCallback((fn, opts) => new Promise((resolve, reject) => {
    aplicarFila([...filaRef.current, { fn, opts, resolve, reject }]);
    processar();
  }), [processar]);

  // carga inicial; migrações/arrumação são gravadas como qualquer alteração
  useEffect(() => {
    (async () => {
      const b = await recarregar();
      if (!b) return;
      const arrumar = (s) => limparProvisoriasCaducadas(migrarDados(s).data).data;
      if (arrumar(b.data) !== b.data) enfileirar(arrumar).catch(() => {});
    })();
  }, [recarregar, enfileirar]);

  // outra pessoa gravou? (tempo real, ao voltar ao separador e a cada minuto)
  useEffect(() => {
    const talvezRecarregar = async (f) => {
      if (filaRef.current.length || processando.current) return; // a fila já relê antes de gravar
      const b = baseRef.current;
      if (b && f && f.versao === b.versao && f.updatedAt === b.updatedAt) return;
      await recarregar();
    };
    const off = ouvirAlteracoes(talvezRecarregar);
    const verificar = () => { if (document.visibilityState === 'visible') frescura().then(talvezRecarregar).catch(() => {}); };
    document.addEventListener('visibilitychange', verificar);
    const t = setInterval(verificar, 60000);
    return () => { off(); document.removeEventListener('visibilitychange', verificar); clearInterval(t); };
  }, [recarregar]);

  // não sair da página com alterações por gravar
  useEffect(() => {
    const aviso = (e) => { if (filaRef.current.length) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, []);

  // o que o painel mostra = cópia do servidor + alterações ainda na fila
  const data = useMemo(() => {
    if (!base) return null;
    let s = base.data;
    for (const it of fila) {
      if (it.cacheSobre !== s) { it.cacheSobre = s; it.cache = it.fn(s); }
      s = it.cache;
    }
    return s;
  }, [base, fila]);

  const update = useCallback((arg, opts) => enfileirar(typeof arg === 'function' ? arg : (prev) => ({ ...prev, ...arg }), opts), [enfileirar]);

  if (erroCarga && !base) {
    const semAcesso = erroCarga === 'sem_acesso_ou_vazio';
    return (
      <AvisoPainel
        titulo={semAcesso ? 'Sem acesso aos dados' : 'Não foi possível carregar o painel'}
        texto={semAcesso
          ? `O usuário ${sessao?.user?.email || ''} não tem acesso aos dados — confirme que o e-mail está na tabela admins do Supabase. (Se o banco estiver mesmo vazio, pode restaurar um backup.)`
          : 'Verifique a conexão e tente de novo. Nada foi alterado.'}>
        <button onClick={recarregar} style={botao}><RefreshCw size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Tentar de novo</button>
        {semAcesso && <RestaurarBancoVazio onFeito={recarregar} />}
        <button onClick={onSair} style={{ ...botao, background: '#fff', color: C.ink, border: `1.5px solid ${C.line}` }}>Sair</button>
      </AvisoPainel>
    );
  }
  if (!data) return <Tela><Waves size={34} color="#fff" /></Tela>;

  return (
    <div>
      <div style={{ background: C.oceanDeep, color: 'rgba(255,255,255,.85)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '7px 16px', fontSize: 13, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Waves size={15} color={C.brisa} />
          <span style={{ fontWeight: 600, color: '#fff' }}>Painel de gestão</span>
          <span style={{ opacity: .7 }}>· {sessao?.user?.email}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onVerSite} style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 7, color: 'rgba(255,255,255,.9)', padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Home size={13} /> Ver site
          </button>
          <button onClick={onSair} style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 7, color: 'rgba(255,255,255,.9)', padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <LogOut size={13} /> Sair
          </button>
        </div>
      </div>
      <Admin data={data} update={update} />
      <BarraSync sync={sync} pendentes={fila.length} onTentar={() => { setSync({ estado: 'gravando' }); processar(); }} onRecarregar={() => { const descartadas = filaRef.current; aplicarFila([]); descartadas.forEach(it => it.reject(Object.assign(new Error('descartada'), { codigo: 'descartada' }))); recarregar(); setSync({ estado: 'ok' }); }} />
    </div>
  );
}

function BarraSync({ sync, pendentes, onTentar, onRecarregar }) {
  if (sync.estado === 'ok' && !pendentes) return null;
  const erro = sync.estado === 'erro';
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 200, maxWidth: 560, margin: '0 auto',
      background: erro ? '#FEF3F2' : '#fff', border: `1px solid ${erro ? '#FDA29B' : C.line}`, borderRadius: 14,
      boxShadow: '0 10px 30px rgba(0,0,0,.16)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, fontFamily: F.sans, fontSize: 14.5, color: C.ink,
    }}>
      {erro ? <AlertTriangle size={20} color="#B42318" style={{ flexShrink: 0 }} /> : <RefreshCw size={18} className="pm-girar" style={{ flexShrink: 0 }} />}
      <div style={{ flex: 1, lineHeight: 1.45 }}>
        {erro
          ? (MENSAGENS_ERRO[sync.codigo] || `Não foi possível salvar ${pendentes > 1 ? `${pendentes} alterações` : 'a última alteração'} — verifique a conexão.`)
          : `Salvando${pendentes > 1 ? ` ${pendentes} alterações` : ''}…`}
      </div>
      {erro && pendentes > 0 && <button onClick={onTentar} style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, border: 'none', background: C.ocean, color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: F.sans }}>Tentar de novo</button>}
      {erro && <button onClick={onRecarregar} style={{ minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, fontWeight: 600, cursor: 'pointer', fontFamily: F.sans }} title="Descarta o que não foi salvo e recarrega os dados do servidor">Recarregar</button>}
    </div>
  );
}

// Só aparece quando o painel não vê dados: permite criar a linha a partir de
// um backup JSON (insert — nunca substitui uma linha que já exista).
function RestaurarBancoVazio({ onFeito }) {
  const ref = useRef(null);
  const [msg, setMsg] = useState(null);
  const escolher = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      const d = obj?.data && Array.isArray(obj.data.reservas) ? obj.data : obj;
      if (!d || !Array.isArray(d.reservas) || !Array.isArray(d.apartamentos)) throw new Error('estrutura não reconhecida');
      if (!window.confirm(`Criar o banco a partir deste backup (${d.reservas.length} reservas, ${d.apartamentos.length} apartamentos)?\n\nSó funciona se o banco estiver mesmo vazio — nunca substitui dados existentes.`)) return;
      const r = await criarLinhaInicial(d);
      setMsg(r.ok ? { ok: true, t: 'Banco criado a partir do backup.' } : { ok: false, t: r.motivo === 'existe' ? 'O banco não está vazio: o problema é de acesso (e-mail fora da lista admins).' : 'Não foi possível criar: ' + (r.motivo || 'erro') });
      if (r.ok) onFeito();
    } catch (err) { setMsg({ ok: false, t: 'Backup inválido: ' + err.message }); }
  };
  return (
    <>
      <input ref={ref} type="file" accept="application/json,.json" onChange={escolher} style={{ display: 'none' }} />
      <button onClick={() => ref.current?.click()} style={{ ...botao, background: '#fff', color: C.ink, border: `1.5px solid ${C.line}` }}><Upload size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Banco vazio? Restaurar backup</button>
      {msg && <div style={{ fontSize: 14, color: msg.ok ? '#067647' : '#B42318' }}>{msg.ok && <Check size={14} />} {msg.t}</div>}
    </>
  );
}
