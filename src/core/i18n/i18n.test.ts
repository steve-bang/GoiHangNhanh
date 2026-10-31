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
  // v1 chỉ tải khi app đang mở, không tải nền; chưa xác minh thì chưa phải bản sao lưu (V1-18).
  'tải nền',
  'chạy nền',
  'sao lưu an toàn',
];

/**
 * NGOẠI LỆ CÓ CHỦ ĐÍCH cho cụm cấm: câu chữ của màn Splash (UI-A01) giữ nguyên theo ảnh thiết kế do
 * người dùng (chủ sản phẩm) duyệt, dù có thể bị coi là hứa hơi quá ("bảo vệ", "an tâm") và nhãn
 * "Quản lý đơn hàng" trái D-10. Xem docs/engineering/decisions.md Q-15 và docs/README.md D-15.
 * CHỈ các khóa này được miễn; mọi chuỗi khác vẫn bị quét. Thêm khóa vào đây phải có duyệt tương tự.
 */
const APPROVED_PHRASING_EXCEPTIONS: ReadonlySet<string> = new Set([
  'screens.splash.tagline',
  'screens.splash.features.record',
  'screens.splash.features.cloud',
  'screens.splash.features.orders',
  'screens.splash.features.protect',
  'screens.splash.slogan',
]);
const scannedStrings = allStrings.filter(([key]) => !APPROVED_PHRASING_EXCEPTIONS.has(key));

describe('i18n', () => {
  it('tiếng Việt là mặc định và tra được khóa', () => {
    const i18n = initI18n();
    expect(i18n.language).toBe('vi');
    expect(i18n.t('evidence:status.saved_on_device')).toBe('Đã lưu trên máy');
    expect(i18n.t('errors:ORDER_NOT_FOUND')).toContain('Chưa tìm thấy đơn');
  });

  it.each(FORBIDDEN)('không có chuỗi chứa cụm bị cấm "%s"', (phrase) => {
    const hits = scannedStrings.filter(([, v]) => v.toLowerCase().includes(phrase));
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

describe('ngoại lệ câu chữ đã duyệt (Splash, Q-15)', () => {
  it('chỉ gồm khóa screens.splash.* và mọi khóa đều tồn tại', () => {
    const keys = new Set(allStrings.map(([key]) => key));
    for (const key of APPROVED_PHRASING_EXCEPTIONS) {
      expect(key.startsWith('screens.splash.')).toBe(true);
      expect(keys.has(key)).toBe(true);
    }
  });

  it('các khóa còn lại của Splash (tên app) vẫn bị quét cụm cấm', () => {
    const scanned = new Set(scannedStrings.map(([key]) => key));
    expect(scanned.has('screens.splash.brandName')).toBe(true);
    expect(scanned.has('screens.splash.slogan')).toBe(false);
  });

  it('một chuỗi nằm ngoài danh sách ngoại lệ chứa cụm cấm sẽ bị bắt', () => {
    const fake: [string, string][] = [['screens.welcome.title', 'Bảo vệ tuyệt đối']];
    const hits = fake.filter(
      ([key, v]) =>
        !APPROVED_PHRASING_EXCEPTIONS.has(key) &&
        FORBIDDEN.some((p) => v.toLowerCase().includes(p)),
    );
    expect(hits).toHaveLength(1);
  });
});
