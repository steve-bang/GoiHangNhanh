import { isPlaceholderLink, LEGAL_LINKS } from './legal-links';
import { PUBLIC_LINKS, supportContactUrl } from './public-links';
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
    expect(isPlaceholderLink(LEGAL_LINKS.accountDeletion)).toBe(true);
  });

  it('legal-links và support-contact chỉ là lớp tương thích: cùng giá trị public-links (V1-18)', () => {
    expect(LEGAL_LINKS).toEqual({
      terms: PUBLIC_LINKS.terms,
      privacy: PUBLIC_LINKS.privacy,
      accountDeletion: PUBLIC_LINKS.accountDeletionRequest,
    });
    expect(SUPPORT_EMAIL).toBe(PUBLIC_LINKS.supportEmail);
    expect(LEGAL_LINKS.terms).toBe('https://don-chung.invalid/dieu-khoan/');
    expect(LEGAL_LINKS.privacy).toBe('https://don-chung.invalid/chinh-sach-quyen-rieng-tu/');
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

describe('đích nút Liên hệ hỗ trợ ngoài app (V1-18)', () => {
  it('hôm nay còn giữ chỗ: null (ẩn nút)', () => {
    expect(supportContactUrl()).toBeNull();
  });

  it.each([
    ['https://doncung.vn/ho-tro/', null, 'https://doncung.vn/ho-tro/'],
    ['https://doncung.vn/ho-tro/', 'ho-tro@doncung.vn', 'https://doncung.vn/ho-tro/'],
    ['https://don-chung.invalid/ho-tro/', 'ho-tro@doncung.vn', 'mailto:ho-tro@doncung.vn'],
    ['https://don-chung.invalid/ho-tro/', 'sai dạng', null],
    ['https://don-chung.invalid/ho-tro/', null, null],
  ])('trang %s, email %s -> %s', (page, email, expected) => {
    expect(supportContactUrl(page, email)).toBe(expected);
  });
});
