import { normalizeSources, SELLING_SOURCES, toggleSource } from './selling-sources';

describe('nguồn bán', () => {
  it('giá trị lưu là enum, không phải chuỗi hiển thị', () => {
    expect(SELLING_SOURCES).toEqual(['shopee', 'tiktok_shop', 'lazada', 'other']);
  });

  it('chọn nhiều, "Khác" là một lựa chọn như các nguồn còn lại', () => {
    let selected = toggleSource([], 'other');
    selected = toggleSource(selected, 'shopee');
    selected = toggleSource(selected, 'lazada');
    expect(selected).toEqual(['shopee', 'lazada', 'other']);
  });

  it('bấm lần hai thì bỏ chọn; bỏ hết thì rỗng (bỏ qua được)', () => {
    let selected = toggleSource(toggleSource([], 'shopee'), 'tiktok_shop');
    selected = toggleSource(selected, 'shopee');
    expect(selected).toEqual(['tiktok_shop']);
    expect(toggleSource(selected, 'tiktok_shop')).toEqual([]);
  });

  it('chuẩn hóa bỏ trùng và theo thứ tự chuẩn', () => {
    expect(normalizeSources(['other', 'shopee', 'other'])).toEqual(['shopee', 'other']);
  });
});
