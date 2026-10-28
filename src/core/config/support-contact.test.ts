import { isPlaceholderLink, LEGAL_LINKS } from './legal-links';
import { getSupportEmail, SUPPORT_EMAIL } from './support-contact';

describe('địa chỉ hỗ trợ (Q-21ae)', () => {
  it('chưa có địa chỉ thật: không bịa, trả null', () => {
    expect(SUPPORT_EMAIL).toBeNull();
    expect(getSupportEmail()).toBeNull();
  });

  it.each([
    ['ho-tro@example.com', 'ho-tro@example.com'],
    ['  ho-tro@example.com ', 'ho-tro@example.com'],
    ['không phải email', null],
    ['a@b', null],
    ['', null],
    [null, null],
  ])('getSupportEmail(%j)', (raw, expected) => {
    expect(getSupportEmail(raw)).toBe(expected);
  });
});

describe('liên kết pháp lý giữ chỗ', () => {
  it('URL hiện tại là giữ chỗ nên bị coi là chưa mở được', () => {
    expect(isPlaceholderLink(LEGAL_LINKS.terms)).toBe(true);
    expect(isPlaceholderLink(LEGAL_LINKS.privacy)).toBe(true);
  });

  it.each([
    ['https://doncung.vn/terms', false],
    ['https://www.doncung.vn', false],
    ['http://doncung.vn/terms', true],
    ['https://invalid/x', true],
    ['https://a.INVALID/x', true],
    ['', true],
    ['không phải url', true],
  ])('isPlaceholderLink(%j) = %s', (url, expected) => {
    expect(isPlaceholderLink(url)).toBe(expected);
  });
});
