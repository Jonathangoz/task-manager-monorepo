// frontend/task-manager-frontend/.eslintrc.js
module.exports = {
  extends: [
    '../../.eslintrc.js',
    'next/core-web-vitals'
  ],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/no-unescaped-entities': 'off',
    '@next/next/no-page-custom-font': 'off',
    'react/display-name': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'prettier/prettier': 'error',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: [
    '.next/',
    'out/',
    'coverage/',
    'node_modules/',
    '*.config.js',
    '*.config.mjs',
    '*.config.ts',
    'tailwind.config.ts',
    'postcss.config.js'
  ]
};