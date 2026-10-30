import { ORDER_SOURCES } from './order-source';
import {
  fromRemoteSource,
  fromRemoteSources,
  REMOTE_ORDER_SOURCES,
  toRemoteSource,
  toRemoteSources,
} from './remote-source';

describe('ánh xạ nguồn bán app <-> máy chủ', () => {
  it('"Khác" là other trong app, other_unknown trên máy chủ; các nguồn khác giữ nguyên', () => {
    expect(toRemoteSource('other')).toBe('other_unknown');
    expect(toRemoteSource('shopee')).toBe('shopee');
    expect(toRemoteSource('tiktok_shop')).toBe('tiktok_shop');
    expect(toRemoteSource('lazada')).toBe('lazada');
  });

  it('đi hai chiều không mất giá trị và giữ thứ tự chuẩn', () => {
    expect(toRemoteSources(ORDER_SOURCES)).toEqual([...REMOTE_ORDER_SOURCES]);
    expect(fromRemoteSources(REMOTE_ORDER_SOURCES)).toEqual([...ORDER_SOURCES]);
    for (const source of ORDER_SOURCES) {
      expect(fromRemoteSource(toRemoteSource(source))).toBe(source);
    }
  });

  it('mọi giá trị app gửi lên đều thuộc từ vựng máy chủ (Rules/Function)', () => {
    for (const source of ORDER_SOURCES) {
      expect(REMOTE_ORDER_SOURCES).toContain(toRemoteSource(source));
    }
  });

  it('giá trị lạ từ máy chủ là null, không đoán thành "Khác"', () => {
    for (const bad of ['other', 'tiki', '', null, undefined, 3]) {
      expect(fromRemoteSource(bad)).toBeNull();
    }
    expect(fromRemoteSources(['shopee', 'tiki', 'other_unknown', 'other'])).toEqual([
      'shopee',
      'other',
    ]);
  });
});
