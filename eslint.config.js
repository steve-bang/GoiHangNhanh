// ESLint flat config. Quy tắc lớp/import: xem docs/engineering/conventions.md.
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const designTokens = require('./eslint-rules/design-tokens.cjs');

// Thư viện chỉ được phép ở lớp data/platform, không được vào domain (domain là TypeScript thuần).
const INFRA_PACKAGES = [
  'react',
  'react-native',
  'react-native-*',
  'expo',
  'expo-*',
  '@react-native-firebase/*',
  'firebase',
  'firebase/*',
  '@react-native/*',
];

// Mẫu chung; mỗi khối override phải liệt kê lại (flat config thay thế, không gộp, cấu hình rule).
const COMMON_PATTERNS = [
  {
    group: ['@/features/*/*'],
    message:
      'Chỉ import feature khác qua public API (@/features/<tên>), không import sâu vào domain/data/ui.',
  },
  {
    group: ['../../../*'],
    message: 'Dùng alias @/ thay cho đường dẫn tương đối nhiều cấp.',
  },
];

module.exports = [
  { ignores: ['node_modules/', '.expo/', 'dist/', 'coverage/', 'android/', 'ios/', 'docs/'] },
  ...expoConfig,
  prettierConfig,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-console': 'error', // dùng src/core/logging (không log PII)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-restricted-imports': ['error', { patterns: COMMON_PATTERNS }],
    },
  },
  // Chuỗi UI không hard-code: mọi văn bản trong JSX phải đi qua i18n (t('...')).
  {
    files: ['src/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/\\S/]',
          message:
            'Không hard-code chuỗi UI trong JSX; dùng t("...") và thêm khóa vào src/core/i18n/locales/vi.',
        },
      ],
    },
  },
  // domain/: TypeScript thuần, không phụ thuộc framework, Firebase, data hay ui.
  {
    files: ['src/features/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...COMMON_PATTERNS,
            {
              group: INFRA_PACKAGES,
              message:
                'domain/core là TypeScript thuần: không import React, React Native, Expo hoặc Firebase. Đặt adapter ở data/ hoặc platform/.',
            },
            {
              group: ['**/data/**', '**/ui/**', '@/platform/**'],
              message: 'domain không phụ thuộc data, ui hay platform.',
            },
          ],
        },
      ],
    },
  },
  // core/: TypeScript thuần dùng chung, không biết feature cụ thể.
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...COMMON_PATTERNS,
            {
              group: INFRA_PACKAGES,
              message:
                'core là TypeScript thuần: không import React, React Native, Expo hoặc Firebase.',
            },
            { group: ['@/features/**'], message: 'core không phụ thuộc feature.' },
          ],
        },
      ],
    },
  },
  // Cô lập: ui/ không gọi thẳng SDK Firebase; qua data/ hoặc platform/.
  {
    files: ['src/features/*/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...COMMON_PATTERNS,
            {
              group: ['@react-native-firebase/*', 'firebase', 'firebase/*'],
              message: 'ui không gọi Firebase trực tiếp; đi qua hook/repository ở data/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['eslint-rules/**/*.js', 'eslint-rules/**/*.cjs', 'scripts/**/*.cjs'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: { 'no-console': 'off' },
  },
  // Design Token: chặn giá trị thiết kế viết thẳng trong giao diện (phạm vi: scripts/design-token-scope.cjs).
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'design-tokens': designTokens },
    rules: { 'design-tokens/no-raw-design-values': 'error' },
  },
  // Test được phép dùng devDependencies; test Rules chạy trong Node.
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'firebase/tests/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
];
