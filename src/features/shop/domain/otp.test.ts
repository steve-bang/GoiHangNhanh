import { formatCountdown, isOtpComplete, remainingSeconds, sanitizeOtp } from './otp';

describe('sanitizeOtp', () => {
  it('chỉ giữ chữ số và cắt còn 6', () => {
    expect(sanitizeOtp('12a3b')).toBe('123');
    expect(sanitizeOtp('1234567890')).toBe('123456');
    expect(sanitizeOtp('')).toBe('');
  });
  it('xử lý mã dán có khoảng trắng hoặc gạch nối', () => {
    expect(sanitizeOtp('123 456')).toBe('123456');
    expect(sanitizeOtp('123-456')).toBe('123456');
    expect(sanitizeOtp(' 654321\n')).toBe('654321');
  });
  it('chữ số full-width hoặc chữ cái không lọt qua', () => {
    expect(sanitizeOtp('１２３')).toBe('');
    expect(sanitizeOtp('abcdef')).toBe('');
  });
});

describe('isOtpComplete', () => {
  it('chỉ đúng khi đủ 6 chữ số', () => {
    expect(isOtpComplete('123456')).toBe(true);
    expect(isOtpComplete('12345')).toBe(false);
    expect(isOtpComplete('1234567')).toBe(false);
    expect(isOtpComplete('12345a')).toBe(false);
  });
});

describe('đếm ngược theo mốc thời gian', () => {
  it('remainingSeconds làm tròn lên và không âm', () => {
    expect(remainingSeconds(30_000, 0)).toBe(30);
    expect(remainingSeconds(30_000, 29_001)).toBe(1);
    expect(remainingSeconds(30_000, 30_000)).toBe(0);
    expect(remainingSeconds(30_000, 99_000)).toBe(0);
  });
  it('formatCountdown theo mm:ss', () => {
    expect(formatCountdown(30)).toBe('00:30');
    expect(formatCountdown(75)).toBe('01:15');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5)).toBe('00:00');
  });
});
