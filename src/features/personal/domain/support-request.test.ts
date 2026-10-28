import {
  SUPPORT_MESSAGE_MAX_LENGTH,
  SUPPORT_ORDER_CODE_MAX_LENGTH,
  SUPPORT_SUBJECT_MAX_LENGTH,
  buildSupportMailto,
  validateSupportRequest,
} from './support-request';

const OK = { name: 'Minh', subject: 'Hỏi về đơn', orderCode: '', message: 'Cần hỗ trợ' };
const LABELS = { name: 'Họ và tên', orderCode: 'Mã đơn' };

describe('validateSupportRequest', () => {
  it('hợp lệ khi đủ họ tên, chủ đề, nội dung (mã đơn tùy chọn)', () => {
    expect(validateSupportRequest(OK)).toEqual({});
  });

  it('thiếu hoặc chỉ khoảng trắng thì báo required, từng ô một', () => {
    expect(validateSupportRequest({ ...OK, name: '  ', subject: '', message: '\n' })).toEqual({
      name: 'required',
      subject: 'required',
      message: 'required',
    });
    expect(validateSupportRequest({ ...OK, message: '' })).toEqual({ message: 'required' });
  });

  it('quá dài thì báo too_long đúng ở ranh giới', () => {
    expect(
      validateSupportRequest({ ...OK, message: 'a'.repeat(SUPPORT_MESSAGE_MAX_LENGTH) }),
    ).toEqual({});
    expect(
      validateSupportRequest({ ...OK, message: 'a'.repeat(SUPPORT_MESSAGE_MAX_LENGTH + 1) }),
    ).toEqual({ message: 'too_long' });
    expect(
      validateSupportRequest({ ...OK, subject: 'a'.repeat(SUPPORT_SUBJECT_MAX_LENGTH + 1) }),
    ).toEqual({ subject: 'too_long' });
  });

  it('mã đơn tùy chọn nhưng có giới hạn: đúng ranh giới thì hợp lệ, vượt thì too_long (tính sau trim)', () => {
    const at = 'a'.repeat(SUPPORT_ORDER_CODE_MAX_LENGTH);
    expect(validateSupportRequest({ ...OK, orderCode: ` ${at} ` })).toEqual({});
    expect(validateSupportRequest({ ...OK, orderCode: `${at}a` })).toEqual({
      orderCode: 'too_long',
    });
    expect(validateSupportRequest({ ...OK, orderCode: '   ' })).toEqual({});
  });
});

describe('buildSupportMailto', () => {
  it('mã hóa chủ đề và thân; không mã đơn thì không có dòng mã đơn', () => {
    const url = buildSupportMailto('ho-tro@example.com', OK, LABELS);
    expect(url.startsWith('mailto:ho-tro@example.com?subject=')).toBe(true);
    const [, query = ''] = url.split('?');
    const params = new URLSearchParams(query);
    expect(params.get('subject')).toBe('Hỏi về đơn');
    expect(params.get('body')).toBe('Họ và tên: Minh\r\n\r\nCần hỗ trợ');
  });

  it('có mã đơn thì thêm một dòng; cắt khoảng trắng đầu/cuối; ký tự đặc biệt không phá URL', () => {
    const url = buildSupportMailto(
      'ho-tro@example.com',
      { name: ' Minh ', subject: ' A&B=C ', orderCode: ' DH 01 ', message: ' x?y#z\nd ' },
      LABELS,
    );
    expect(url).not.toMatch(/[ #]/);
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    expect(params.get('subject')).toBe('A&B=C');
    expect(params.get('body')).toBe('Họ và tên: Minh\r\nMã đơn: DH 01\r\n\r\nx?y#z\nd');
  });
});
