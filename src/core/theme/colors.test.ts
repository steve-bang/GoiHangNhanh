import golden from './colors.golden.json';
import { colors } from './colors';
import { semantic } from './semantic';
import { palette } from './primitives';

/**
 * Bảng `colors` cũ phục vụ các màn đã được khách hàng xác nhận (Splash, đăng nhập/đăng ký, khôi
 * phục mật khẩu, thiết lập). `colors.golden.json` chụp giá trị TRƯỚC khi tách primitives: bất kỳ
 * lệch nào (đổi giá trị, đổi tên, xóa khóa) làm test đỏ. Chỉ sửa golden khi khách hàng duyệt đổi
 * giao diện các màn đó.
 */
describe('colors (cũ) bị khóa bằng golden', () => {
  it('giữ nguyên từng khóa và giá trị', () => {
    expect(colors).toEqual(golden);
  });
});

describe('semantic tham chiếu primitives (một nguồn hex)', () => {
  const hexes = new Set<string>();
  const collect = (node: unknown) => {
    if (typeof node === 'string') hexes.add(node);
    else if (node && typeof node === 'object') Object.values(node).forEach(collect);
  };
  collect(palette);

  it('mọi màu trong semantic.color và semantic.status có mặt trong palette', () => {
    const used: string[] = [];
    const walk = (node: unknown) => {
      if (typeof node === 'string') used.push(node);
      else if (node && typeof node === 'object') Object.values(node).forEach(walk);
    };
    walk(semantic.color);
    walk(semantic.status);
    expect(used.filter((v) => !hexes.has(v))).toEqual([]);
  });
});
