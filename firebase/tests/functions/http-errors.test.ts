import {
  describeCallableError,
  SERVER_UNEXPECTED_DETAILS,
} from '../../functions/src/callable-errors';
import { ShopError } from '../../functions/src/shop';
import { UploadError } from '../../functions/src/uploads';

// `toHttpsError` (http-errors.ts) chỉ bọc kết quả này vào HttpsError; không nạp firebase-functions
// trong Jest (gói kéo theo ESM).
describe('describeCallableError (V1-04)', () => {
  it('lỗi bất ngờ: internal kèm details.reason = server_unexpected, không lộ thông điệp gốc', () => {
    const shape = describeCallableError(new Error('DH-BI-MAT-001 tại shops/s1/evidence/e1'));
    expect(shape).toEqual({
      code: 'internal',
      message: 'Lỗi hệ thống.',
      details: { reason: 'server_unexpected' },
    });
    expect(JSON.stringify(shape)).not.toContain('DH-BI-MAT-001');
    expect(describeCallableError('chuỗi lạ').details).toBe(SERVER_UNEXPECTED_DETAILS);
    expect(describeCallableError(undefined).code).toBe('internal');
  });

  it('lỗi nghiệp vụ giữ mã và câu, không gắn details', () => {
    expect(describeCallableError(new ShopError('permission-denied', 'x'))).toEqual({
      code: 'permission-denied',
      message: 'x',
    });
    expect(describeCallableError(new UploadError('failed-precondition', 'y'))).toEqual({
      code: 'failed-precondition',
      message: 'y',
    });
  });

  it('lỗi tải lên có lý do (V1-07b) gắn details.reason, không lộ gì thêm', () => {
    expect(
      describeCallableError(new UploadError('permission-denied', 'z', 'not_session_creator')),
    ).toEqual({
      code: 'permission-denied',
      message: 'z',
      details: { reason: 'not_session_creator' },
    });
  });
});
