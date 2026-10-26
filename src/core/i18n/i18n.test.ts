import { initI18n } from './index';
import { resources } from './resources';

type Json = string | { [k: string]: Json };

function flatten(obj: Json, prefix = ''): [string, string][] {
  if (typeof obj === 'string') return [[prefix, obj]];
  return Object.entries(obj).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

const allStrings = Object.entries(resources.vi).flatMap(([ns, tree]) => flatten(tree as Json, ns));

// Câu chữ hứa quá mức bị cấm (CLAUDE.md bất biến #11; docs/09 mục 3 và 5.5).
const FORBIDDEN = [
  'tuyệt đối',
  'chống giả mạo',
  'đã sao lưu',
  'đảm bảo thắng',
  'chắc chắn được',
  'tự động hoàn tất',
  'bằng chứng pháp lý',
];

describe('i18n', () => {
  it('tiếng Việt là mặc định và tra được khóa', () => {
    const i18n = initI18n();
    expect(i18n.language).toBe('vi');
    expect(i18n.t('evidence:status.saved_on_device')).toBe('Đã lưu trên máy');
    expect(i18n.t('errors:ORDER_NOT_FOUND')).toContain('Chưa tìm thấy đơn');
  });

  it.each(FORBIDDEN)('không có chuỗi chứa cụm bị cấm "%s"', (phrase) => {
    const hits = allStrings.filter(([, v]) => v.toLowerCase().includes(phrase));
    expect(hits).toEqual([]);
  });

  it('cụm "an toàn trên máy chủ" chỉ dùng cho Đã xác minh', () => {
    const hits = allStrings
      .filter(([, v]) => v.toLowerCase().includes('an toàn trên máy chủ'))
      .map(([k]) => k);
    expect(hits).toEqual(['evidence.statusHint.verified']);
  });

  it('nhãn Đã tải lên không thêm "an toàn"', () => {
    const t = resources.vi.evidence;
    expect(t.status.uploaded).not.toMatch(/an toàn/i);
    expect(t.statusHint.uploaded).not.toMatch(/an toàn/i);
  });
});
