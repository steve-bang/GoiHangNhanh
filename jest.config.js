// Hai project: `unit` (mã ứng dụng, preset jest-expo) và `rules` (Security Rules, chạy trong Node
// cùng Firebase Emulator - xem script `test:rules`).
module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
      setupFiles: ['<rootDir>/jest.setup.ts'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    {
      displayName: 'tooling',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/eslint-rules/**/*.test.js'],
    },
    {
      displayName: 'rules',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/firebase/tests/**/*.test.ts'],
      transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
      testTimeout: 30000,
    },
  ],
};
