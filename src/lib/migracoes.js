// Migrações e arrumação dos dados gravados — funções puras, sem Supabase,
// para poderem correr tanto no painel como no servidor (api/). Antes viviam
// em seed.js, que importa o cliente Supabase do navegador e por isso não
// podia ser usado nas funções da Vercel.
import { hojeISO, provisoriaParaLimpar, HORAS_ATE_LIMPAR_PROVISORIA } from './reservas.js';

export { HORAS_ATE_LIMPAR_PROVISORIA };

/* ───────────────────── Migração de dados já gravados ─────────────────────
   Os dados vivem num único JSON (Supabase/localStorage) que foi sendo
   gravado por versões anteriores da aplicação. `versaoDados` diz por que
   passos é que esse JSON já passou, para cada um correr exactamente uma
   vez — mesmo que outro dispositivo já tenha corrido o anterior. Dados sem
   o campo contam como versão 0 e passam por tudo.

   v1 — renomear os estados. O modelo passou de 4 para 5 valores no commit
   "Reformular status da reserva em 5 estados" (2026-09-16) e os dados já
   gravados nunca foram convertidos: as milhares de reservas importadas do
   sistema anterior ficaram com `status: 'confirmada'`, valor que a
   aplicação já não conhece. Continuavam a bloquear datas (isAvailable só
   exclui 'cancelada') mas desapareciam das contas do Financeiro e apareciam
   como "Pendente" nas etiquetas (Badge faz STATUS[status] || pendente).
     'confirmada'                  → 'confirmado'
     'pendente' + sinalPago: true  → 'reservado'

   v2 — pagamento das reservas ainda por acontecer (a pedido do Caio). Pôr
   TODAS as importadas como "Confirmado" descreve mal o futuro: ninguém
   pagou 100% por uma estadia que ainda não aconteceu. As que já terminaram
   ficam Confirmado (v1); as que estão a decorrer ou ainda vêm (check-out de
   hoje em diante) passam a refletir o pagamento, lido da descrição que o
   sistema antigo deixava no nome do hóspede: com "50%" → Reservado (sinal
   pago), sem marca → Pendente (sem pagamento).

   Só mexe em reservas com `origem: 'Importado'`: as que vieram do site ou
   foram tratadas à mão no painel já têm um estado posto de propósito (o
   webhook do Mercado Pago, por exemplo) e não se sobrepõe a isso.

   O campo antigo `sinalPago` fica onde está, já não é lido por ninguém:
   converter é reversível, apagar não.

   v3 — `valorPago`: até aqui o único registo de pagamento era o `status`
   (pendente/reservado/confirmado), que só dá um valor aproximado (0%, 50%
   ou 100%) — não o valor real pago quando ele foge dessas frações (ex.:
   negociação, pagamento parcial). Toda reserva passa a ter `valorPago` (o
   que foi efetivamente recebido, editável no ecrã da reserva) e
   `valorRestante` deixa de ser guardado — é sempre `total - valorPago`,
   calculado na hora. Backfill: pendente → 0, reservado → sinal (50% do
   total), confirmado → total, bloqueio/cancelada → 0.

   v5 — taxas obrigatórias que faltavam em reservas ainda por acontecer (a
   pedido do Caio, 2026-09-26, depois de investigar por que "sumiram de
   todas as reservas"). Na verdade nunca tinham sido lançadas nelas: são
   quase todas reservas "Importado" do sistema antigo, que nunca discriminou
   essa taxa — não é uma regressão de hoje. Ainda assim, para as reservas
   com checkout ainda por vir (as únicas onde ainda faz sentido cobrar), sem
   NENHUM item em `extras`, lança agora as taxas obrigatórias atuais e soma
   o valor ao total. NÃO mexe em reservas já terminadas (encerradas do jeito
   que estavam) nem nas que já têm algum extra lançado (já foram tratadas à
   mão). Roda uma única vez (por causa do `versaoDados`), na próxima leitura
   do estado depois do deploy.

   (Pulou-se de v3 direto para v5: os dados de produção já tinham
   `versaoDados: 4` gravado — não por nenhum passo daqui, o histórico do
   git nunca teve um v4 — provavelmente de uma edição manual anterior. Usar
   "5" evita que este passo seja ignorado por engano.) */
export const DATA_VERSION = 5;

