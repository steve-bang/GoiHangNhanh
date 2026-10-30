import type { OrderStore } from '@/features/orders';

/** Tình trạng toàn máy cần cho đăng xuất và xóa tài khoản; `null` = không đọc được (không suy ra "sạch"). */
export type DeviceFacts = { readonly recording: boolean | null; readonly unsynced: number | null };

/**
 * Đọc "đang quay" và "số tệp chưa đồng bộ" trên TOÀN thiết bị. Lỗi đọc từng mục -> `null`, không ném.
 *
 * Có `uid` (đăng xuất, V1-07): chỉ đếm tệp do CHÍNH tài khoản đó tạo. Tệp của tài khoản khác trên máy này
 * không tải được dưới tài khoản hiện tại (Q-24g), nên không chặn đăng xuất: đăng xuất chính là cách để
 * tài khoản kia đăng nhập lại và tải (đăng xuất không xóa gì, Q-20h). Không có `uid` (chưa biết tài khoản,
 * hoặc Xóa tài khoản) thì đếm mọi tệp trên máy (bảo thủ).
 */
export async function readDeviceFacts(
  store: Pick<
    OrderStore,
    'hasRecordingOnDevice' | 'countUnsyncedOnDevice' | 'countUnsyncedByOwner'
  >,
  uid: string | null = null,
): Promise<DeviceFacts> {
  const [recording, unsynced] = await Promise.all([
    store.hasRecordingOnDevice().catch(() => null),
    (uid
      ? store.countUnsyncedByOwner('device', uid).then((n) => n.own)
      : store.countUnsyncedOnDevice()
    ).catch(() => null),
  ]);
  return { recording, unsynced };
}
