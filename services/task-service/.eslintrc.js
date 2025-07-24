// services/task-service/.eslintrc.js
module.exports = {
  extends: ['../../.eslintrc.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: [
    'dist/',
    'coverage/',
    'prisma/migrations/',
    '__tests__/fixtures/'
  ]
};