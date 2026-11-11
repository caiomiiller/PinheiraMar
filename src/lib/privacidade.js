// Política de Privacidade (LGPD — Lei 13.709/2018) do Grupo PinheiraMar.
// Descreve o que o site e o servidor realmente fazem hoje: se isto mudar
// (por exemplo, uma ferramenta de medição de visitas, novos campos no
// formulário ou outro fornecedor), este texto precisa mudar junto.
export const PRIVACIDADE_ATUALIZADA_EM = '11 de novembro de 2026';

export function secoesPrivacidade({ email, telefone } = {}) {
  const contato = [email, telefone].filter(Boolean).join(' · ') || 'o WhatsApp indicado no rodapé do site';
  return [
    {
      id: 'quem',
      titulo: 'Quem é responsável pelos seus dados',
      texto: 'O Grupo PinheiraMar (Residencial PinheiraMar e Residencial Caminho do Mar, Praia da Pinheira, Palhoça/SC) decide como os dados da sua reserva são usados. '
        + `Para qualquer assunto sobre privacidade, fale com a gente: ${contato}.`,
    },
    {
      id: 'dados',
      titulo: 'Quais dados coletamos',
      texto: 'Ao reservar, pedimos nome completo, e-mail e telefone. Também guardamos o que a reserva envolve: apartamento, datas, número de hóspedes, valores e a situação do pagamento. '
        + 'Se você nos escrever pelo WhatsApp, guardamos a conversa no nosso aparelho. '
        + 'Não pedimos CPF nem documento no site, e não temos acesso aos dados do seu cartão: o pagamento é feito no ambiente do Mercado Pago.',
    },
    {
      id: 'uso',
      titulo: 'Para que usamos',
      texto: 'Usamos os dados só para cuidar da sua hospedagem: registrar a reserva, receber o sinal, enviar a confirmação por e-mail, falar com você sobre a estadia e cumprir obrigações legais e fiscais. '
        + 'Isso se apoia na execução do contrato de hospedagem e no cumprimento de obrigação legal (LGPD, art. 7º, incisos V e II). Não usamos seus dados para publicidade nem os vendemos.',
    },
    {
      id: 'compartilhamento',
      titulo: 'Com quem os dados passam',
      texto: 'Para o site funcionar, os dados passam por empresas que prestam serviço a nós: Mercado Pago (pagamento), Supabase (banco de dados da reserva), Vercel (hospedagem do site) e EmailJS (envio do e-mail de confirmação). '
        + 'Algumas delas funcionam em servidores fora do Brasil; nesses casos o envio é necessário para prestar o serviço contratado. '
        + 'Fora isso, só compartilhamos dados se a lei exigir.',
    },
    {
      id: 'navegador',
      titulo: 'O que fica no seu navegador',
      texto: 'Guardamos no seu aparelho os apartamentos que você marca com o coração e, até você fechar a aba, o resumo da sua última reserva para a tela de confirmação. '
        + 'Não usamos cookies de publicidade nem ferramentas de medição de visitas. As fontes do site são carregadas dos servidores do Google, que recebem o endereço IP de quem visita.',
    },
    {
      id: 'prazo',
      titulo: 'Por quanto tempo guardamos',
      texto: 'Pelo tempo necessário para a reserva e a estadia e, depois, pelo prazo exigido por obrigações legais e fiscais e para nos defendermos em eventual disputa. Passado esse prazo, os dados são apagados ou anonimizados.',
    },
    {
      id: 'direitos',
      titulo: 'Seus direitos',
      texto: 'Você pode pedir a qualquer momento: confirmação de que tratamos seus dados, acesso a eles, correção de dados errados, apagamento ou anonimização quando não forem mais necessários, '
        + 'portabilidade, informação sobre com quem compartilhamos e a revogação de consentimento, quando for o caso (LGPD, art. 18). '
        + `É só escrever para ${contato}. Se achar que não resolvemos, você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).`,
    },
    {
      id: 'seguranca',
      titulo: 'Segurança',
      texto: 'O site usa conexão segura (HTTPS) e o painel de gestão, onde ficam os dados das reservas, só abre com login. Nenhum sistema é totalmente imune a falhas; se houver um incidente que possa afetar você, avisaremos como a lei determina.',
    },
    {
      id: 'mudancas',
      titulo: 'Mudanças neste texto',
      texto: `Quando algo mudar na forma como tratamos os dados, atualizamos esta página. Última atualização: ${PRIVACIDADE_ATUALIZADA_EM}.`,
    },
  ];
}