// A marca do sinal vem escrita no nome, com ou sem espaço antes do "%".
const MARCA_SINAL_50 = /50\s*%/;
const temSinal50 = (r) => MARCA_SINAL_50.test(`${r.nome || ''} ${r.sobrenome || ''} ${r.hospede || ''}`);

export function migrarDados(d) {
  if (!d || !Array.isArray(d.reservas)) return { data: d, migrou: false, alteradas: 0 };
  const de = Number(d.versaoDados) || 0;
  if (de >= DATA_VERSION) return { data: d, migrou: false, alteradas: 0 };

  let reservas = d.reservas;
  let alteradas = 0;
  const trocar = (r, novo) => { if (r.status === novo) return r; alteradas++; return { ...r, status: novo }; };

  if (de < 1) {
    reservas = reservas.map(r => {
      if (r.status === 'confirmada') return trocar(r, 'confirmado');
      if (r.status === 'pendente' && r.sinalPago === true) return trocar(r, 'reservado');
      return r;
    });
  }

  if (de < 2) {
    const hoje = hojeISO();
    reservas = reservas.map(r => {
      if (r.origem !== 'Importado') return r;
      if (r.status === 'bloqueio' || r.status === 'cancelada') return r;
      // datas em ISO (yyyy-mm-dd) comparam-se bem como texto; check-out
      // anterior a hoje = estadia terminada, fica como está.
      if (!r.checkOut || r.checkOut < hoje) return r;
      return trocar(r, temSinal50(r) ? 'reservado' : 'pendente');
    });
  }

  if (de < 3) {
    reservas = reservas.map(r => {
      if (r.valorPago != null) return r;
      alteradas++;
      const vp = r.status === 'confirmado' ? Number(r.total) || 0
        : r.status === 'reservado' ? Number(r.sinal) || Math.round((Number(r.total) || 0) * 0.5)
        : 0;
      return { ...r, valorPago: vp };
    });
  }

  if (de < 5) {
    const hoje = hojeISO();
    const obrig = (d.taxasAdicionais || []).filter(t => t && t.tipo === 'obrigatoria');
    if (obrig.length) {
      reservas = reservas.map(r => {
        if (r.status === 'cancelada' || r.status === 'bloqueio') return r;
        if (!r.checkOut || r.checkOut < hoje) return r;
        if (r.extras && r.extras.length) return r; // já tem algo lançado — não mexe
        const novos = obrig.map(t => ({
          id: 'mig4-' + r.id + '-' + t.id, taxaId: t.id, nome: t.nome, tipo: 'obrigatoria',
          por: t.por || 'reserva', qtd: 1, preco: Number(t.preco) || 0,
        }));
        const acrescimo = novos.reduce((s, e) => s + e.qtd * e.preco, 0);
        alteradas++;
        return { ...r, extras: novos, total: Math.round(((Number(r.total) || 0) + acrescimo) * 100) / 100 };
      });
    }
  }

  return { data: { ...d, reservas, versaoDados: DATA_VERSION }, migrou: true, alteradas };
}

/* ── Limpeza das reservas provisórias que caducaram ───────────────────────
   Uma reserva do site que ficou à espera do pagamento e nunca foi paga
   deixa de bloquear datas mal o prazo passa (holdExpirado, em helpers.js) —
   isso é imediato e não depende desta limpeza. Isto aqui é só arrumação:
   passado um tempo, o registo sai de vez, para a lista do painel não encher
   de tentativas falhadas que nunca foram reservas.

   As 24 horas de folga são de propósito: o Mercado Pago reenvia avisos
   durante horas se o primeiro não passar, e enquanto o registo existir esse
   aviso atrasado ainda consegue confirmar a reserva. Apagar mais cedo seria
   arriscar perder uma reserva efectivamente paga.

   Ao contrário de migrarDados, isto não é um passo de versão — corre em
   todos os arranques, porque há sempre provisórias novas a caducar. */

export function limparProvisoriasCaducadas(d, agora = Date.now()) {
  if (!d || !Array.isArray(d.reservas)) return { data: d, removidas: 0 };
  // data inválida ou ausente nunca é apagada — na dúvida, guarda-se; e uma
  // provisória com qualquer registo de pagamento também nunca (ver
  // provisoriaParaLimpar em reservas.js).
  const reservas = d.reservas.filter(r => !provisoriaParaLimpar(r, agora));
  const removidas = d.reservas.length - reservas.length;
  return { data: removidas ? { ...d, reservas } : d, removidas };
}
