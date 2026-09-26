// Cliente Supabase do NAVEGADOR — usado só pelo painel de gestão (login com
// e-mail/senha do Supabase Auth e leitura/gravação do estado como
// administrador). O site público não fala com o Supabase diretamente: lê
// pelo servidor (/api/estado-publico) e reserva por /api/reservar.
//
// Configuração: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ver .env.example)
// e o SQL de supabase/01-seguranca.sql.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigurado } from './config';

export const supabaseConfigured = supabaseConfigurado;
export const supabase = supabaseConfigurado
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pinheiramar:sessao-painel' } })
  : null;

// Todo o estado vive numa única linha desta tabela.
export const APP_STATE_TABLE = 'app_state';
export const APP_STATE_ROW_ID = 'main';
