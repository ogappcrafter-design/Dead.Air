const tsPlugin = require('@typescript-eslint/eslint-plugin');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'coverage/**',
      '.tokensave/**',
      '.autobots-state/**',
      'eslint.config.js',
    ],
  },
  // @typescript-eslint/recommended (flat)
  ...tsPlugin.configs['flat/recommended'],
  // prettier: turn off conflicting rules
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
