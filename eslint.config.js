import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', localStorage: 'readonly',
        performance: 'readonly', requestAnimationFrame: 'readonly',
        navigator: 'readonly', KeyboardEvent: 'readonly', MouseEvent: 'readonly',
        WheelEvent: 'readonly', Float32Array: 'readonly', Int32Array: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
];
