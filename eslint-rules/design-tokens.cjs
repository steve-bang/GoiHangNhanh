'use strict';
/**
 * Rule ESLint nội bộ `design-tokens/no-raw-design-values` (docs/design-token-spec.md mục 7).
 * Chỉ áp cho tệp trong phạm vi (scripts/design-token-scope.cjs). Chặn:
 *  - mã màu (#hex, rgb/rgba/hsl) viết thẳng trong giao diện;
 *  - số cố định ở thuộc tính thiết kế (chữ, spacing, bo góc, viền, bóng, độ mờ, kích thước);
 *  - đọc bảng màu cũ (`colors`, `spacing`, `radius` từ useTheme; import `colors`/`palette` trực tiếp).
 * Không cấm mọi số: cho phép 0, phép tính (có biến/token), giá trị động. Ngoại lệ hợp lệ phải ghi
 * `// token-exception: <lý do>` ở cùng dòng hoặc dòng ngay trên.
 */
const path = require('node:path');
const { isInScope, SHARED_WITH_FROZEN } = require('../scripts/design-token-scope.cjs');

const NUMERIC_KEYS = new Set([
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingEnd',
  'margin',
  'marginHorizontal',
  'marginVertical',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  'gap',
  'rowGap',
  'columnGap',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderWidth',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'shadowOpacity',
  'shadowRadius',
  'elevation',
  'opacity',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
]);
const COLOR_STRING = /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\s*\()/;
const LEGACY_NAMES = new Set(['colors', 'spacing', 'radius']);
const MESSAGE_NUMBER =
  'Giá trị thiết kế cố định "{{value}}" ở `{{key}}`: dùng token (useTheme().tokens). Nếu thật sự đặc thù, thêm `// token-exception: <lý do>`.';

function keyName(prop) {
  if (prop.computed) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal') return String(prop.key.value);
  return null;
}

/** Trả về các nút số/chuỗi "thô" trong biểu thức giá trị (đi qua điều kiện, logic, Math.max/min). */
function rawNumbers(node, out, allowOne) {
  if (!node) return;
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'number' && node.value !== 0 && !(allowOne && node.value === 1))
        out.push(node);
      break;
    case 'UnaryExpression':
      if (
        node.argument.type === 'Literal' &&
        typeof node.argument.value === 'number' &&
        node.argument.value !== 0
      )
        out.push(node);
      break;
    case 'ConditionalExpression':
      rawNumbers(node.consequent, out, allowOne);
      rawNumbers(node.alternate, out, allowOne);
      break;
    case 'LogicalExpression':
      rawNumbers(node.left, out, allowOne);
      rawNumbers(node.right, out, allowOne);
      break;
    case 'CallExpression':
      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'Math' &&
        ['max', 'min'].includes(node.callee.property.name)
      ) {
        node.arguments.forEach((a) => rawNumbers(a, out, allowOne));
      }
      break;
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
      rawNumbers(node.expression, out, allowOne);
      break;
    default:
  }
}

module.exports = {
  rules: {
    'no-raw-design-values': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          number: MESSAGE_NUMBER,
          weight: 'Trọng số chữ viết thẳng ("{{value}}"): dùng `fontWeight` từ token.',
          color:
            'Mã màu viết thẳng "{{value}}" trong giao diện: dùng token màu (useTheme().tokens.color). Nếu là màu thương hiệu/minh họa, thêm `// token-exception: <lý do>`.',
          legacy:
            'Bảng cũ `{{name}}` chỉ dành cho màn đã được khách hàng xác nhận: trong app dùng `useTheme().tokens`.',
          directImport:
            'Không import `{{name}}` trực tiếp vào giao diện: dùng `useTheme().tokens`.',
          staticColor:
            'Màu phải đi qua `useTheme().tokens.color` (không đọc `semantic.{{part}}` tĩnh) để chế độ tối sau này không phải sửa từng component.',
          badException: '`token-exception` phải kèm lý do (>= 10 ký tự).',
        },
      },
      create(context) {
        const rel = path.relative(context.cwd, context.filename).split(path.sep).join('/');
        if (!isInScope(rel)) return {};
        const src = context.sourceCode;
        const frozenShared = SHARED_WITH_FROZEN.includes(rel);
        const exceptionLines = new Set();
        for (const c of src.getAllComments()) {
          const m = /token-exception:\s*(.*)/.exec(c.value);
          if (!m) continue;
          if (m[1].trim().length < 10) context.report({ loc: c.loc, messageId: 'badException' });
          exceptionLines.add(c.loc.end.line);
          exceptionLines.add(c.loc.end.line + 1);
        }
        const excepted = (node) =>
          exceptionLines.has(node.loc.start.line) || exceptionLines.has(node.loc.end.line);
        return {
          ImportDeclaration(node) {
            const from = node.source.value;
            if (!/^@\/core\/theme(\/(colors|primitives))?$/.test(from)) return;
            for (const s of node.specifiers) {
              const name = s.imported && s.imported.name;
              if (['colors', 'palette'].includes(name) && !frozenShared) {
                context.report({ node: s, messageId: 'directImport', data: { name } });
              }
            }
          },
          VariableDeclarator(node) {
            if (frozenShared) return;
            if (node.id.type !== 'ObjectPattern' || !node.init) return;
            const init = node.init;
            if (init.type !== 'CallExpression' || init.callee.name !== 'useTheme') return;
            for (const p of node.id.properties) {
              if (
                p.type === 'Property' &&
                p.key.type === 'Identifier' &&
                LEGACY_NAMES.has(p.key.name)
              ) {
                context.report({ node: p, messageId: 'legacy', data: { name: p.key.name } });
              }
            }
          },
          Property(node) {
            const key = keyName(node);
            if (!key || excepted(node)) return;
            const value = node.value;
            if (
              key === 'fontWeight' &&
              value.type === 'Literal' &&
              typeof value.value === 'string'
            ) {
              context.report({ node: value, messageId: 'weight', data: { value: value.value } });
              return;
            }
            if (NUMERIC_KEYS.has(key)) {
              const hits = [];
              rawNumbers(value, hits, key === 'opacity'); // opacity 1 = đặc hoàn toàn, không phải quyết định thiết kế
              for (const h of hits) {
                const v = h.type === 'UnaryExpression' ? `-${h.argument.value}` : h.value;
                context.report({ node: h, messageId: 'number', data: { value: v, key } });
              }
            }
          },
          MemberExpression(node) {
            if (
              node.object.type === 'Identifier' &&
              node.object.name === 'semantic' &&
              !node.computed &&
              ['color', 'status'].includes(node.property.name)
            ) {
              context.report({
                node,
                messageId: 'staticColor',
                data: { part: node.property.name },
              });
            }
          },
          Literal(node) {
            if (typeof node.value !== 'string' || !COLOR_STRING.test(node.value)) return;
            if (
              node.parent.type === 'ImportDeclaration' ||
              node.parent.type === 'ExportAllDeclaration'
            )
              return;
            if (excepted(node)) return;
            context.report({ node, messageId: 'color', data: { value: node.value } });
          },
        };
      },
    },
  },
};
