const reactPlugin = require('eslint-plugin-react');
const importPlugin = require('eslint-plugin-import');
const globals = require('globals');

module.exports = [
  {
    files: ['src/**/*.js'],
    plugins: {
      react: reactPlugin,
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        __DEV__: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.json'],
        },
      },
    },
    rules: {
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
      'import/named': 'error',
      'import/default': 'error',
      'import/no-unresolved': ['error', { commonjs: true, caseSensitive: true }],
      'import/no-named-as-default': 'warn',
    },
  },
];

