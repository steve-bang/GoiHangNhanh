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
  // vị trí, lớp, tỉ lệ
  'top',
  'bottom',
  'left',
  'right',
  'zIndex',
  'aspectRatio',
  // transform: [{ translateX: 8 }, { scale: 1.2 }]
  'translateX',
  'translateY',
  'scale',
  'scaleX',
  'scaleY',
  'perspective',
]);
/** Phần tử transform viết bằng chuỗi: `rotate: '45deg'`. */
const ANGLE_KEYS = new Set(['rotate', 'rotateX', 'rotateY', 'rotateZ', 'skewX', 'skewY']);
/** Khóa mà 1 là giá trị trung tính (không phải quyết định thiết kế). */
const ONE_IS_NEUTRAL = new Set(['opacity', 'scale', 'scaleX', 'scaleY']);
const COLOR_KEY = /^(color|[a-z]+Color)$/;
/** Màu viết trong chuỗi/template: #hex hoặc rgb(a)/hsl(a)(. */
const COLOR_IN_TEXT =
  /(^|[^\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z])|\b(?:rgba?|hsla?)\s*\(/;
// Tên màu CSS (trừ `transparent`, không phải quyết định thiết kế).
const CSS_COLOR_NAMES = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown ' +
    'burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan ' +
    'darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid ' +
    'darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet ' +
    'deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ' +
    'ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow ' +
    'lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
    'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine ' +
    'mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise ' +
    'mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab ' +
    'orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru ' +
    'pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan ' +
    'teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
);
const COLOR_STRING = /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\s*\()/;
const TOKEN_ROOTS = new Set(['tokens', 'layout']);
const LEGACY_NAMES = new Set(['colors', 'spacing', 'radius']);
const MESSAGE_NUMBER =
  'Giá trị thiết kế cố định "{{value}}" ở `{{key}}`: dùng token (useTheme().tokens). Nếu thật sự đặc thù, thêm `// token-exception: <lý do>`.';

function keyName(prop) {
  if (prop.computed) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal') return String(prop.key.value);
  return null;
}

/** Biểu thức đọc từ token: `tokens.space.sm`, `layout.space.tight`, `theme.tokens.x`, và phép tính trên chúng. */
function isTokenExpr(node) {
  if (!node) return false;
  switch (node.type) {
    case 'MemberExpression': {
      let cur = node;
      while (cur.type === 'MemberExpression') {
        if (!cur.computed && cur.property.name === 'tokens') return true;
        cur = cur.object;
      }
      return cur.type === 'Identifier' && TOKEN_ROOTS.has(cur.name);
    }
    case 'BinaryExpression':
      return isTokenExpr(node.left) || isTokenExpr(node.right);
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      return isTokenExpr(node.expression);
    default:
      return false;
  }
}

const isNumberLiteral = (n) => n.type === 'Literal' && typeof n.value === 'number';

/** Các nút chuỗi trong biểu thức giá trị (đi qua điều kiện, logic, ép kiểu). */
function stringLiterals(node, out) {
  if (!node) return;
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') out.push(node);
      break;
    case 'ConditionalExpression':
      stringLiterals(node.consequent, out);
      stringLiterals(node.alternate, out);
      break;
    case 'LogicalExpression':
      stringLiterals(node.left, out);
      stringLiterals(node.right, out);
      break;
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
      stringLiterals(node.expression, out);
      break;
    default:
  }
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
    case 'BinaryExpression':
      // `tokens.space.sm + 2`: cộng/trừ một số thô vào token cũng là giá trị thiết kế tự đặt.
      if (node.operator === '+' || node.operator === '-') {
        rawNumbers(node.left, out, allowOne);
        rawNumbers(node.right, out, allowOne);
      } else if (node.operator === '*' || node.operator === '/') {
        // `tokens.space.sm * 2` hoặc `16 / 9` là giá trị tự đặt; `size * 0.55` (biến không phải token) thì không.
        if (isTokenExpr(node.left) || isTokenExpr(node.right)) {
          rawNumbers(node.left, out, allowOne);
          rawNumbers(node.right, out, allowOne);
        } else if (isNumberLiteral(node.left) && isNumberLiteral(node.right)) {
          out.push(node);
        }
      }
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
        function reportColorNames(value) {
          const strings = [];
          stringLiterals(value, strings);
          for (const n of strings) {
            if (CSS_COLOR_NAMES.has(n.value.trim().toLowerCase()) && !excepted(n))
              context.report({ node: n, messageId: 'color', data: { value: n.value } });
          }
        }
        return {
          JSXAttribute(node) {
            // <Icon color="red" />, <X tintColor={cond ? 'white' : tokens...} />
            if (node.name.type !== 'JSXIdentifier' || !COLOR_KEY.test(node.name.name)) return;
            const v = node.value;
            if (!v) return;
            if (v.type === 'Literal') reportColorNames(v);
            else if (v.type === 'JSXExpressionContainer') reportColorNames(v.expression);
          },
          TemplateElement(node) {
            if (excepted(node) || !COLOR_IN_TEXT.test(node.value.cooked ?? node.value.raw)) return;
            context.report({
              node,
              messageId: 'color',
              data: { value: node.value.cooked ?? node.value.raw },
            });
          },
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
            if (key === 'fontWeight') {
              const strings = [];
              stringLiterals(value, strings); // cả khi đi qua điều kiện: cond ? '700' : '400'
              const numbers = [];
              rawNumbers(value, numbers, false);
              for (const n of [...strings, ...numbers]) {
                context.report({ node: n, messageId: 'weight', data: { value: n.value } });
              }
              return;
            }
            if (COLOR_KEY.test(key)) reportColorNames(value);
            if (ANGLE_KEYS.has(key)) {
              const strings = [];
              stringLiterals(value, strings);
              for (const n of strings) {
                if (/^-?\d/.test(n.value))
                  context.report({ node: n, messageId: 'number', data: { value: n.value, key } });
              }
            }
            if (NUMERIC_KEYS.has(key)) {
              const hits = [];
              rawNumbers(value, hits, ONE_IS_NEUTRAL.has(key)); // 1 = đặc hoàn toàn / không phóng, không phải quyết định thiết kế
              for (const h of hits) {
                const v =
                  h.type === 'UnaryExpression'
                    ? `-${h.argument.value}`
                    : (h.value ?? 'phép tính số thô');
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
