// Hai project: `unit` (mã ứng dụng, preset jest-expo) và `rules` (Security Rules, chạy trong Node
// cùng Firebase Emulator - xem script `test:rules`).
module.exports = {
  // Hạn mỗi test đặt ở gốc: Jest 30 (jest-circus) chỉ đọc `testTimeout` của globalConfig, bỏ qua giá
  // trị đặt trong từng project. 30 giây đủ cho suite giao diện nặng khi máy tải cao và cho test Rules
  // trên Emulator, vẫn bắt được test treo thật.
  testTimeout: 30000,
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
      testMatch: ['<rootDir>/eslint-rules/**/*.test.js', '<rootDir>/scripts/**/*.test.{js,cjs}'],
    },
    {
      displayName: 'rules',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/firebase/tests/**/*.test.ts'],
      // Một bản firebase-admin duy nhất (của functions/) cho test và mã Function.
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^firebase-admin/(.*)$': '<rootDir>/firebase/functions/node_modules/firebase-admin/lib/$1',
      },
      transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
    },
  ],
};
