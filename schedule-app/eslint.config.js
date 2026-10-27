import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'dev-dist',
    '**/dev-dist',
    'backups',
    '.local',
    '.tmp-v2-navigation-build',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        __APP_VERSION__: 'readonly', // injected by Vite `define`
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Empty catch = intentional "best effort" (localStorage, cache, etc.)
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', {
        caughtErrors: 'none',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      // Advisory for the React Compiler, which this project does not enable —
      // manual useMemo is our only memoization, so keeping it is correct.
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  {
    // Entry point — has no exports by design; fast refresh never applies here
    files: ['src/main.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Build config runs under Node, not the browser
    files: ['vite.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
])
