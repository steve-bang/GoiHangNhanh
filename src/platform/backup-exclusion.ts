import { requireOptionalNativeModule } from 'expo';

import { logger } from '@/core/logging/logger';

/**
 * Loại dữ liệu cục bộ khỏi sao lưu của hệ điều hành (V1-12, Q-24d A). iOS: module Expo cục bộ
 * `modules/backup-exclusion` đặt `isExcludedFromBackup` cho THƯ MỤC (áp cho cả tệp tạo sau). Android:
 * không có module, vì `android.allowBackup: false` (V1-01) đã loại toàn bộ dữ liệu app; web, Expo Go,
 * Jest: không có module. Không có module thì không làm gì (`unsupported`).
 *
 * Cờ chỉ là gợi ý cho hệ thống sao lưu, không ảnh hưởng đọc/ghi tệp: lỗi KHÔNG chặn app, không ném,
 * chỉ log cảnh báo với loại thư mục + kết quả (không đường dẫn: đường dẫn container chứa UUID máy).
 * Gọi lặp lại vô hại. Chưa kiểm chứng trên thiết bị (release-checklist G-7).
 */
export type BackupTarget = 'evidence' | 'database';

export type BackupExclusionResult = 'excluded' | 'not_found' | 'failed' | 'unsupported';

/** Hợp đồng của module native `DonChungBackupExclusion` (`BackupExclusionModule.swift`). */
export type BackupExclusionNative = {
  excludeFromBackup(path: string): Promise<string>;
};

const NATIVE_MODULE_NAME = 'DonChungBackupExclusion';

let loggedUnsupported = false;

function loadNative(): BackupExclusionNative | null {
  try {
    return requireOptionalNativeModule<BackupExclusionNative>(NATIVE_MODULE_NAME);
  } catch {
    return null;
  }
}

/** Có module native không (chỉ bản build iOS có module cục bộ). */
export function isBackupExclusionSupported(): boolean {
  return loadNative() !== null;
}

const KNOWN: ReadonlySet<string> = new Set(['excluded', 'not_found', 'failed']);

export async function excludeFromBackup(
  target: BackupTarget,
  uri: string,
): Promise<BackupExclusionResult> {
  let result: BackupExclusionResult;
  try {
    const native = loadNative();
    if (!native) {
      if (!loggedUnsupported) {
        loggedUnsupported = true;
        logger.debug('backup_exclusion.unsupported');
      }
      return 'unsupported';
    }
    const raw = await native.excludeFromBackup(uri);
    result = KNOWN.has(raw) ? (raw as BackupExclusionResult) : 'failed';
  } catch {
    result = 'failed';
  }
  if (result !== 'excluded') logger.warn('backup_exclusion.not_applied', { target, result });
  return result;
}
