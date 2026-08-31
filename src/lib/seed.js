import { C } from './constants';
import { uid, code, ymd, today, nights, stayBreakdown } from './helpers';

/* ─────────────────────────────────────────────────────────────────────────
   Multi-imóvel: existe UM único store `data`, partilhado por todos os
   residenciais. `apartamentos` é um array achatado — cada apartamento tem
   `residencialId` a dizer a que imóvel pertence. `reservas`, `seasons`,
   `taxasAdicionais`, `cupons` e `pagamentos` são partilhados (a mesma
   temporada/tarifário serve os apartamentos de qualquer imóvel, porque os
   preços vivem em `season.precos[apartamentoId]`). O que É específico de
   cada imóvel — nome, morada, políticas, idiomas, tema de cor, textos da
   home — vive em `residenciais[]`. Ver src/lib/multiProperty.js para como
   isto é "recortado" por imóvel antes de chegar ao PublicSite/Admin.
   ───────────────────────────────────────────────────────────────────── */

export function seedData() {
  const apartamentos = [
    // ── Residencial PinheiraMar (à beira-mar) ──
    { id: 'a101', residencialId: 'pinheiramar', nome: 'Apto 101', tipo: 'Apto 101 - Térreo à beira mar, 4 pessoas', piso: 'Térreo', vista: 'Beira-mar', capacidade: 4, preco: 245, foto: '', ativo: true },
    { id: 'a102', residencialId: 'pinheiramar', nome: 'Apto 102', tipo: 'Apto 102 - Térreo Frente Mar, 4 pessoas', piso: 'Térreo', vista: 'Frente Mar', capacidade: 4, preco: 285, foto: '', ativo: true },
    { id: 'a114', residencialId: 'pinheiramar', nome: 'Apto 114', tipo: 'Apto 114 - Térreo à beira mar, 6 pessoas', piso: 'Térreo', vista: 'Beira-mar', capacidade: 6, preco: 320, foto: '', ativo: true },
    { id: 'a118', residencialId: 'pinheiramar', nome: 'Apto 118', tipo: 'Apto 118 - 1°Piso à beira mar, 2 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 2, preco: 180, foto: '', ativo: true },
    { id: 'a203', residencialId: 'pinheiramar', nome: 'Apto 203', tipo: 'Apto 203 - 1°Piso à beira mar, 4 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 4, preco: 250, foto: '', ativo: true },
    { id: 'a204', residencialId: 'pinheiramar', nome: 'Apto 204', tipo: 'Apto 204 - 1°Piso Frente Mar, 4 pessoas', piso: '1º Piso', vista: 'Frente Mar', capacidade: 4, preco: 290, foto: '', ativo: true },
    { id: 'a206', residencialId: 'pinheiramar', nome: 'Apto 206', tipo: 'Apto 206 - 1°Piso à beira mar, 6 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 6, preco: 330, foto: '', ativo: true },
    { id: 'a207', residencialId: 'pinheiramar', nome: 'Apto 207', tipo: 'Apto 207 - 1°Piso Frente Mar, 8 pessoas', piso: '1º Piso', vista: 'Frente Mar', capacidade: 8, preco: 430, foto: '', ativo: true },
    { id: 'a209', residencialId: 'pinheiramar', nome: 'Apto 209', tipo: 'Apto 209 - 1°Piso à beira mar, 4 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 4, preco: 250, foto: '', ativo: true },
    { id: 'a210', residencialId: 'pinheiramar', nome: 'Apto 210', tipo: 'Apto 210 - 1°Piso à beira mar, 4 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 4, preco: 250, foto: '', ativo: true },
    { id: 'a211', residencialId: 'pinheiramar', nome: 'Apto 211', tipo: 'Apto 211 - 1°Piso à beira mar, 2 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 2, preco: 190, foto: '', ativo: true },
    { id: 'a212', residencialId: 'pinheiramar', nome: 'Apto 212', tipo: 'Apto 212 - 1°Piso à beira mar, 2 pessoas', piso: '1º Piso', vista: 'Beira-mar', capacidade: 2, preco: 190, foto: '', ativo: true },
    { id: 'a305', residencialId: 'pinheiramar', nome: 'Apto 305', tipo: 'Apto 305 - 2°Piso Frente Mar, 4 pessoas', piso: '2º Piso', vista: 'Frente Mar', capacidade: 4, preco: 300, foto: '', ativo: true },
    { id: 'a313', residencialId: 'pinheiramar', nome: 'Apto 313', tipo: 'Apto 313 - 2°Piso à beira mar, 8 pessoas', piso: '2º Piso', vista: 'Beira-mar', capacidade: 8, preco: 420, foto: '', ativo: true },
    { id: 'a315', residencialId: 'pinheiramar', nome: 'Apto 315', tipo: 'Apto 315 - 2°Piso Frente Mar, 8 pessoas', piso: '2º Piso', vista: 'Frente Mar', capacidade: 8, preco: 450, foto: '', ativo: true },
    { id: 'a316', residencialId: 'pinheiramar', nome: 'Apto 316', tipo: 'Apto 316 - 2°Piso à beira mar, 6 pessoas', piso: '2º Piso', vista: 'Beira-mar', capacidade: 6, preco: 340, foto: '', ativo: true },
    { id: 'a317', residencialId: 'pinheiramar', nome: 'Apto 317', tipo: 'Apto 317 - 2°Piso à beira mar, 6 pessoas', piso: '2º Piso', vista: 'Beira-mar', capacidade: 6, preco: 340, foto: '', ativo: true },

    // ── Novo Residencial (a 150m da Praia da Pinheira) ──────────────────
    // Preços de arranque estimados a partir da tabela do PinheiraMar por
    // capacidade/piso (não há "Frente Mar" aqui — usa a faixa "à beira-mar"
    // como referência, com um pequeno acréscimo por piso, tal como no
    // PinheiraMar). Ajusta livremente em Admin → Apartamentos.
    { id: 'n01', residencialId: 'novoimovel', nome: 'Apto 01', tipo: 'Apto 01 - Térreo, a 150m da praia, 6 pessoas', piso: 'Térreo', vista: 'A 150m da praia', capacidade: 6, preco: 320, foto: '', ativo: true },
    { id: 'n02', residencialId: 'novoimovel', nome: 'Apto 02', tipo: 'Apto 02 - Térreo, a 150m da praia, 6 pessoas', piso: 'Térreo', vista: 'A 150m da praia', capacidade: 6, preco: 320, foto: '', ativo: true },
    { id: 'n03', residencialId: 'novoimovel', nome: 'Apto 03', tipo: 'Apto 03 - 2º Piso, a 150m da praia, 4 pessoas', piso: '2º Piso', vista: 'A 150m da praia', capacidade: 4, preco: 260, foto: '', ativo: true },
    { id: 'n04', residencialId: 'novoimovel', nome: 'Apto 04', tipo: 'Apto 04 - 2º Piso, a 150m da praia, 9 pessoas', piso: '2º Piso', vista: 'A 150m da praia', capacidade: 9, preco: 440, foto: '', ativo: true },
    { id: 'n05', residencialId: 'novoimovel', nome: 'Apto 05', tipo: 'Apto 05 - 2º Piso, a 150m da praia, 9 pessoas', piso: '2º Piso', vista: 'A 150m da praia', capacidade: 9, preco: 440, foto: '', ativo: true },
    { id: 'n06', residencialId: 'novoimovel', nome: 'Apto 06', tipo: 'Apto 06 - Cobertura (3º Piso), a 150m da praia, 6 pessoas', piso: 'Cobertura', vista: 'A 150m da praia', capacidade: 6, preco: 380, foto: '', ativo: true },
  ];

  // Gera preços por apartamento para uma temporada: diária × fator, fim de semana com acréscimo.
  // Corre sobre TODOS os apartamentos (de qualquer imóvel) — por isso as temporadas
  // são uma tabela só, partilhada por todos os residenciais.
  const mkPrecos = (f, wknd = 1.15) => Object.fromEntries(apartamentos.map(a => [a.id, {
    diaSemana: Math.round(a.preco * f), fimSemana: Math.round(a.preco * f * wknd),
    semanal: 0, mensal: 0, adultoExtra: 0,
  }]));
  const seasons = [
    { id: 's1', nome: 'Baixa 2026', inicio: '2026-04-07', fim: '2026-11-30', minNoites: 2, maxNoites: null, ativa: true, precos: mkPrecos(1.0) },
    { id: 's2', nome: 'Pós-temporada 2026', inicio: '2026-02-19', fim: '2026-04-06', minNoites: 2, maxNoites: null, ativa: true, precos: mkPrecos(1.2) },
    { id: 's3', nome: 'Alta 2026-2027', inicio: '2026-12-26', fim: '2027-02-11', minNoites: 4, maxNoites: null, ativa: true, precos: mkPrecos(1.9) },
    { id: 's4', nome: 'Pré-temporada 2026-2027', inicio: '2026-12-01', fim: '2026-12-25', minNoites: 3, maxNoites: null, ativa: true, precos: mkPrecos(1.4) },
    { id: 's5', nome: 'Pós-temporada 2027', inicio: '2027-02-12', fim: '2027-03-29', minNoites: 2, maxNoites: null, ativa: true, precos: mkPrecos(1.2) },
    { id: 's6', nome: 'Alta 2025-2026', inicio: '2025-12-26', fim: '2026-02-18', minNoites: 4, maxNoites: null, ativa: true, precos: mkPrecos(1.9) },
    { id: 's7', nome: 'Pré-temporada 2025-2026', inicio: '2025-12-01', fim: '2025-12-25', minNoites: 3, maxNoites: null, ativa: true, precos: mkPrecos(1.4) },
  ];
  const byId = Object.fromEntries(apartamentos.map(a => [a.id, a]));
  const mk = (aptId, ci, co, nome, sobrenome, adultos, criancas, status, origem, contacto, extras = []) => {
    const apt = byId[aptId];
    const bd = stayBreakdown(apt, seasons, ci, co);
    const n = Math.max(1, bd.n);
    const precoNoite = status === 'bloqueio' ? 0 : Math.round(bd.total / n);
    const extrasVal = extras.reduce((s, e) => s + e.qtd * e.preco, 0);
    const total = status === 'bloqueio' ? 0 : precoNoite * n + extrasVal;
    return {
      id: uid(), codigo: code(), apartamentoId: aptId, checkIn: ci, checkOut: co,
      nome: status === 'bloqueio' ? '' : nome, sobrenome: status === 'bloqueio' ? '' : sobrenome,
      hospede: status === 'bloqueio' ? '' : `${nome} ${sobrenome}`.trim(),
      email: contacto?.email || '', telefone: contacto?.tel || '', pais: contacto?.pais || 'Brasil',
      adultos: status === 'bloqueio' ? 0 : adultos, criancas: status === 'bloqueio' ? 0 : criancas,
      hospedes: status === 'bloqueio' ? 0 : adultos + criancas,
      precoNoite, precoTabela: status === 'bloqueio' ? 0 : bd.total,
      extras: extras.map(e => ({ id: uid(), ...e })), total, sinal: Math.round(total * 0.5),
      status, origem, enviarEmail: false,
      nota: status === 'bloqueio' ? 'Manutenção / bloqueio interno' : '', criadoEm: ymd(today()),
    };
  };
  // Todas as reservas-seed são do PinheiraMar (o Novo Residencial começa sem
  // histórico — é normal, é um imóvel que acabou de ser adquirido).
  const reservas = [
    mk('a207', '2026-06-13', '2026-06-20', 'Carlos', 'Andrade', 5, 1, 'confirmada', 'Site', { email: 'andrade@email.com', tel: '47 99123-4567' }, [{ nome: 'Vaga de Estacionamento p/ 1 Automóvel', qtd: 1, preco: 50 }, { nome: 'Higienização e Serviços de Hospedagem', qtd: 1, preco: 175 }]),
    mk('a101', '2026-06-15', '2026-06-18', 'Mariana', 'Lopes', 3, 0, 'confirmada', 'WhatsApp', { email: 'mari.lopes@email.com', tel: '48 99888-1122' }),
    mk('a305', '2026-06-19', '2026-06-26', 'Rui', 'Tavares', 2, 0, 'pendente', 'Site', { email: 'rui.t@email.com', tel: '21 99777-3344' }),
    // Turnover no mesmo dia (14/06): João sai até às 10h e a Família Becker entra a partir das 13h
    mk('a204', '2026-06-12', '2026-06-14', 'João', 'Pereira', 4, 0, 'confirmada', 'Telefone', { email: 'jp@email.com', tel: '48 99555-9090' }),
    mk('a204', '2026-06-14', '2026-06-19', 'Helena', 'Becker', 3, 1, 'confirmada', 'Site', { email: 'becker@email.com', tel: '51 99444-2211' }),
    mk('a206', '2026-06-16', '2026-06-21', 'Diego', 'Martins', 4, 2, 'confirmada', 'Booking', { email: 'diego.m@email.com', tel: '48 99222-7788', pais: 'Argentina' }, [{ nome: 'Desconto de negociação', qtd: 1, preco: -150 }]),
    mk('a102', '2026-06-22', '2026-06-25', '', '', 0, 0, 'bloqueio', 'Manual', {}),
  ];

  const idiomas = [
    { codigo: 'pt', nome: 'Português', nativo: 'Português', bandeira: '🇧🇷', principal: true, ativo: true },
    { codigo: 'es', nome: 'Espanhol', nativo: 'Español', bandeira: '🇦🇷', principal: false, ativo: true },
    { codigo: 'en', nome: 'Inglês', nativo: 'English', bandeira: '🇺🇸', principal: false, ativo: true },
  ];

  const politicasReservasTexto = `IMPORTANTE

• Por questões de segurança e privacidade dos demais hóspedes, visitas e convidados só serão permitidos mediante autorização prévia. As dependências do residencial — incluindo áreas internas e apartamentos — são de uso exclusivo dos hóspedes registados.

• Mínimo de 2 (duas) diárias em períodos regulares. Em feriados e datas festivas, o mínimo varia conforme o pacote — consulte nossos canais de atendimento.

• O Residencial oferece apartamentos mobiliados para locação de temporada. Não estão incluídos: café da manhã, roupas de cama/mesa/banho, itens de higiene pessoal nem utensílios de praia.

CHECK-IN: 13h00 | CHECK-OUT: 10h00

---

1. PAGAMENTO

• Para pagamento via cartão de crédito ou Pix/transferência bancária: 50% do valor total antecipado para confirmar a reserva; os 50% restantes + taxas devem ser pagos no check-in.
• Tarifas Promocionais: pagamento de 100% no acto da reserva. Não reembolsável.
• A confirmação da reserva é efectuada somente após a recepção do sinal de 50% (ou 100% em tarifas promocionais).

---

2. COMO RESERVAR

Entre em contacto via WhatsApp/redes sociais ou pelo site.

---

3. HOSPEDAGEM

• Lei do silêncio: das 22h às 7h (excepto Réveillon e Carnaval).
• O acesso aos apartamentos é restrito exclusivamente aos hóspedes registados.
• A chave é retirada no check-in e devolvida no check-out. Perda da chave ou controle de portão: R$ 50,00.
• Danos ou extravios do patrimônio do residencial serão cobrados pelo valor de reposição.
• É proibido pendurar roupas em áreas comuns.
• Manter torneiras, luzes e ar condicionado desligados quando não houver ninguém no apartamento.

---

4. POLÍTICA DE PETS

• Aceitos cães e gatos com mais de 6 meses e até 10 kg (máximo 2 pets por apartamento).
• Taxa única de R$ 150,00 por pet.
• O proprietário é responsável pela limpeza, silêncio e uso de tapete higiênico dentro do apartamento.
• Não é permitido utilizar utensílios do apartamento para o animal.

---

5. ESTACIONAMENTO

• Cada apartamento tem direito a 1 vaga de garagem.
• Vaga adicional: taxa única de R$ 50,00 por automóvel (sujeito a disponibilidade).

---

6. LOCAÇÕES DISPONÍVEIS

Jogo de lençol R$ 28,00 · Manta R$ 30,00 · Toalha (banho + rosto) R$ 13,00 · Rede R$ 15,00 · Cooler R$ 25,00 · Cadeira de praia R$ 10,00/dia (acima de 5 dias: R$ 50,00/unidade).`;

  const politicasCancelamentoTexto = `Solicitações de cancelamento são aceitas exclusivamente por ligação ou WhatsApp, pelo titular da reserva.

PRAZOS E CONDIÇÕES

• Cancelamento ou troca de data com mais de 31 dias de antecedência do check-in:
  → Emissão de Voucher no valor já antecipado, válido para nova reserva.

• Cancelamento ou troca de data entre 16 e 30 dias de antecedência do check-in:
  → Cobrança de 50% do valor total da estadia. O valor eventualmente excedente não será reembolsado.

• Cancelamento com menos de 15 dias de antecedência do check-in:
  → Cobrança de 100% do valor total da estadia. Sem reembolso.

• No-show (não comparecimento sem aviso prévio):
  → Cobrança de 100% do valor total da hospedagem. Sem reembolso.

• Cancelamentos ou alterações realizados após o check-in:
  → Cobrança de 100% do valor total da hospedagem. Sem reembolso.

• Tarifas Promocionais:
  → Não reembolsáveis em nenhuma situação.

NOTA: A contagem de dias é feita em relação à data de check-in. Todos os prazos referem-se a dias corridos.`;

  // ── Residenciais ─────────────────────────────────────────────────────
  // Cada residencial é um "settings" completo (nome, morada, políticas,
  // idiomas, sinal, horários) mais alguns campos de marca usados só na home
  // pública (tema, textos do hero, imagem, etc.). Isto é deliberado: assim
  // src/views/admin/Settings.jsx, Politicas.jsx, Idiomas.jsx e o PublicSite
  // continuam a ler `data.settings.<campo>` sem saber que existe mais do
  // que um imóvel — quem escolhe QUAL settings entra em `data.settings` é
  // o `buildScoped()` em multiProperty.js, conforme o imóvel seleccionado.
  const residenciais = [
    {
      id: 'pinheiramar',
      tema: 'pinheiramar',
      nome: 'Residencial PinheiraMar', tipo: 'Apartamento',
      email: 'contato@pinheiramar.com.br', telefone: '48 98476-1800',
      cidade: 'Palhoça - Santa Catarina, Brasil',
      endereco: 'Rua Dom Patrício 82 - Praia da Pinheira', cep: '88.139-427',
      fuso: '(GMT-03:00) América/São Paulo', moeda: 'Real Brasileiro (R$)',
      sinalPct: 50, checkInHora: '13:00', checkOutHora: '10:00',
      politicas: {
        reservas: { titulo: 'Termos e Políticas de Hospedagem', texto: politicasReservasTexto },
        cancelamento: { titulo: 'Política de Cancelamento', texto: politicasCancelamentoTexto },
      },
      idiomas,
      // marca / home pública
      site: 'www.pinheiramar.com.br',
      regiaoLabel: 'na Praia da Pinheira',
      heroEyebrow: 'Praia da Pinheira · Palhoça · Santa Catarina',
      heroLine1: 'Apartamentos', heroLine2: 'à beira-mar,', heroAccent: 'do jeito certo.',
      heroSubtext: 'Apartamentos residenciais completos frente ao mar.',
      heroImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1800&q=85&auto=format&fit=crop',
    },
    {
      // NOTA para o Caio: nome provisório — muda em Admin → Configurações
      // assim que decidires o nome comercial deste imóvel. O resto
      // (morada exacta, CEP, e-mail próprio, se for o caso) também está
      // por confirmar — os campos ficaram com os mesmos contactos do
      // PinheiraMar como ponto de partida.
      id: 'novoimovel',
      tema: 'novoimovel',
      nome: 'Novo Residencial', tipo: 'Apartamento',
      email: 'contato@pinheiramar.com.br', telefone: '48 98476-1800',
      cidade: 'Palhoça - Santa Catarina, Brasil',
      endereco: '[morada a confirmar] - a 150m da Praia da Pinheira', cep: '',
      fuso: '(GMT-03:00) América/São Paulo', moeda: 'Real Brasileiro (R$)',
      sinalPct: 50, checkInHora: '13:00', checkOutHora: '10:00',
      politicas: {
        // Mesmas políticas do PinheiraMar, como pedido.
        reservas: { titulo: 'Termos e Políticas de Hospedagem', texto: politicasReservasTexto },
        cancelamento: { titulo: 'Política de Cancelamento', texto: politicasCancelamentoTexto },
      },
      idiomas,
      site: '',
      regiaoLabel: 'a 150m da Praia da Pinheira',
      heroEyebrow: 'A 150m da Praia da Pinheira · Palhoça · Santa Catarina',
      heroLine1: 'Apartamentos', heroLine2: 'a 150m da praia,', heroAccent: 'do jeito certo.',
      heroSubtext: 'Apartamentos residenciais completos, a poucos passos da Praia da Pinheira.',
      heroImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1800&q=85&auto=format&fit=crop',
    },
  ];

  const pagamentos = [
    {
      id: 'mercadopago', nome: 'Mercado Pago', cor: '#00B1EA', conectado: false,
      taxa: 'Pix 0% · Cartão à vista 3,79% · Parcelado até 4,99%',
      desc: ['Pix com confirmação instantânea (0% de taxa)', 'Parcelamento em até 12x sem juros para o hóspede', 'Link de pagamento por WhatsApp — sem app necessário', 'Recebimento: Pix imediato · Cartão D+14 ou D+2 (+1%)'],
      link: 'https://www.mercadopago.com.br/conta',
    },
    {
      id: 'pagseguro', nome: 'PagSeguro', cor: '#00A859', conectado: false,
      taxa: 'Pix 0% · Cartão à vista 3,99% · Parcelado até 4,99%',
      desc: ['Pix gratuito com QR Code por reserva', 'Parcelamento em até 12x sem juros', 'Conta digital PagBank integrada', 'Recebimento: Pix imediato · Cartão D+14'],
      link: 'https://pagseguro.uol.com.br',
    },
    {
      id: 'asaas', nome: 'Asaas', cor: '#1A56DB', conectado: false,
      taxa: 'Pix 1% (mín. R$1) · Cartão à vista 2,99% · Boleto R$3,00',
      desc: ['Especializado em cobranças recorrentes e links únicos', 'Emissão automática de boleto, Pix e cartão por reserva', 'API simples — ideal para integração com motor de reservas', 'Recebimento: Pix D+0 · Cartão D+2'],
      link: 'https://www.asaas.com',
    },
    {
      id: 'pix', nome: 'Pix Manual', cor: '#32BCAD', conectado: true,
      taxa: '0% — sem nenhuma taxa',
      desc: ['Hóspede transfere directamente para a sua chave Pix', 'Confirme o pagamento manualmente e actualize a reserva', 'Ideal para o sinal de 50% por WhatsApp', 'Chave recomendada: CNPJ ou telefone do residencial'],
      link: '',
    },
    {
      id: 'offline', nome: 'Pagamento presencial', cor: C.ocean, conectado: true,
      taxa: '0% — sem comissões',
      desc: ['Cartão na maquininha, dinheiro ou Pix no check-in', 'Ideal para o saldo de 50% restante na chegada', 'Sem necessidade de integração digital'],
      link: '',
    },
  ];
  const taxasAdicionais = [
    { id: 'tx1', nome: 'Vaga de Estacionamento p/ 1 Automóvel (taxa única)', preco: 50,  tipo: 'obrigatoria', por: 'reserva' },
    { id: 'tx2', nome: 'Higienização e Serviços de Hospedagem',               preco: 175, tipo: 'obrigatoria', por: 'reserva' },
    { id: 'tx3', nome: 'Quero levar meu Pet (taxa única)',                     preco: 200, tipo: 'opcional',    por: 'reserva' },
    { id: 'tx4', nome: 'Kit Praia (2 cadeiras + 1 Guarda Sol)',                preco: 75,  tipo: 'opcional',    por: 'reserva' },
    { id: 'tx5', nome: 'Vaga Adicional de Estacionamento',                     preco: 50,  tipo: 'opcional',    por: 'reserva' },
  ];
  const cupons = [
    { id: 'cup1', nome: 'Desconto Fidelidade', codigo: 'PINHEIRA10', tipo: 'percentagem', valor: 10, inicio: '2026-01-01', fim: '2026-12-31', usos: 0, maxUsos: 100, ativo: true },
  ];
  return { residenciais, apartamentos, seasons, reservas, pagamentos, taxasAdicionais, cupons };
}

/* ───────────────────────── Persistent storage ───────────────────────── */
// v5: introduz `residenciais` (multi-imóvel) e remove o antigo `settings`
// único — por isso muda a chave de versão, para forçar reseed em vez de
// carregar dados antigos com uma forma incompatível.
export const STORE_KEY = 'pinheiramar:data:v5';
export let memFallback = null;
export async function loadData() {
  try { if (window.storage) { const r = await window.storage.get(STORE_KEY); if (r && r.value) return JSON.parse(r.value); } }
  catch (e) { /* key absent → seed */ }
  return memFallback;
}
export async function saveData(d) {
  memFallback = d;
  try { if (window.storage) await window.storage.set(STORE_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
}
