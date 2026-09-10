// Cliente Supabase — é o que permite os dados (reservas, apartamentos,
// temporadas, etc.) ficarem sincronizados entre dispositivos, em vez de
// cada navegador ter a sua própria cópia isolada em localStorage.
//
// Configuração (ver .env.example):
//   1. Crie um projeto grátis em https://supabase.com
//   2. Em Project Settings → API, copie o "Project URL" e a chave pública
//      "anon public" (NÃO a "service_role", essa é secreta).
//   3. Copie .env.example para ".env" e preencha as duas variáveis abaixo
//      para testar localmente com "npm run dev".
//   4. Adicione as mesmas duas variáveis em Vercel → Settings →
//      Environment Variables, e faça um novo deploy, para funcionar no
//      site publicado.
//   5. No SQL Editor do Supabase, execute o ficheiro supabase-setup.sql
//      (na raiz do projeto) para criar a tabela e as permissões.
//
// Enquanto estas variáveis não estiverem definidas, ou o Supabase estiver
// inacessível no momento, o site continua a funcionar normalmente com
// localStorage apenas neste dispositivo (ver seed.js) — nada quebra, só a
// sincronização entre dispositivos fica indisponível.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(URL && ANON_KEY);
export const supabase = supabaseConfigured ? createClient(URL, ANON_KEY) : null;

// Todo o estado do site vive numa única linha desta tabela (mesma "forma"
// que antes vivia sozinha no localStorage) — ver supabase-setup.sql.
export const APP_STATE_TABLE = 'app_state';
export const APP_STATE_ROW_ID = 'main';
