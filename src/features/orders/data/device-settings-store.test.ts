import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';
import type { SqlDatabase } from '@/platform/sql-database';

import { booleanSetting, type DeviceSettingsStore } from '../domain/device-settings';
import { createDeviceSettings } from './device-settings';
import {
  createLocalDeviceSettingsStore,
  createMemoryDeviceSettingsStore,
  createSqliteDeviceSettingsStore,
} from './device-settings-store';
import { MIGRATIONS } from './sqlite-migrations';

const FLAG = booleanSetting('test.flag', false);
const ON_BY_DEFAULT = booleanSetting('test.on', true);

const kinds: [string, () => DeviceSettingsStore][] = [
  ['bộ nhớ', createMemoryDeviceSettingsStore],
  ['SQLite (node:sqlite)', () => createSqliteDeviceSettingsStore(createNodeSqliteDatabase())],
];

describe.each(kinds)('kho cài đặt máy: %s', (_name, make) => {
  it('chưa lưu = undefined; ghi rồi đọc; ghi đè', async () => {
    const store = make();
    expect(await store.read('a')).toBeUndefined();
    await store.write('a', 'true', 1);
    expect(await store.read('a')).toBe('true');
    await store.write('a', 'false', 2);
    expect(await store.read('a')).toBe('false');
    expect(await store.read('b')).toBeUndefined();
  });
});

describe('kho cài đặt máy SQLite', () => {
  it('migrate ở lần dùng đầu và giá trị còn khi mở kho mới trên cùng CSDL (sống qua tắt app)', async () => {
    const db = createNodeSqliteDatabase();
    await createSqliteDeviceSettingsStore(db).write('upload.wifi_only', 'true', 5);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    expect(await createSqliteDeviceSettingsStore(db).read('upload.wifi_only')).toBe('true');
    const row = await db.getFirstAsync<{ updated_at_device: number }>(
      'SELECT updated_at_device FROM device_settings WHERE key = ?',
      ['upload.wifi_only'],
    );
    expect(row?.updated_at_device).toBe(5);
  });

  it('kho lười: web (open trả null) dùng bộ nhớ; mở lỗi thì ném và lần sau thử lại', async () => {
    expect(await createLocalDeviceSettingsStore(async () => null).read('x')).toBeUndefined();
    let fail = true;
    const db = createNodeSqliteDatabase();
    const store = createLocalDeviceSettingsStore(async (): Promise<SqlDatabase> => {
      if (fail) throw new Error('mở lỗi');
      return db;
    });
    await expect(store.read('x')).rejects.toThrow('mở lỗi');
    fail = false;
    await store.write('x', '1', 1);
    expect(await store.read('x')).toBe('1');
  });
});

describe('createDeviceSettings (bộ đệm + người nghe)', () => {
  it('chưa nạp: peek trả mặc định với loaded = false (cùng đối tượng giữa các lần gọi)', () => {
    const settings = createDeviceSettings(createMemoryDeviceSettingsStore());
    const first = settings.peek(FLAG);
    expect(first).toEqual({ loaded: false, value: false });
    expect(settings.peek(FLAG)).toBe(first);
    expect(settings.peek(ON_BY_DEFAULT).value).toBe(true);
  });

  it('nạp giá trị đã lưu, báo người nghe; JSON hỏng hoặc sai kiểu -> mặc định', async () => {
    const store = createMemoryDeviceSettingsStore();
    await store.write('test.flag', 'true', 1);
    await store.write('test.on', '"yes"', 1);
    const settings = createDeviceSettings(store);
    const heard = jest.fn();
    settings.subscribe('test.flag', heard);
    expect(await settings.load(FLAG)).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(settings.peek(FLAG)).toEqual({ loaded: true, value: true });
    expect(await settings.load(ON_BY_DEFAULT)).toBe(true);
    await store.write('test.broken', '{', 1);
    expect(await settings.load(booleanSetting('test.broken', false))).toBe(false);
  });

  it('đọc lỗi -> mặc định, không ném', async () => {
    const settings = createDeviceSettings({
      read: async () => {
        throw new Error('hỏng');
      },
      write: async () => undefined,
    });
    expect(await settings.load(FLAG)).toBe(false);
    expect(settings.peek(FLAG).loaded).toBe(true);
  });

  it('ghi: lưu kho TRƯỚC rồi mới đổi bộ đệm; ghi lỗi thì ném và giá trị giữ nguyên', async () => {
    const store = createMemoryDeviceSettingsStore();
    const settings = createDeviceSettings(store, () => 42);
    await settings.load(FLAG);
    const heard = jest.fn();
    const unsubscribe = settings.subscribe('test.flag', heard);
    await settings.set(FLAG, true);
    expect(await store.read('test.flag')).toBe('true');
    expect(settings.peek(FLAG).value).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
    unsubscribe();
    const failing = createDeviceSettings({
      read: async () => undefined,
      write: async () => {
        throw new Error('đầy');
      },
    });
    await failing.load(FLAG);
    await expect(failing.set(FLAG, true)).rejects.toThrow('đầy');
    expect(failing.peek(FLAG).value).toBe(false);
  });

  it('ghi xong trong lúc đang nạp: giữ giá trị vừa ghi', async () => {
    let resolveRead: (v: string | undefined) => void = () => undefined;
    const written = new Map<string, string>();
    const settings = createDeviceSettings({
      read: () => new Promise((r) => (resolveRead = r)),
      write: async (k, v) => void written.set(k, v),
    });
    const loading = settings.load(FLAG);
    await settings.set(FLAG, true);
    resolveRead('false');
    expect(await loading).toBe(true);
    expect(settings.peek(FLAG).value).toBe(true);
  });
});
