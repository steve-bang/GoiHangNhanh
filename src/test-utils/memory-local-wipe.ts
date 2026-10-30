import type { LocalDeviceData } from '@/features/orders';
import type { LocalWipeFileSteps } from '@/features/personal';

/**
 * Bản giả của phần "xóa dữ liệu trên máy" (V1-15) cho test giao diện: dấu, thư mục `evidence/` và CSDL
 * chỉ là biến trong bộ nhớ; `log` ghi thứ tự gọi. Không đụng expo-file-system/expo-sqlite.
 */
export function createMemoryLocalWipe(
  options: { foreignRecords?: number; pending?: boolean; failDatabase?: boolean } = {},
) {
  const state = {
    marker: options.pending ?? false,
    foreignRecords: options.foreignRecords ?? 0,
    failDatabase: options.failDatabase ?? false,
    log: [] as string[],
  };
  const device: LocalDeviceData = {
    countForeignRecords: async () => state.foreignRecords,
    wipeDatabase: async () => {
      state.log.push('wipeDatabase');
      if (state.failDatabase) throw new Error('disk');
    },
  };
  const files: LocalWipeFileSteps = {
    hasMarker: () => state.marker,
    setMarker: () => {
      state.log.push('setMarker');
      state.marker = true;
      return true;
    },
    deleteEvidenceFiles: () => {
      state.log.push('deleteEvidenceFiles');
      return true;
    },
    clearMarker: () => {
      state.log.push('clearMarker');
      state.marker = false;
      return true;
    },
  };
  return { state, device, files };
}
