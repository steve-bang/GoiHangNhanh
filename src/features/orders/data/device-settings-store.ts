import type { SqlDatabase } from '@/platform/sql-database';

import type { DeviceSettingsStore } from '../domain/device-settings';
import { runSerialized } from './db-queue';
import { migrateLocalDatabase } from './sqlite-order-store';

/**
 * Kho cài đặt máy trên SQLite (bảng `device_settings`, migration v15), CÙNG kết nối và hàng đợi tuần tự
 * với kho đơn/kho tệp (`db-queue.ts`). Migrate ở lần dùng đầu như các kho khác.
 */
export function createSqliteDeviceSettingsStore(db: SqlDatabase): DeviceSettingsStore {
  let ready: Promise<void> | null = null;
  const run = <T>(task: () => Promise<T>): Promise<T> =>
    runSerialized(db, async () => {
      if (!ready) {
        ready = migrateLocalDatabase(db).catch((error: unknown) => {
          ready = null; // lần sau thử lại
          throw error;
        });
      }
      await ready;
      return task();
    });
  return {
    read: (key) =>
      run(async () => {
        const row = await db.getFirstAsync<{ value: string }>(
          'SELECT value FROM device_settings WHERE key = ?',
          [key],
        );
        return row?.value;
      }),
    write: (key, value, atDevice) =>
      run(() =>
        db.runAsync(
          `INSERT INTO device_settings (key, value, updated_at_device) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at_device = excluded.updated_at_device`,
          [key, value, atDevice],
        ),
      ),
  };
}

/** Kho trong bộ nhớ (web, test): mất khi tắt app. */
export function createMemoryDeviceSettingsStore(): DeviceSettingsStore {
  const values = new Map<string, string>();
  return {
    read: async (key) => values.get(key),
    write: async (key, value) => {
      values.set(key, value);
    },
  };
}

/**
 * Kho khi chạy: mở SQLite lần đầu cần tới (lười). `open` trả `null` (web) thì dùng kho bộ nhớ. Mở lỗi thì
 * thao tác ném lỗi (người gọi dùng giá trị mặc định khi đọc, báo lỗi khi ghi); lần sau thử mở lại.
 */
export function createLocalDeviceSettingsStore(
  open: () => Promise<SqlDatabase | null>,
): DeviceSettingsStore {
  let resolved: Promise<DeviceSettingsStore> | null = null;
  const get = () => {
    if (!resolved) {
      resolved = open()
        .then((db) =>
          db ? createSqliteDeviceSettingsStore(db) : createMemoryDeviceSettingsStore(),
        )
        .catch((error: unknown) => {
          resolved = null;
          throw error;
        });
    }
    return resolved;
  };
  return {
    read: async (key) => (await get()).read(key),
    write: async (key, value, atDevice) => (await get()).write(key, value, atDevice),
  };
}
