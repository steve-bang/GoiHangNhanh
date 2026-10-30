import { File, Paths } from 'expo-file-system';

/**
 * Dấu "đang xóa dữ liệu trên máy" sau khi máy chủ xác nhận xóa tài khoản (V1-15). Là tệp RIÊNG trong thư
 * mục tài liệu, NGOÀI cơ sở dữ liệu sắp bị xóa và ngoài thư mục `evidence/`, để app bị tắt giữa chừng thì
 * lần mở sau vẫn thấy dấu và chạy lại việc xóa trước khi bật bất kỳ tiến trình nền nào. Nội dung chỉ là
 * phiên bản định dạng (không email, không uid, không mã đơn). Mọi hàm ĐỒNG BỘ (đọc được ngay lần render
 * đầu) và không ném lỗi. Chưa kiểm chứng trên thiết bị.
 */
export const LOCAL_WIPE_MARKER_NAME = '.pending-local-wipe';
const MARKER_CONTENT = 'v1';

const markerFile = () => new File(Paths.document, LOCAL_WIPE_MARKER_NAME);

/** Có dấu không. Không đọc được hệ tệp (ví dụ bản web) thì `false`: không có gì trên đĩa để xóa tiếp. */
export function hasPendingLocalWipe(): boolean {
  try {
    return markerFile().exists;
  } catch {
    return false;
  }
}

/** Đặt dấu; `true` khi dấu chắc chắn đã có trên đĩa. */
export function setPendingLocalWipe(): boolean {
  try {
    const file = markerFile();
    if (!file.exists) file.create();
    file.write(MARKER_CONTENT);
    return file.exists;
  } catch {
    return false;
  }
}

/** Gỡ dấu; `true` khi dấu chắc chắn không còn (gỡ lặp lại an toàn). */
export function clearPendingLocalWipe(): boolean {
  try {
    const file = markerFile();
    if (file.exists) file.delete();
    return !file.exists;
  } catch {
    return false;
  }
}
