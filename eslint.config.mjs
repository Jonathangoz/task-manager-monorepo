// /eslint.config.mjs
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

// Configuración base que puede ser reutilizada
export const baseConfig = [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: true,
      },
      globals: {
        // Globales de Node.js
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        // Tipos de Node.js
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
    },
    rules: {
      // Reglas básicas de TypeScript ESLint
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // Reglas de Prettier
      'prettier/prettier': 'error',

      // Reglas generales
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-unused-vars': 'off', // Desactivamos la regla base para usar la de TypeScript
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-useless-escape': 'error',
      'no-prototype-builtins': 'error',
    },
  },
  prettierConfig,
];

// Ignores globales
export const globalIgnores = {
  ignores: [
    '**/dist/',
    '**/node_modules/',
    '**/coverage/',
    '**/build/',
    '**/*.js.map',
    '**/prisma/migrations/',
    '**/.env*',
    '**/docker-compose*.yml',
  ],
};

export default [...baseConfig, globalIgnores];
