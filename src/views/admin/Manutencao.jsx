import React, { useState, useRef } from 'react';
import { Database, Upload, Power, Check, AlertCircle } from 'lucide-react';
import { C, F, R } from '../../lib/constants';
import { downloadBlob } from '../../lib/csvUtils';
import { Card, Btn, ConfirmDialog } from '../../components/ui';
import { encerrarTodasSessoes, carregarAdmin } from '../../lib/dadosAdmin';
import { migrarDados } from '../../lib/migracoes';

// Backup, restauração e "Encerrar todas as sessões": ações raras e de risco.
// Ficavam no menu "Base de dados" da tela de Reservas (a mais usada); agora
// vivem em Configurações. A lógica é a mesma de antes, só mudou de lugar.
// `data`/`update` são do banco inteiro (os dois residenciais), não do recorte
// do residencial selecionado.
export function Manutencao({ data, update }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null); // { ok, text }
  const [restaurar, setRestaurar] = useState(null); // { obj, nome } — backup JSON à espera de confirmação
  const carimbo = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const exportJSON = () => downloadBlob(JSON.stringify(data, null, 2), `pinheiramar-backup-${carimbo()}.json`, 'application/json');

  // Encerrar todas as sessões do painel (kill switch) — para quando se quer
  // ter a certeza de que nenhuma aba antiga fica aberta gravando por cima,
  // ex.: antes de aplicar uma migração de banco. Desconecta TODOS os
  // administradores agora, inclusive quem aciona.
  const [confirmEncerrarSessoes, setConfirmEncerrarSessoes] = useState(false);
  const [encerrandoSessoes, setEncerrandoSessoes] = useState(false);
  const acionarEncerrarSessoes = async () => {
    setConfirmEncerrarSessoes(false);
    setEncerrandoSessoes(true);
    const r = await encerrarTodasSessoes();
    setEncerrandoSessoes(false);
    setMsg(r.ok
      ? { ok: true, text: `Sessões encerradas (${r.contas ?? '?'} conta(s) de administrador). Recarregue a página para entrar de novo.` }
      : { ok: false, text: `Não foi possível encerrar as sessões (${r.motivo || 'erro'}).` });
  };

  const onPickFile = (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const bruto = JSON.parse(reader.result);
        const obj = bruto?.data && Array.isArray(bruto.data.reservas) ? bruto.data : bruto;
        if (!obj || !Array.isArray(obj.apartamentos) || !Array.isArray(obj.reservas)) throw new Error('estrutura não reconhecida');
        // Restaurar SUBSTITUI tudo: só acontece depois da confirmação abaixo.
        setRestaurar({ obj, nome: file.name });
      } catch (err) { setMsg({ ok: false, text: 'JSON inválido: ' + err.message }); }
    };
    reader.readAsText(file);
  };

  const linha = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: '14px 0', borderTop: `1px solid ${C.line}` };
  const txt = { fontSize: 13.5, color: C.inkSoft, margin: '2px 0 0', lineHeight: 1.5 };
  return (
    <Card style={{ padding: 22, marginTop: 16 }}>
      <h3 style={{ fontFamily: F.disp, fontSize: 19, margin: '0 0 4px' }}>Backup e segurança</h3>
      <p style={{ ...txt, marginBottom: 12 }}>Vale para os dois residenciais. São ações raras — use com calma.</p>
      {msg && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '11px 14px', borderRadius: R.cartao, fontSize: 13.5, fontWeight: 500, background: msg.ok ? C.sucessoBg : C.erroBg, color: msg.ok ? C.sucesso : C.erro }}>
          {msg.ok ? <Check size={16} /> : <AlertCircle size={16} />}
          <span style={{ flex: 1 }}>{msg.text}</span>
        </div>
      )}
      <div style={linha}>
        <div style={{ flex: '1 1 260px' }}><b>Backup completo</b><p style={txt}>Baixa um arquivo com todos os dados: reservas, apartamentos, preços e configurações.</p></div>
        <Btn variant="ghost" icon={Database} onClick={exportJSON}>Baixar backup (JSON)</Btn>
      </div>
      <div style={linha}>
        <div style={{ flex: '1 1 260px' }}><b>Restaurar backup</b><p style={txt}>Substitui todos os dados pelos de um arquivo de backup. Pede confirmação antes.</p></div>
        <Btn variant="ghost" icon={Upload} onClick={() => fileRef.current?.click()}>Escolher arquivo…</Btn>
      </div>
      <div style={linha}>
        <div style={{ flex: '1 1 260px' }}><b>Encerrar todas as sessões</b><p style={txt}>Desconecta todos os administradores, em qualquer dispositivo.</p></div>
        <Btn variant="danger" icon={Power} disabled={encerrandoSessoes} onClick={() => setConfirmEncerrarSessoes(true)}>{encerrandoSessoes ? 'Encerrando sessões…' : 'Encerrar sessões'}</Btn>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={onPickFile} />

      {restaurar && (
        <ConfirmDialog
          title="Restaurar backup?"
          confirmLabel="Restaurar e substituir tudo"
          cancelLabel="Cancelar"
          message={<>O arquivo <b>{restaurar.nome}</b> tem <b>{restaurar.obj.reservas.length} reservas</b> e <b>{restaurar.obj.apartamentos.length} apartamentos</b>. Hoje o sistema tem <b>{data.reservas.length} reservas</b> e <b>{data.apartamentos.length} apartamentos</b>.<br /><br />Restaurar <b>substitui todos os dados</b> pelos do backup — inclusive reservas feitas pelo site depois da data do backup. Antes de substituir, uma cópia dos dados atuais será baixada para este computador.</>}
          onCancel={() => setRestaurar(null)}
          onConfirm={async () => {
            const { obj } = restaurar;
            setRestaurar(null);
            // a cópia de segurança sai dos dados MAIS RECENTES do banco (não só
            // do que este painel tinha em memória) — assim inclui também as
            // reservas feitas pelo site desde a última atualização do painel
            let atuais = data;
            try { atuais = (await carregarAdmin()).data || data; } catch { /* sem rede: guarda o que o painel tem */ }
            downloadBlob(JSON.stringify(atuais, null, 2), `pinheiramar-antes-de-restaurar-${carimbo()}.json`, 'application/json');
            const novo = migrarDados(obj).data;
            update(() => novo, { permitirReducao: true })
              .then(() => setMsg({ ok: true, text: `Backup restaurado — ${novo.reservas.length} reservas e ${novo.apartamentos.length} apartamentos. A cópia dos dados anteriores foi baixada.` }))
              .catch(e => setMsg({ ok: false, text: e?.codigo === 'descartada' ? 'A restauração foi cancelada.' : `Não foi possível restaurar (${e?.codigo || e?.message || 'erro'}). Nada foi alterado.` }));
          }}
        />
      )}

      {confirmEncerrarSessoes && (
        <ConfirmDialog
          title="Encerrar todas as sessões do painel?"
          confirmLabel="Encerrar todas as sessões"
          cancelLabel="Cancelar"
          message={<>Isso vai desconectar <b>todos os administradores</b>, em qualquer dispositivo — <b>inclusive você</b>. Todos precisarão entrar de novo com e-mail e senha.<br /><br />Aviso: uma aba que já esteja aberta continua a funcionar até o acesso dela vencer sozinho (normalmente até 1 hora) — isto impede que alguém entre de novo, mas não fecha instantaneamente uma aba já aberta.</>}
          onCancel={() => setConfirmEncerrarSessoes(false)}
          onConfirm={acionarEncerrarSessoes}
        />
      )}
    </Card>
  );
}
