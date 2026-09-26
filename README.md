# PinheiraMar — site de reservas e painel de gestão

Site público de reservas dos residenciais do Grupo PinheiraMar (PinheiraMar e
Caminho do Mar) e painel de gestão em `?gestao`.

## Como funciona

```
Navegador do hóspede ──► /api/estado-publico   (apartamentos, preços, datas ocupadas — sem dados pessoais)
                    └──► /api/reservar         (o servidor confere tudo, calcula o preço e grava)
                              │
Mercado Pago ─────────► /api/mp-webhook        (confirma o pagamento e envia o e-mail)
                              │
Painel (?gestao) ─────► Supabase (login + dados, só para e-mails da tabela admins)
                   └──► /api/admin/enviar-confirmacao
```

- **Dados**: Supabase, tabela `app_state`, linha `main` (um JSON com
  residenciais, apartamentos, temporadas, taxas e reservas). A coluna
  `versao` faz com que duas gravações ao mesmo tempo não se apaguem: quem
  grava depois relê e reaplica a sua alteração (`server/estado.js`,
  `src/lib/dadosAdmin.js`).
- **Site público** (`src/views/public`): não fala com o Supabase; lê pelo
  servidor e pede a reserva ao servidor. Nunca recebe nome/e-mail/telefone de
  outros hóspedes.
- **Regras partilhadas** (`src/lib/precos.js`, `src/lib/reservas.js`): o mesmo
  código calcula o preço no ecrã e no servidor — o valor cobrado sai sempre do
  servidor.
- **Funções da Vercel** (`api/`) com o código comum em `server/`.
- **E-mails**: só pelo servidor (EmailJS com chave privada).
- **Painel**: login com e-mail e senha do Supabase Auth; só entra quem está na
  tabela `admins` (ver `supabase/01-seguranca.sql`).

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Onde | Para quê |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Production | Login e dados do painel (chave pública). |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | **Secreta.** As funções de `api/` leem e gravam o banco. |
| `MP_ACCESS_TOKEN` | Production | **Secreta.** Mercado Pago (sem ela, as reservas seguem pelo fluxo manual). |
| `VITE_EMAILJS_PUBLIC_KEY`, `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID` | Production | EmailJS (usadas só pelo servidor). |
| `EMAILJS_PRIVATE_KEY` | Production | **Secreta.** Chave privada do EmailJS. |
| `SITE_URL` | Production (opcional) | Domínio para os retornos do Mercado Pago, ex. `https://www.pinheiramar.com.br`. |
| `VITE_AMBIENTE=teste` | Preview | Mostra a faixa "ambiente de testes". |
| `VITE_MODO_DEMO=1` | Preview (opcional) | Site com dados fictícios, sem banco. |

Nunca ponha uma chave secreta numa variável que comece por `VITE_` (essas vão
parar ao navegador).

**Preview × Production.** A Vercel aplica cada variável a *todos* os ambientes
se não disser o contrário — e cada `git push` de uma branch cria um Preview.
Ao criar/editar as variáveis secretas (`SUPABASE_SERVICE_ROLE_KEY`,
`MP_ACCESS_TOKEN`, `EMAILJS_PRIVATE_KEY`), deixe marcado **só Production**. Para
testar telas num Preview sem tocar nos dados reais, ponha lá
`VITE_MODO_DEMO=1` (força a demonstração, mesmo que as chaves do Supabase
existam) e `VITE_AMBIENTE=teste`.

## Publicar a revisão de 2026-09 (fazer por esta ordem)

1. **Backup**: no painel atual, Reservas → Base de dados → *Backup completo (JSON)*.
2. **Vercel → Environment Variables** (só *Production*, ver acima): acrescentar
   `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API → *service_role*)
   e `EMAILJS_PRIVATE_KEY` (EmailJS → Account → API keys).
3. **EmailJS → Account → Security**: ligar *Allow EmailJS API for
   non-browser applications*. (Ainda **não** ligue *Use Private Key* nem troque o
   template — o site atual ainda envia pelo navegador.)
4. **Supabase → Authentication → Users → Add user**: criar o seu usuário
   (e-mail + senha). Em *Sign In / Providers*, desligar *Allow new users to sign up*
   (o acesso ao painel confia no e-mail da conta — ninguém pode poder criar contas).
5. **Fechar o painel antigo** em todos os computadores/celulares (a versão
   antiga grava o banco inteiro de uma vez) e **publicar o código** (merge da
   branch `correcoes-revisao` para `master` — leva também os 2 commits da
   `mobile-v2` — e a Vercel publica sozinha). Conferir: o site abre, os
   apartamentos e as datas ocupadas aparecem, e o painel `?gestao` entra com o
   e-mail e a senha do passo 4.
   (Até ao passo 6, *Reenviar e-mail* avisa que falta a configuração — é normal.)
6. **Supabase → SQL Editor** (logo a seguir ao passo 5): abrir
   `supabase/01-seguranca.sql`, trocar `SEU-EMAIL-AQUI@exemplo.com` pelo(s)
   e-mail(s) do painel e executar. A partir daqui a chave pública deixa de ler ou
   gravar o banco.
7. **EmailJS**: colar o novo `template-emailjs-confirmacao.html` no template
   (instruções no próprio arquivo) e, em Account → Security, ligar *Use Private Key*.
8. **Conferir**: no painel, abrir uma reserva com e-mail e usar *Reenviar e-mail*
   (com o Mercado Pago ligado, uma reserva nova pelo site só envia e-mail depois
   de o sinal ser pago); fazer uma reserva de teste pelo site e cancelá-la no painel.

**Para desfazer**: Vercel → Deployments → *Promote to Production* no deploy
anterior; e, se o passo 6 já tiver sido feito, executar
`supabase/01-seguranca-desfazer.sql` (volta a política antiga — o site antigo
precisa dela). Se o template do EmailJS já tiver sido trocado (passo 7), cole
de volta o anterior e desligue *Use Private Key*.

## Rotina

- **Temporadas**: o site só aceita datas até ao fim da última temporada ativa
  (Opções de preços). Cadastre as próximas temporadas antes de chegar lá.
- **Backups**: Reservas → Base de dados → *Backup completo (JSON)*. Restaurar
  pede confirmação e baixa antes uma cópia dos dados atuais.
- **Reservas provisórias do site** (à espera do pagamento) seguram as datas por
  30 minutos; sem pagamento, saem sozinhas da lista depois de 24 horas. Cada
  hóspede (e-mail ou telefone) pode ter no máximo 3 reservas do site à espera
  de pagamento ao mesmo tempo.
- **Avisos no Painel**: pagamento a menos do que o sinal, estorno/contestação e
  pagamento que chegou para datas já ocupadas aparecem no topo do Painel.

## Desenvolvimento

```bash
npm install
npm run dev      # sem .env: modo demonstração (dados fictícios no navegador)
npm test         # testes (preços, reservas, webhook, gravação com versão, traduções…)
npm run lint     # verificação do código
npm run build
```

A biblioteca do Excel (`xlsx` 0.18.5, só usada no painel para importar e
exportar planilhas) tem avisos de segurança conhecidos para arquivos maliciosos.
Como só o gestor importa as próprias planilhas, o risco é baixo; para atualizar:
`npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
