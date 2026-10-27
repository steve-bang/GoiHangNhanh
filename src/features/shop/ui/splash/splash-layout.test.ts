import {
  computeSplashLayout,
  FEATURE_LABEL_FONT_SIZE,
  HERO_MAX_SCALE,
  HERO_MIN_SCALE,
  type SplashLayout,
} from './splash-layout';

interface Device {
  name: string;
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
}

const DEVICES: Device[] = [
  { name: '390x844 (iPhone 14)', width: 390, height: 844, insetTop: 47, insetBottom: 34 },
  { name: '412x915 (Android lớn)', width: 412, height: 915, insetTop: 24, insetBottom: 16 },
  { name: '375x667 (iPhone SE)', width: 375, height: 667, insetTop: 20, insetBottom: 0 },
  { name: '320x568 (nhỏ)', width: 320, height: 568, insetTop: 20, insetBottom: 0 },
  { name: '360x640 (Android thấp)', width: 360, height: 640, insetTop: 24, insetBottom: 0 },
];
const FONT_SCALES = [1, 1.3, 2];

const layoutOf = (d: Device, fontScale: number): SplashLayout =>
  computeSplashLayout({ ...d, fontScale });

describe('computeSplashLayout', () => {
  it('390x844, chữ thường: hiện đủ mọi khối, ảnh rộng bằng màn', () => {
    const l = layoutOf(DEVICES[0] as Device, 1);
    expect(l).toMatchObject({
      showSlogan: true,
      showFeatures: true,
      showTagline: true,
      showHero: true,
      fits: true,
    });
    expect(l.hero.width).toBeGreaterThanOrEqual(390);
    expect(l.hero.width).toBeLessThanOrEqual(390 * HERO_MAX_SCALE + 0.5);
  });

  it('màn cao hơn thiết kế: phần dư vào khoảng cách (có giới hạn) và ảnh lớn thêm vừa phải', () => {
    const normal = layoutOf(DEVICES[0] as Device, 1);
    const tall = computeSplashLayout({
      width: 390,
      height: 1000,
      insetTop: 47,
      insetBottom: 34,
      fontScale: 1,
    });
    expect(tall.header.paddingTop).toBeGreaterThan(normal.header.paddingTop);
    expect(tall.header.paddingTop - normal.header.paddingTop).toBeLessThanOrEqual(20);
    expect(tall.hero.scale).toBeLessThanOrEqual(HERO_MAX_SCALE);
    expect(tall.fits).toBe(true);
  });

  it('màn thấp ẩn dần theo thứ tự: câu viết tay, hàng tính năng, khẩu hiệu', () => {
    const base = { width: 390, insetTop: 20, insetBottom: 0, fontScale: 1 };
    const seen: [boolean, boolean, boolean][] = [];
    for (let height = 900; height >= 520; height -= 4) {
      const l = computeSplashLayout({ ...base, height });
      const state: [boolean, boolean, boolean] = [l.showSlogan, l.showFeatures, l.showTagline];
      const last = seen[seen.length - 1];
      if (!last || last.join() !== state.join()) seen.push(state);
    }
    // Ẩn dần, không bao giờ hiện lại khối đã ẩn khi màn thấp hơn.
    expect(seen).toEqual([
      [true, true, true],
      [false, true, true],
      [false, false, true],
      [false, false, false],
    ]);
  });

  it('chữ lớn (>= 1,25): ẩn hàng tính năng và khẩu hiệu', () => {
    for (const d of DEVICES) {
      for (const fontScale of [1.25, 1.3, 2]) {
        const l = layoutOf(d, fontScale);
        expect(l.showFeatures).toBe(false);
        expect(l.showTagline).toBe(false);
      }
    }
  });

  it('nhãn tính năng không nhỏ hơn 12dp', () => {
    expect(FEATURE_LABEL_FONT_SIZE).toBeGreaterThanOrEqual(12);
  });

  describe.each(DEVICES)('$name', (d) => {
    it.each(FONT_SCALES)('fontScale %s: vừa chiều cao, khiên + tên luôn hiện', (fontScale) => {
      const l = layoutOf(d, fontScale);
      expect(l.fits).toBe(true);
      // Khiên + tên là một phần khối đầu, luôn có kích thước dương.
      expect(l.header.shield.width).toBeGreaterThan(0);
      expect(l.header.wordmark.fontSize).toBeGreaterThan(0);
      // Không khối nào vượt chiều cao màn.
      expect(l.header.bottom).toBeLessThanOrEqual(d.height);
      expect(l.wave.height).toBeLessThanOrEqual(d.height);
      expect(l.hero.top + l.hero.height + l.hero.bottomOffset).toBeCloseTo(d.height, 3);
      if (l.showHero) {
        expect(l.hero.top).toBeGreaterThanOrEqual(l.header.bottom - 0.5);
        expect(l.hero.scale).toBeGreaterThanOrEqual(HERO_MIN_SCALE);
        expect(l.hero.scale).toBeLessThanOrEqual(HERO_MAX_SCALE);
      }
      // Khối đầu không chạm sóng.
      expect(l.header.bottom).toBeLessThanOrEqual(d.height - l.wave.height + 0.5);
    });
  });

  it('màn rất thấp: thu nhỏ ảnh trước khi ẩn; khiên + tên vẫn hiện', () => {
    const l = computeSplashLayout({
      width: 360,
      height: 520,
      insetTop: 24,
      insetBottom: 0,
      fontScale: 1,
    });
    expect(l.showSlogan || l.showFeatures || l.showTagline || l.hero.scale < 1).toBe(true);
    expect(l.fits).toBe(true);
    expect(l.header.shield.height).toBeGreaterThan(0);
  });
});
