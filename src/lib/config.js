// Configuração lida do build (variáveis VITE_…). Sem importar o supabase-js,
// para o site público não carregar a biblioteca à toa — só o painel a usa.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabaseConfigurado = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Modo demonstração (dados fictícios guardados só neste navegador): no
// `npm run dev` sem Supabase, ou em builds de prévia com VITE_MODO_DEMO=1.
// Um build de produção SEM Supabase configurado nunca cai aqui — mostra um
// aviso de manutenção em vez de aceitar reservas que ninguém ia ver.
// VITE_MODO_DEMO=1 força a demonstração mesmo que as chaves do Supabase
// estejam definidas (ex.: previews da Vercel com as variáveis de produção).
export const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === '1' || (!supabaseConfigurado && !!import.meta.env.DEV);
export const SEM_CONFIG = !supabaseConfigurado && !MODO_DEMO;

// Previews da Vercel: pôr VITE_AMBIENTE=teste só no ambiente "Preview" para
// aparecer uma faixa "ambiente de testes" (e lembrar que não é o site real).
export const AMBIENTE_TESTE = import.meta.env.VITE_AMBIENTE === 'teste';
