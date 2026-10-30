import { ShopError } from './shop';
import { UploadError } from './uploads';

/**
 * Chi tiết của lỗi máy chủ bất ngờ (V1-04): client (V1-02) phân biệt "máy chủ lỗi" với "mất mạng" nhờ
 * `details.reason`, không phải nhờ câu chữ. Không chứa PII, không chứa thông điệp lỗi gốc.
 */
export const SERVER_UNEXPECTED_DETAILS = { reason: 'server_unexpected' } as const;

export interface CallableErrorShape {
  readonly code: ShopError['code'] | UploadError['code'] | 'internal';
  readonly message: string;
  readonly details?: typeof SERVER_UNEXPECTED_DETAILS;
}

/**
 * Mô tả lỗi trả cho client (thuần, test được không cần `firebase-functions`): lỗi nghiệp vụ giữ mã và
 * câu; lỗi khác là `internal` + `details.reason`, KHÔNG lộ thông điệp gốc (có thể chứa mã đơn, đường dẫn).
 */
export function describeCallableError(error: unknown): CallableErrorShape {
  if (error instanceof ShopError || error instanceof UploadError) {
    return { code: error.code, message: error.message };
  }
  return { code: 'internal', message: 'Lỗi hệ thống.', details: SERVER_UNEXPECTED_DETAILS };
}
