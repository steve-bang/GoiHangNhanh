import { logger } from '@/core/logging/logger';

import {
  decodeDeviceSetting,
  encodeDeviceSetting,
  type DeviceSettingDefinition,
  type DeviceSettingsStore,
} from '../domain/device-settings';

/** Ảnh chụp một cài đặt: `loaded = false` khi chưa đọc xong từ kho (giá trị là mặc định). */
export interface DeviceSettingSnapshot<T> {
  readonly loaded: boolean;
  readonly value: T;
}

/**
 * Bộ điều khiển cài đặt máy dùng chung cả app (một thể hiện trong `DeviceSettingsProvider`): bộ đệm
 * theo khóa + người nghe. Màn hình đọc qua `useDeviceSetting`; mã chạy nền (hàng đợi tải lên) đọc
 * đồng bộ qua `peek` và nghe `subscribe`.
 */
export interface DeviceSettings {
  /** Đọc đồng bộ từ bộ đệm; cùng giá trị thì trả CÙNG đối tượng (dùng được với `useSyncExternalStore`). */
  peek<T>(definition: DeviceSettingDefinition<T>): DeviceSettingSnapshot<T>;
  /** Nạp từ kho nếu chưa nạp. Đọc lỗi: dùng mặc định (đã ghi log, không ném). */
  load<T>(definition: DeviceSettingDefinition<T>): Promise<T>;
  /** Ghi kho TRƯỚC; thành công mới đổi bộ đệm và báo người nghe. Ghi lỗi thì ném, giá trị giữ nguyên. */
  set<T>(definition: DeviceSettingDefinition<T>, value: T): Promise<void>;
  /** Nghe thay đổi của MỘT khóa (nạp xong hoặc ghi xong). Trả hàm hủy. */
  subscribe(key: string, listener: () => void): () => void;
}

export function createDeviceSettings(
  store: DeviceSettingsStore,
  now: () => number = Date.now,
): DeviceSettings {
  const snapshots = new Map<string, DeviceSettingSnapshot<unknown>>();
  const pending = new Map<string, Promise<unknown>>();
  const listeners = new Map<string, Set<() => void>>();

  const notify = (key: string) => {
    for (const listener of [...(listeners.get(key) ?? [])]) listener();
  };
  const put = (key: string, value: unknown) => {
    snapshots.set(key, { loaded: true, value });
    notify(key);
  };
  const defaults = new Map<string, DeviceSettingSnapshot<unknown>>();
  const notLoaded = <T>(definition: DeviceSettingDefinition<T>): DeviceSettingSnapshot<T> => {
    let snapshot = defaults.get(definition.key);
    if (!snapshot) {
      snapshot = { loaded: false, value: definition.defaultValue };
      defaults.set(definition.key, snapshot);
    }
    return snapshot as DeviceSettingSnapshot<T>;
  };

  const load = <T>(definition: DeviceSettingDefinition<T>): Promise<T> => {
    const cached = snapshots.get(definition.key);
    if (cached) return Promise.resolve(cached.value as T);
    let task = pending.get(definition.key) as Promise<T> | undefined;
    if (!task) {
      task = store
        .read(definition.key)
        .then((stored) => decodeDeviceSetting(definition, stored))
        .catch((error: unknown) => {
          logger.warn('device_settings.read_failed', {
            reason: error instanceof Error ? error.name : 'unknown',
          });
          return definition.defaultValue;
        })
        .then((value) => {
          pending.delete(definition.key);
          // Một lần ghi đã xong trong lúc đang đọc thì giữ giá trị đã ghi.
          if (!snapshots.has(definition.key)) put(definition.key, value);
          return snapshots.get(definition.key)?.value as T;
        });
      pending.set(definition.key, task);
    }
    return task;
  };

  return {
    peek: (definition) =>
      (snapshots.get(definition.key) as DeviceSettingSnapshot<never> | undefined) ??
      notLoaded(definition),
    load,
    set: async (definition, value) => {
      await store.write(definition.key, encodeDeviceSetting(value), now());
      put(definition.key, value);
    },
    subscribe: (key, listener) => {
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
  };
}
