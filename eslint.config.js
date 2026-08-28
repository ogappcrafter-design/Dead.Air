const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
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
      'docs/marketing/**',
    ],
  },
  // @typescript-eslint/recommended (flat)
  ...tsPlugin.configs['flat/recommended'],
  // react plugin (needed so eslint-config-prettier can disable react rules)
  {
    plugins: { react: reactPlugin },
  },
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react/no-array-index-key': 'off',
    },
  },
  // Allow require() in jest setup files and test files (dynamic module loading)
  {
    files: ['jest.setup.js', 'jest.setup-after-env.js', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
