// /services/task-service/eslint.config.mjs
import { baseConfig } from '../../eslint.config.mjs';

// Configuración específica para task-service
const authServiceConfig = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Sobrescribir reglas específicas para este servicio
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'warn', // Más permisivo temporalmente
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          // Permitir variables no usadas que empiecen con underscore
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Archivos específicos con reglas más permisivas
    files: [
      'src/scripts/**/*.ts',
      'src/utils/swagger.ts',
      'src/config/environment.ts',
    ],
    rules: {
      'no-console': 'off', // Permitir console en scripts y configuración
    },
  },
  {
    // Ignores específicos para este servicio
    ignores: [
      'dist/',
      'coverage/',
      'prisma/migrations/',
      '__tests__/fixtures/',
      '*.config.js',
    ],
  },
];

export default [...baseConfig, ...authServiceConfig];
