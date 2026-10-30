import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { openLocalDatabase } from '@/platform';

import type { DeviceSettingDefinition, DeviceSettingsStore } from '../domain/device-settings';
import { createDeviceSettings, type DeviceSettings } from './device-settings';
import { createLocalDeviceSettingsStore } from './device-settings-store';

const DeviceSettingsContext = createContext<DeviceSettings | null>(null);

/** Cung cấp cài đặt máy (V1-09). Test truyền `store` (kho bộ nhớ riêng của bài test). */
export function DeviceSettingsProvider({
  store,
  children,
}: {
  store?: DeviceSettingsStore;
  children: ReactNode;
}) {
  const value = useMemo(
    () => createDeviceSettings(store ?? createLocalDeviceSettingsStore(openLocalDatabase)),
    [store],
  );
  return <DeviceSettingsContext.Provider value={value}>{children}</DeviceSettingsContext.Provider>;
}

export function useDeviceSettings(): DeviceSettings {
  const settings = useContext(DeviceSettingsContext);
  if (!settings) {
    throw new Error('useDeviceSettings cần DeviceSettingsProvider (src/bootstrap/Providers.tsx)');
  }
  return settings;
}

/**
 * Một cài đặt máy cho màn hình: nạp khi gắn, cập nhật khi nơi khác đổi. `setValue` ném khi ghi lỗi
 * (màn hình báo lỗi; giá trị hiển thị giữ nguyên).
 */
export function useDeviceSetting<T>(definition: DeviceSettingDefinition<T>) {
  const settings = useDeviceSettings();
  const subscribe = useCallback(
    (listener: () => void) => settings.subscribe(definition.key, listener),
    [settings, definition.key],
  );
  const read = useCallback(() => settings.peek(definition), [settings, definition]);
  const snapshot = useSyncExternalStore(subscribe, read, read);
  useEffect(() => {
    void settings.load(definition);
  }, [settings, definition]);
  const setValue = useCallback(
    (value: T) => settings.set(definition, value),
    [settings, definition],
  );
  return { value: snapshot.value, loaded: snapshot.loaded, setValue };
}
