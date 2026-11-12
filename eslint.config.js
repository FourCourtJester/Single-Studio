import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      // The two rules v5's recommended set held, named rather than spread. v7's set
      // adds the React Compiler's rules, which found 25 problems across 20 files of
      // core on adoption -- set-state-in-effect 15, refs 6, purity 2,
      // static-components 2 -- many in the timing of Fit, Sequence and Slideshow.
      // Taking them is a refactor of graphics that are on air, not a dependency bump;
      // it is queued in docs/internal/next.md.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    // SharedWorker entrypoints run without a window.
    files: ['**/*.worker.js', '**/velcro/host.js'],
    languageOptions: { globals: { ...globals.worker } },
  },
  {
    // Test harnesses and scripts run under Node.
    files: ['**/e2e/**/*.mjs', '**/*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // The relay's Cloudflare adapter runs on workerd, which has its own globals.
    files: ['packages/relay/src/worker.js'],
    languageOptions: { globals: { ...globals.worker, WebSocketPair: 'readonly' } },
  },
]
