import base from '../../eslint.config.mjs';

export default [
  ...base,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        // Lets consistent-type-imports keep value imports that decorator metadata needs.
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },
  {
    // Nest decorators return `any`-typed factories; the recommendedTypeChecked rules would flag
    // every @Module/@Controller/@Get usage otherwise.
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
];
