/* Test cho rule `design-tokens/no-raw-design-values` (docs/design-token-spec.md mục 7). */
const path = require('node:path');
const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const plugin = require('./design-tokens.cjs');

const rule = plugin.rules['no-raw-design-values'];
const ROOT = path.resolve(__dirname, '..');
const inScope = path.join(ROOT, 'src/features/orders/ui/Example.tsx');
const outOfScope = path.join(ROOT, 'src/features/shop/ui/SignInScreen.tsx');
const frozenShared = path.join(ROOT, 'src/shared/ui/Button.tsx');

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const bad = (code, messageId, filename = inScope) => ({ code, filename, errors: [{ messageId }] });

tester.run('design-tokens/no-raw-design-values', rule, {
  valid: [
    // token + giá trị tính toán + 0 + opacity 1
    {
      code: 'const s = { padding: tokens.space.lg, gap: 0, opacity: pressed ? tokens.opacity.pressed : 1 };',
      filename: inScope,
    },
    {
      code: 'const s = { minHeight: Math.max(touch, tokens.component.field.minHeight) };',
      filename: inScope,
    },
    {
      code: 'const s = { width: size, height: size * 2, borderRadius: size / 2 };',
      filename: inScope,
    },
    // ngoại lệ có lý do
    {
      code: '// token-exception: màu thương hiệu của sàn, không thuộc palette\nconst s = { backgroundColor: "#4B3FD8" };',
      filename: inScope,
    },
    // màn ngoài phạm vi: không kiểm tra
    { code: 'const s = { padding: 14, color: "#123456", fontSize: 17 };', filename: outOfScope },
    // tệp test không kiểm tra
    {
      code: 'const s = { padding: 14 };',
      filename: path.join(ROOT, 'src/features/orders/ui/Example.test.tsx'),
    },
    // tệp dùng chung với màn đã verify vẫn được đọc bảng cũ
    { code: 'const { colors, spacing } = useTheme();', filename: frozenShared },
  ],
  invalid: [
    bad('const s = { padding: 14 };', 'number'),
    bad('const s = { gap: -8 };', 'number'),
    {
      code: 'const s = { borderRadius: sel ? 12 : 8 };',
      filename: inScope,
      errors: [{ messageId: 'number' }, { messageId: 'number' }],
    },
    bad('const s = { minHeight: Math.max(touch, 52) };', 'number'),
    bad('const s = { opacity: 0.85 };', 'number'),
    bad('const s = { paddingTop: tokens.space.sm + 2 };', 'number'),
    bad('const s = { borderWidth: 1 };', 'number'),
    bad('const s = { fontSize: 15 };', 'number'),
    bad('const s = { fontWeight: "700" };', 'weight'),
    bad('const s = { backgroundColor: "#157852" };', 'color'),
    bad('const s = { borderColor: sel ? "#fff" : tokens.color.border.default };', 'color'),
    bad('const s = { shadowColor: "rgba(0,0,0,0.5)" };', 'color'),
    bad('const c = "#E2A95C";', 'color'),
    bad('const x = <Icon color="#FFFFFF" />;', 'color'),
    bad('const { colors } = useTheme();', 'legacy'),
    {
      code: 'const { spacing, radius } = useTheme();',
      filename: inScope,
      errors: [{ messageId: 'legacy' }, { messageId: 'legacy' }],
    },
    bad('import { colors } from "@/core/theme";', 'directImport'),
    bad('import { palette } from "@/core/theme/primitives";', 'directImport'),
    bad('const c = semantic.color.text.primary;', 'staticColor'),
    // ngoại lệ thiếu lý do
    bad('// token-exception: ngắn\nconst s = { padding: 14 };', 'badException'),
    // tệp dùng chung với màn đã verify vẫn bị chặn literal
    bad('const s = { padding: 14 };', 'number', frozenShared),
  ],
});
