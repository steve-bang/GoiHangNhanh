import type { OrderStore } from '@/features/orders';

/** Tình trạng toàn máy cần cho đăng xuất và xóa tài khoản; `null` = không đọc được (không suy ra "sạch"). */
export type DeviceFacts = { readonly recording: boolean | null; readonly unsynced: number | null };

/** Đọc "đang quay" và "số tệp chưa đồng bộ" trên TOÀN thiết bị. Lỗi đọc từng mục -> `null`, không ném. */
export async function readDeviceFacts(
  store: Pick<OrderStore, 'hasRecordingOnDevice' | 'countUnsyncedOnDevice'>,
): Promise<DeviceFacts> {
  const [recording, unsynced] = await Promise.all([
    store.hasRecordingOnDevice().catch(() => null),
    store.countUnsyncedOnDevice().catch(() => null),
  ]);
  return { recording, unsynced };
}
