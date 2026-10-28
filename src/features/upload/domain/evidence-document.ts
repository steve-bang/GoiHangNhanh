import type { UploadRequest } from './ports';

/** Giá trị đặc biệt do lớp gọi cấp (SDK native trên máy, SDK web trong test Rules). */
export interface RemoteValues {
  serverTimestamp(): unknown;
  timestamp(ms: number): unknown;
}

/**
 * Tài liệu khai báo bằng chứng (`shops/{shopId}/evidence/{evidenceId}`) đúng hình dạng
 * `firebase/firestore.rules` yêu cầu: tệp đã đóng và đọc được (`clientFileState: 'queued'`), mã băm
 * thiết bị tính (`sha256Client`, máy chủ tính lại và không tin), liên kết bằng ID phiên + đơn + kiện.
 * Chỉ để TẠO; trạng thái máy chủ (`server.*`) không bao giờ do client ghi.
 */
export function evidenceWrite(
  request: UploadRequest & { readonly mimeType: string },
  uid: string,
  v: RemoteValues,
  appVersion?: string,
) {
  return {
    path: `shops/${request.shopId}/evidence/${request.evidenceId}`,
    data: {
      shopId: request.shopId,
      sessionId: request.sessionId,
      orderId: request.orderId,
      packageId: request.packageId,
      kind: request.kind === 'video' ? 'original_video' : 'photo',
      origin: 'in_app_capture',
      clientFileState: 'queued',
      sha256Client: request.sha256Client,
      sizeBytes: request.sizeBytes,
      ...(request.durationMs !== null ? { durationMs: request.durationMs } : {}),
      mimeType: request.mimeType,
      capturedAtDevice: v.timestamp(request.createdAtDevice),
      createdAtServer: v.serverTimestamp(),
      createdBy: uid,
      ...(appVersion ? { appVersion } : {}),
    },
  };
}
