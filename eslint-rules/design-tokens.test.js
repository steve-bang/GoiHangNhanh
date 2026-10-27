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
    // phép tính trên biến không phải token, tên màu trong ngữ cảnh không phải màu
    {
      code: 'const s = { width: size * 0.55, height: size / 2, top: insets.top + inset, zIndex: 0 };',
      filename: inScope,
    },
    {
      code: 'const s = { color: tokens.color.text.primary, borderColor: "transparent" };',
      filename: inScope,
    },
    {
      code: 'const s = { fontWeight: cond ? tokens.fontWeight.bold : tokens.fontWeight.regular };',
      filename: inScope,
    },
    {
      code: 'const s = { testID: "white", label: "red", transform: [{ scale: 1 }] };',
      filename: inScope,
    },
    {
      code: 'const s = { transform: [{ rotate: `${deg}deg` }, { translateY: offset }] };',
      filename: inScope,
    },
    { code: 'const u = `${base}/path#section`; const k = `item-${id}`;', filename: inScope },
    { code: 'const s = { top: tokens.space.md, aspectRatio: ratio };', filename: inScope },
    // màn ngoài phạm vi: không kiểm tra
    {
      code: 'const s = { padding: 14, color: "red", top: 3, fontWeight: "700", c: `#fff`, color: "#123456", fontSize: 17 };',
      filename: outOfScope,
    },
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
    // tên màu CSS
    bad('const s = { color: "red" };', 'color'),
    bad('const s = { backgroundColor: "White" };', 'color'),
    bad('const s = { borderColor: sel ? "white" : tokens.color.border.default };', 'color'),
    bad('const x = <Icon color="red" />;', 'color'),
    bad('const x = <Icon color={dark ? "black" : tokens.color.text.primary} />;', 'color'),
    // nhân/chia token với số thô, hằng số tính sẵn
    bad('const s = { padding: tokens.space.sm * 2 };', 'number'),
    bad('const s = { gap: layout.space.sm / 2 };', 'number'),
    bad('const s = { margin: 2 * theme.tokens.space.sm };', 'number'),
    {
      code: 'const s = { paddingTop: tokens.space.sm * 2 + 1 };',
      filename: inScope,
      errors: [{ messageId: 'number' }, { messageId: 'number' }],
    },
    bad('const s = { aspectRatio: 16 / 9 };', 'number'),
    // fontWeight đi qua điều kiện / số
    {
      code: 'const s = { fontWeight: cond ? "700" : "400" };',
      filename: inScope,
      errors: [{ messageId: 'weight' }, { messageId: 'weight' }],
    },
    bad('const s = { fontWeight: 700 };', 'weight'),
    // vị trí, lớp, tỉ lệ, transform
    bad('const s = { top: 8 };', 'number'),
    bad('const s = { left: -4 };', 'number'),
    bad('const s = { right: insets.right + 12 };', 'number'),
    bad('const s = { bottom: 10 };', 'number'),
    bad('const s = { zIndex: 10 };', 'number'),
    bad('const s = { aspectRatio: 1.5 };', 'number'),
    bad('const s = { transform: [{ translateX: 12 }] };', 'number'),
    bad('const s = { transform: [{ scale: 0.95 }] };', 'number'),
    bad('const s = { transform: [{ rotate: "-4deg" }] };', 'number'),
    // màu trong template literal
    bad('const c = `#157852`;', 'color'),
    bad('const c = `${a}#FFF`;', 'color'),
    bad('const c = `rgba(${r}, 0, 0, 0.5)`;', 'color'),
    // ngoại lệ thiếu lý do
    bad('// token-exception: ngắn\nconst s = { padding: 14 };', 'badException'),
    // tệp dùng chung với màn đã verify vẫn bị chặn literal
    bad('const s = { padding: 14 };', 'number', frozenShared),
  ],
});
