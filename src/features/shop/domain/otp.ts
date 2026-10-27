/** Mã xác minh gồm đúng 6 chữ số (docs/09 UI-A08). TypeScript thuần. */
export const OTP_LENGTH = 6;
/** Thời gian chờ mặc định trước khi được xin lại mã (giây) khi cổng không nói gì. */
export const DEFAULT_RESEND_SECONDS = 30;

/** Giữ chữ số (kể cả khi dán "123 456" hay "123-456"), cắt còn tối đa 6. */
export function sanitizeOtp(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

export function isOtpComplete(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/** Số giây còn lại tới mốc `deadline` (ms, theo `Date.now()`); không bao giờ âm. */
export function remainingSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** 30 -> "00:30", 75 -> "01:15". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
