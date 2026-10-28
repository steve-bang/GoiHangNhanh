/**
 * Yêu cầu hỗ trợ (UI-I06, khung 17). TypeScript thuần. KHÔNG có kênh gửi thật (Q-20g): yêu cầu chỉ được
 * soạn thành email (`mailto:`) cho người dùng tự bấm Gửi trong ứng dụng email. Không tự đính kèm video,
 * tệp hay dữ liệu bằng chứng; chỉ gồm điều người dùng nhìn thấy và gõ trong form.
 */
export const SUPPORT_NAME_MAX_LENGTH = 100;
export const SUPPORT_SUBJECT_MAX_LENGTH = 80;
export const SUPPORT_ORDER_CODE_MAX_LENGTH = 64;
/** Giới hạn thấp vì liên kết `mailto:` mã hóa chữ có dấu nở khoảng 3 lần và một số ứng dụng email cắt URL dài. */
export const SUPPORT_MESSAGE_MAX_LENGTH = 600;

export interface SupportRequestInput {
  readonly name: string;
  readonly subject: string;
  readonly orderCode: string;
  readonly message: string;
}

export type SupportRequestField = 'name' | 'subject' | 'orderCode' | 'message';
export type SupportRequestIssue = 'required' | 'too_long';
export type SupportRequestIssues = Partial<Record<SupportRequestField, SupportRequestIssue>>;

const LIMITS: Record<SupportRequestField, number> = {
  name: SUPPORT_NAME_MAX_LENGTH,
  subject: SUPPORT_SUBJECT_MAX_LENGTH,
  orderCode: SUPPORT_ORDER_CODE_MAX_LENGTH,
  message: SUPPORT_MESSAGE_MAX_LENGTH,
};

/** Kiểm tra ba ô bắt buộc (họ tên, chủ đề, nội dung); mã đơn tùy chọn nhưng có giới hạn độ dài (không để `mailto:` bị cắt âm thầm). Rỗng = chỉ có khoảng trắng. */
export function validateSupportRequest(input: SupportRequestInput): SupportRequestIssues {
  const issues: SupportRequestIssues = {};
  for (const field of ['name', 'subject', 'orderCode', 'message'] as const) {
    const value = input[field].trim();
    if (value === '') {
      if (field !== 'orderCode') issues[field] = 'required';
    } else if (value.length > LIMITS[field]) issues[field] = 'too_long';
  }
  return issues;
}

/** Nhãn dùng trong thân email; truyền vào để chữ nằm ở i18n. */
export interface SupportMailLabels {
  readonly name: string;
  readonly orderCode: string;
}

/**
 * Soạn liên kết `mailto:` tới `to`. Thân email: họ tên, mã đơn (nếu có), dòng trống, nội dung. Dùng
 * `encodeURIComponent` cho chủ đề và thân (xuống dòng thành %0D%0A theo RFC 6068).
 */
export function buildSupportMailto(
  to: string,
  input: SupportRequestInput,
  labels: SupportMailLabels,
): string {
  const lines = [`${labels.name}: ${input.name.trim()}`];
  const orderCode = input.orderCode.trim();
  if (orderCode !== '') lines.push(`${labels.orderCode}: ${orderCode}`);
  lines.push('', input.message.trim());
  const body = lines.join('\r\n');
  return `mailto:${to}?subject=${encodeURIComponent(input.subject.trim())}&body=${encodeURIComponent(body)}`;
}
