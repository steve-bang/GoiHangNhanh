import {
  ILLUSTRATION_DESIGN_HEIGHT,
  ILLUSTRATION_MAX_HEIGHT,
  MIN_ILLUSTRATION_HEIGHT,
  computeWelcomeLayout,
  getIllustrationGeometry,
} from './welcome-layout';

const BASE = { insetTop: 0, insetBottom: 0, fontScale: 1 };

describe('getIllustrationGeometry', () => {
  /** Làm phẳng mọi số đo thành mảng để so tỉ lệ. */
  const flatten = (h: number) =>
    Object.values(getIllustrationGeometry(h)).flatMap((part) => Object.values<number>(part));

  it.each([110, 150, 213, 260])('mọi thành phần tỉ lệ đúng theo chiều cao %i', (h) => {
    const ref = flatten(ILLUSTRATION_DESIGN_HEIGHT);
    const got = flatten(h);
    const k = h / ILLUSTRATION_DESIGN_HEIGHT;
    expect(got).toHaveLength(ref.length);
    ref.forEach((designValue, i) => expect(got[i]).toBeCloseTo(designValue * k, 6));
  });

  it('giữ nguyên vị trí tương đối giữa các thành phần ở mọi cỡ', () => {
    const a = getIllustrationGeometry(260);
    const b = getIllustrationGeometry(130);
    expect(b.shield.right / b.frame.width).toBeCloseTo(a.shield.right / a.frame.width, 9);
    expect(b.boxLarge.left / b.frame.width).toBeCloseTo(a.boxLarge.left / a.frame.width, 9);
    expect(b.blob.diameter / b.frame.height).toBeCloseTo(a.blob.diameter / a.frame.height, 9);
  });

  it('khối nằm gọn trong khung', () => {
    const g = getIllustrationGeometry(200);
    expect(g.shield.top + g.shield.size).toBeLessThanOrEqual(g.frame.height);
    expect(g.blob.diameter).toBeLessThanOrEqual(g.frame.height);
    expect(g.boxSmall.left + g.boxSmall.size).toBeLessThanOrEqual(g.frame.width);
  });
});

describe('computeWelcomeLayout', () => {
  const sizes = [
    { name: '375x667', width: 375, height: 667 },
    { name: '320x568', width: 320, height: 568 },
    { name: '360x640', width: 360, height: 640 },
  ];

  it.each(sizes)('$name: nội dung vừa chiều cao khả dụng (không cần cuộn)', (s) => {
    for (const insetTop of [0, 20]) {
      const l = computeWelcomeLayout({ ...BASE, ...s, insetTop });
      expect(l.estimatedContentHeight).toBeLessThanOrEqual(l.availableHeight);
      expect(l.scrollNeeded).toBe(false);
      expect(l.illustrationHeight === 0 || l.illustrationHeight >= MIN_ILLUSTRATION_HEIGHT).toBe(
        true,
      );
    }
  });

  it('320x568: màn hẹp, khoảng cách thu gọn, hình ẩn', () => {
    const l = computeWelcomeLayout({ ...BASE, width: 320, height: 568 });
    expect(l.narrow).toBe(true);
    expect(l.compact).toBe(true);
    expect(l.illustrationHeight).toBe(0);
  });

  it('375x667 vẫn hiện hình (thu nhỏ)', () => {
    const l = computeWelcomeLayout({ ...BASE, width: 375, height: 667, insetTop: 20 });
    expect(l.illustrationHeight).toBeGreaterThanOrEqual(MIN_ILLUSTRATION_HEIGHT);
    expect(l.illustrationHeight).toBeLessThan(ILLUSTRATION_MAX_HEIGHT);
  });

  it.each([
    [390, 844],
    [412, 915],
    [430, 932],
  ])('%ix%i: giữ khoảng cách thường, hình không vượt trần', (width, height) => {
    const l = computeWelcomeLayout({ ...BASE, width, height });
    expect(l.compact).toBe(false);
    expect(l.gaps).toEqual({ top: 24, section: 24 });
    expect(l.narrow).toBe(false);
    expect(l.illustrationHeight).toBe(ILLUSTRATION_MAX_HEIGHT);
  });

  it('hình không bao giờ vượt trần, kể cả màn rất cao', () => {
    const l = computeWelcomeLayout({ ...BASE, width: 400, height: 2000 });
    expect(l.illustrationHeight).toBe(ILLUSTRATION_MAX_HEIGHT);
  });

  it('chữ hệ thống lớn: ẩn hình và cho cuộn khi không vừa', () => {
    const l = computeWelcomeLayout({ ...BASE, width: 375, height: 667, fontScale: 1.6 });
    expect(l.illustrationHeight).toBe(0);
    expect(l.scrollNeeded).toBe(true);
  });

  it('chữ lớn trên màn cao: ẩn hình, vẫn không báo cuộn nếu đủ chỗ', () => {
    const l = computeWelcomeLayout({ ...BASE, width: 412, height: 915, fontScale: 1.3 });
    expect(l.illustrationHeight).toBe(0);
    expect(l.scrollNeeded).toBe(false);
  });
});
