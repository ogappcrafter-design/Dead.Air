const js = require('@eslint/js');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');

/**
 * Flat config, no plugins.
 *
 * Globals are declared inline rather than pulling in the `globals` package —
 * this list is short and it keeps the dev dependency tree small. (The file
 * that used to sit at the repo root under the name "UPDATE FILE" was a
 * corrupted attempt at this config, with stray characters through the imports;
 * it was never wired up to anything.)
 */
const RUNTIME_GLOBALS = {
  console: 'readonly',
  fetch: 'readonly',
  AbortController: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  Set: 'readonly',
  Map: 'readonly',
  Promise: 'readonly',
  Date: 'readonly',
  Math: 'readonly',
  JSON: 'readonly',
  Number: 'readonly',
  String: 'readonly',
  Array: 'readonly',
  Object: 'readonly',
  Error: 'readonly',
  process: 'readonly',
  __DEV__: 'readonly',
  // Metro resolves require() for static assets even in ES modules.
  require: 'readonly',
};

module.exports = [
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'web-build/**', 'proxy/node_modules/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: RUNTIME_GLOBALS,
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      // Without these two, base no-unused-vars reports every imported
      // component as unused — JSX references don't count as usage to espree.
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // CommonJS: the proxy service, the Jest mocks, and the configs themselves.
    files: [
      'proxy/**/*.js',
      '__tests__/__mocks__/**/*.js',
      'eslint.config.js',
      'babel.config.js',
      'app.config.js',
    ],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...RUNTIME_GLOBALS, module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
  },
  {
    files: ['__tests__/**/*.js'],
    languageOptions: {
      globals: {
        ...RUNTIME_GLOBALS,
        __dirname: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
];
