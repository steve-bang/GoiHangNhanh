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

// Lớp API (src/api): chỉ api/firebase được import SDK Firebase; feature chỉ thấy hợp đồng và
// create-api (data), test của feature dùng '@/api/testing'. Xem conventions.md mục 3.
const FEATURE_API_PATTERNS = [
  {
    group: [
      '@/api/firebase',
      '@/api/firebase/**',
      '@/api/fake',
      '@/api/fake/**',
      '@/api/unavailable',
      '@/api/unavailable/**',
    ],
    message: 'Feature không import hiện thực API; dùng hợp đồng (@/api/contract) và cổng mặc định.',
  },
];

module.exports = [
  {
    ignores: ['node_modules/', '.expo/', 'dist/', 'coverage/', 'android/', 'ios/', 'docs/', 'web/'],
  },
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
            ...FEATURE_API_PATTERNS,
            {
              group: ['@/api/create-api', '@/api/testing'],
              message: 'domain chỉ import KIỂU từ @/api/contract.',
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
            ...FEATURE_API_PATTERNS,
          ],
        },
      ],
    },
  },
  // data/: dùng API qua hợp đồng; không import hiện thực hay SDK (SDK chỉ ở api/firebase).
  {
    files: ['src/features/*/data/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...COMMON_PATTERNS,
            ...FEATURE_API_PATTERNS,
            {
              group: ['@react-native-firebase/*', 'firebase', 'firebase/*'],
              message: 'data của feature không gọi Firebase; Firebase chỉ nằm ở src/api/firebase.',
            },
            { group: ['**/ui/**'], message: 'data không phụ thuộc ui.' },
          ],
        },
      ],
    },
  },
  // api/contract, api/fake, api/unavailable: không SDK, không biết feature.
  {
    files: ['src/api/contract/**/*.ts', 'src/api/fake/**/*.ts', 'src/api/unavailable/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...COMMON_PATTERNS,
            {
              group: INFRA_PACKAGES,
              message: 'Hợp đồng, bản giả và bản "chưa kết nối" là TypeScript thuần, không SDK.',
            },
            {
              group: ['@/features/**', '@/platform/**'],
              message: 'api không phụ thuộc feature hay platform.',
            },
          ],
        },
      ],
    },
  },
  // create-api và testing (src/api/*.ts): không biết feature, không import SDK Firebase.
  {
    files: ['src/api/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...COMMON_PATTERNS,
            {
              group: ['@react-native-firebase/*', 'firebase', 'firebase/*'],
              message: 'SDK Firebase chỉ được import trong src/api/firebase.',
            },
            {
              group: ['@/features/**', '@/platform/**'],
              message: 'api không phụ thuộc feature hay platform.',
            },
          ],
        },
      ],
    },
  },
  // api/firebase: nơi DUY NHẤT được import SDK Firebase; vẫn không biết feature.
  {
    files: ['src/api/firebase/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...COMMON_PATTERNS,
            {
              group: ['@/features/**', '@/platform/**'],
              message: 'api không phụ thuộc feature hay platform.',
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
  // Test Rules đối chiếu hình dạng tài liệu do MÃ ỨNG DỤNG dựng với Rules thật, nên được import sâu
  // vào domain thuần (không kéo theo UI/React).
  {
    files: ['firebase/tests/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
];
