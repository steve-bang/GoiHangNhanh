/* Ca lint âm tính (V1-10): import dữ liệu minh họa bị chặn ở mọi lớp của app, kể cả test. */
/* global describe, it, expect */
const path = require('node:path');
const { ESLint } = require('eslint');

const ROOT = path.resolve(__dirname, '..');
// Nạp cấu hình bằng require (Jest không hỗ trợ import động mà ESLint dùng để tự đọc eslint.config.js).
const eslint = new ESLint({
  cwd: ROOT,
  overrideConfigFile: true,
  overrideConfig: require('../eslint.config.js'),
});

const lint = async (relPath, code) => {
  const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, relPath) });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports');
};

describe('ESLint: cấm import @/shared/fixtures/illustrative-data (V1-10)', () => {
  const files = [
    'src/features/home/ui/Example.tsx',
    'src/features/upload/domain/example.ts',
    'src/features/orders/data/example.ts',
    'src/shared/ui/Example.tsx',
    'src/features/home/ui/Example.test.tsx',
  ];
  it.each(files)(
    '%s: báo lỗi',
    async (file) => {
      const messages = await lint(
        file,
        "import { X } from '@/shared/fixtures/illustrative-data';\nexport const y = X;\n",
      );
      expect(messages.map((m) => m.message).join('\n')).toMatch(/dữ liệu minh họa/);
    },
    60000,
  );

  it('import khác không bị ảnh hưởng', async () => {
    const messages = await lint(
      'src/features/home/ui/Example.tsx',
      "import { ROUTES } from '@/core/navigation';\nexport const y = ROUTES;\n",
    );
    expect(messages).toEqual([]);
  }, 60000);
});
