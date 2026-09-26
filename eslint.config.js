// Verificação do código (npm run lint). Regras mínimas, para achar erros
// reais — nomes inexistentes, variáveis e imports esquecidos, hooks do React
// fora do sítio — sem impor estilo.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**', '**/.vs/**', '.preview-demo/**', 'brand-source/**', 'public/**', 'vite.config.js.timestamp-*'] },
  js.configs.recommended,
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, varsIgnorePattern: '^(React|_)', caughtErrors: 'none' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['api/**', 'server/**', 'tests/**', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
