import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        document: 'readonly',
        window: 'readonly',
        globalThis: 'readonly',
        fetch: 'readonly',
        XMLHttpRequest: 'readonly',
        Response: 'readonly',
        HTMLElement: 'readonly',
        Image: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off',
      curly: ['error', 'all'],
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/coverage/**',
      '**/*.min.js',
      'pnpm-lock.yaml',
      '**/tests/**',
      '**/*.test.ts',
      '**/*.test.js',
      '**/*.md',
    ],
  },
  {
    files: ['apps/demo/**/*.js'],
    languageOptions: {
      globals: {
        BugSpotter: 'readonly',
        rrwebPlayer: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        alert: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        event: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-undef': 'off',
    },
  }
);
