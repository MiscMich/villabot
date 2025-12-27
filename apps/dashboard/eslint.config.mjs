import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      // Type safety rules
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Allow explicit type assertions where needed
      '@typescript-eslint/consistent-type-assertions': 'off',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**'],
  }
);
