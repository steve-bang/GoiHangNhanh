import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SqlDatabase } from '@/platform';
import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { MIGRATIONS } from './sqlite-migrations';
import { migrateLocalDatabase } from './sqlite-order-store';
import {
  countForeignRecords,
  createLocalDataWiper,
  KEPT_TABLES,
  LocalWipeError,
  WIPED_TABLES,
  wipeLocalDatabase,
  type LocalWipeSteps,
} from './wipe-local-data';

const HASH = 'a'.repeat(64);

/** Một bộ dữ liệu đủ chuỗi khóa ngoại: đơn -> kiện -> phiên -> tệp; hồ sơ hoàn + media; tranh chấp. */
async function seed(db: ReturnType<typeof createNodeSqliteDatabase>, uid: string | null = 'u-a') {
  await db.runAsync(
    `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, data_origin, created_at_device, created_by)
     VALUES ('o1', 'shop-a', 'DH-1', 'DH-1', 'shopee', 'entered_by_user', 1, ?)`,
    [uid],
  );
  await db.runAsync(
    `INSERT INTO order_lines (id, order_id, name, quantity, position, data_origin, created_at_device)
     VALUES ('l1', 'o1', 'Áo', 1, 0, 'entered_by_user', 1)`,
  );
  await db.runAsync(
    "INSERT INTO packages (id, order_id, idx, created_at_device, created_by) VALUES ('p1', 'o1', 1, 1, ?)",
    [uid],
  );
  await db.runAsync(
    `INSERT INTO packing_sessions (id, shop_id, order_id, package_id, started_at_device, snapshot_json,
       session_status, created_by) VALUES ('s1', 'shop-a', 'o1', 'p1', 5, '{}', 'ended', ?)`,
    [uid],
  );
  await db.runAsync(
    `INSERT INTO evidence_files (id, shop_id, order_id, package_id, session_id, file_group, kind, state,
       local_path, size_bytes, sha256_client, created_at_device, updated_at_device)
     VALUES ('e1', 'shop-a', 'o1', 'p1', 's1', 'pack', 'video', 'queued', 'evidence/e1.mp4', 10, ?, 6, 6)`,
    [HASH],
  );
  await db.runAsync(
    `INSERT INTO search_history (shop_id, query_key, query_text, last_used_at_device)
     VALUES ('shop-a', 'DH-1', 'DH-1', 1)`,
  );
  await db.runAsync(
    `INSERT INTO return_cases (id, shop_id, seq, code, status, created_at_device, updated_at_device, created_by)
     VALUES ('r1', 'shop-a', 1, 'RH-00001', 'receiving', 1, 1, ?)`,
    [uid],
  );
  await db.runAsync(
    `INSERT INTO return_link_events (id, return_id, shop_id, order_id, basis, at_device)
     VALUES ('rl1', 'r1', 'shop-a', 'o1', 'manual', 1)`,
  );
  await db.runAsync(
    `INSERT INTO return_lines (id, return_id, shop_id, position, name) VALUES ('rli1', 'r1', 'shop-a', 0, 'Áo')`,
  );
  await db.runAsync(
    `INSERT INTO return_media (id, return_id, shop_id, kind, state, local_path, size_bytes, sha256_client,
       created_at_device, updated_at_device, created_by)
     VALUES ('m1', 'r1', 'shop-a', 'photo', 'queued', 'evidence/m1.jpg', 5, ?, 2, 2, ?)`,
    [HASH, uid],
  );
  await db.runAsync(
    `INSERT INTO disputes (id, shop_id, seq, code, status, subject_kind, order_id, subject_label, issue_type,
       created_at_device, updated_at_device, created_by)
     VALUES ('d1', 'shop-a', 1, 'TC-00001', 'closed', 'order', 'o1', 'DH-1', 'missing_item', 1, 1, ?)`,
    [uid],
  );
  await db.runAsync(
    `INSERT INTO dispute_evidence (dispute_id, shop_id, evidence_id, added_at_device) VALUES ('d1', 'shop-a', 'e1', 1)`,
  );
  await db.runAsync(
    `INSERT INTO dispute_events (id, dispute_id, shop_id, kind, at_device) VALUES ('de1', 'd1', 'shop-a', 'created', 1)`,
  );
  await db.runAsync(
    "INSERT INTO device_settings (key, value, updated_at_device) VALUES ('upload.wifiOnly', 'true', 1)",
  );
}

async function userTables(db: ReturnType<typeof createNodeSqliteDatabase>): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((r) => r.name);
}

describe('wipeLocalDatabase (V1-15)', () => {
  it('mọi bảng của schema mới nhất nằm trong đúng một danh sách (xóa hoặc giữ)', async () => {
    const db = createNodeSqliteDatabase();
    await migrateLocalDatabase(db);
    const tables = await userTables(db);
    expect([...WIPED_TABLES, ...KEPT_TABLES].sort()).toEqual(tables);
    expect(WIPED_TABLES.filter((t) => KEPT_TABLES.includes(t))).toEqual([]);
  });

  it('xóa hết bảng nghiệp vụ (khóa ngoại bật), giữ cài đặt máy, schema và user_version; gọi lại được', async () => {
    const db = createNodeSqliteDatabase();
    await migrateLocalDatabase(db);
    await seed(db);
    await wipeLocalDatabase(db);
    for (const table of WIPED_TABLES) {
      const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      expect([table, row?.n]).toEqual([table, 0]);
    }
    expect(await db.getAllAsync('SELECT key FROM device_settings')).toEqual([
      { key: 'upload.wifiOnly' },
    ]);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    await expect(wipeLocalDatabase(db)).resolves.toBeUndefined();
  });

  it('CSDL chưa ai mở trong lần chạy này (khởi động thấy dấu): tự migrate rồi xóa', async () => {
    const db = createNodeSqliteDatabase();
    await expect(wipeLocalDatabase(db)).resolves.toBeUndefined();
    expect((await userTables(db)).length).toBe(WIPED_TABLES.length + KEPT_TABLES.length);
  });
});

describe('wipeLocalDatabase: không để dữ liệu đã xóa còn trên đĩa (review PR #61)', () => {
  it('tệp CSDL thật (WAL): sau khi xóa, chuỗi đã lưu không còn trong tệp chính lẫn tệp -wal', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'v1-15-wipe-'));
    const file = join(dir, 'doncung.db');
    try {
      const db = createNodeSqliteDatabase(file);
      await db.execAsync('PRAGMA journal_mode = WAL');
      await migrateLocalDatabase(db);
      await seed(db);
      await db.runAsync("UPDATE orders SET order_code = 'BI-MAT-DH-424242' WHERE id = 'o1'");
      await wipeLocalDatabase(db);
      const contains = (path: string) =>
        existsSync(path) && readFileSync(path).includes(Buffer.from('BI-MAT-DH-424242'));
      expect(contains(file)).toBe(false);
      expect(contains(`${file}-wal`)).toBe(false);
      const secure = await db.getFirstAsync<{ secure_delete: number }>('PRAGMA secure_delete');
      expect(secure?.secure_delete).toBe(1);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('thứ tự: secure_delete trước DELETE; checkpoint và VACUUM sau giao dịch; hai bước này lỗi thì vẫn xong', async () => {
    const real = createNodeSqliteDatabase();
    await migrateLocalDatabase(real);
    await seed(real);
    const log: string[] = [];
    const db: SqlDatabase = {
      ...real,
      execAsync: async (sql) => {
        log.push(sql.trim().split('\n')[0] ?? '');
        if (sql === 'VACUUM') throw new Error('busy');
        return real.execAsync(sql);
      },
      runAsync: async (sql, params) => {
        if (sql.startsWith('DELETE')) log.push('DELETE');
        return real.runAsync(sql, params);
      },
      getFirstAsync: async <T>(sql: string, params?: readonly (string | number | null)[]) => {
        if (sql.startsWith('PRAGMA wal_checkpoint')) {
          log.push('checkpoint');
          throw new Error('locked');
        }
        return real.getFirstAsync<T>(sql, params);
      },
      withTransactionAsync: async (task) => {
        log.push('BEGIN');
        await real.withTransactionAsync(task);
        log.push('COMMIT');
      },
    };
    await expect(wipeLocalDatabase(db)).resolves.toBeUndefined();
    const at = (entry: string) => log.indexOf(entry);
    expect(at('PRAGMA secure_delete = ON')).toBeGreaterThanOrEqual(0);
    expect(at('PRAGMA secure_delete = ON')).toBeLessThan(at('BEGIN'));
    expect(at('DELETE')).toBeGreaterThan(at('BEGIN'));
    expect(at('checkpoint')).toBeGreaterThan(at('COMMIT'));
    expect(at('VACUUM')).toBeGreaterThan(at('checkpoint'));
    const row = await real.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM orders');
    expect(row?.n).toBe(0);
  });
});

describe('countForeignRecords (V1-15)', () => {
  it('dữ liệu của chính uid: 0; của uid khác hoặc không rõ người tạo: đếm theo từng bản ghi', async () => {
    const own = createNodeSqliteDatabase();
    await migrateLocalDatabase(own);
    await seed(own, 'u-a');
    expect(await countForeignRecords(own, 'u-a')).toBe(0);
    // Sáu bảng có người tạo, mỗi bảng một dòng của u-a.
    expect(await countForeignRecords(own, 'u-b')).toBe(6);

    const unknown = createNodeSqliteDatabase();
    await migrateLocalDatabase(unknown);
    await seed(unknown, null);
    expect(await countForeignRecords(unknown, 'u-a')).toBe(6);
  });
});

/** Bước giả có nhật ký gọi + "đĩa" giả (dấu, tệp, CSDL) để giả lập app bị tắt sau từng bước. */
function fakeDevice() {
  const disk = { marker: false, files: 3, rows: 5, authSignedIn: true };
  const log: string[] = [];
  let killAfter: string | null = null;
  const step = (name: string) => {
    log.push(name);
    if (killAfter === name) {
      killAfter = null;
      throw new Error('KILLED');
    }
  };
  const steps: LocalWipeSteps = {
    hasMarker: () => disk.marker,
    setMarker: () => {
      disk.marker = true;
      step('setMarker');
      return true;
    },
    deleteEvidenceFiles: () => {
      disk.files = 0;
      step('deleteEvidenceFiles');
      return true;
    },
    wipeDatabase: async () => {
      disk.rows = 0;
      step('wipeDatabase');
    },
    signOutLocal: async () => {
      disk.authSignedIn = false;
      step('signOutLocal');
    },
    clearMarker: () => {
      disk.marker = false;
      step('clearMarker');
      return true;
    },
  };
  return {
    disk,
    log,
    steps,
    killAfter: (name: string) => {
      killAfter = name;
    },
  };
}

describe('createLocalDataWiper: thứ tự bền và chạy lại sau khi app bị tắt (V1-15)', () => {
  it('đúng thứ tự: đặt dấu -> xóa tệp -> xóa CSDL -> thoát Auth trên máy -> gỡ dấu', async () => {
    const device = fakeDevice();
    const wiper = createLocalDataWiper(device.steps);
    expect(wiper.hasPending()).toBe(false);
    await wiper.run();
    expect(device.log).toEqual([
      'setMarker',
      'deleteEvidenceFiles',
      'wipeDatabase',
      'signOutLocal',
      'clearMarker',
    ]);
    expect(device.disk).toEqual({ marker: false, files: 0, rows: 0, authSignedIn: false });
  });

  it.each(['setMarker', 'deleteEvidenceFiles', 'wipeDatabase', 'signOutLocal'])(
    'app bị tắt ngay sau "%s": lần mở sau thấy dấu, chạy lại TỪ ĐẦU, kết quả như chạy một lần',
    async (killed) => {
      const device = fakeDevice();
      device.killAfter(killed);
      // Thoát Auth lỗi được nuốt (tài khoản đã bị xóa ở máy chủ); các bước khác "tắt app" là ném.
      const first = createLocalDataWiper(device.steps).run();
      if (killed === 'signOutLocal') await first.catch(() => undefined);
      else await expect(first).rejects.toThrow();
      // Khởi động lại: tiến trình mới, đối tượng mới, chỉ còn "đĩa".
      const restarted = createLocalDataWiper(device.steps);
      if (killed !== 'signOutLocal') {
        expect(restarted.hasPending()).toBe(true);
        device.log.length = 0;
        await restarted.run();
        expect(device.log[0]).toBe('setMarker');
      }
      expect(restarted.hasPending()).toBe(false);
      expect(device.disk).toEqual({ marker: false, files: 0, rows: 0, authSignedIn: false });
    },
  );

  it('không có dấu khi khởi động: không xóa gì', () => {
    const device = fakeDevice();
    const wiper = createLocalDataWiper(device.steps);
    expect(wiper.hasPending()).toBe(false);
    expect(device.log).toEqual([]);
    expect(device.disk.rows).toBe(5);
  });

  it.each([
    ['deleteEvidenceFiles', 'evidence_files'],
    ['clearMarker', 'marker'],
  ] as const)('"%s" báo chưa xong: ném LocalWipeError(%s), GIỮ dấu', async (name, failure) => {
    const device = fakeDevice();
    const steps: LocalWipeSteps = {
      ...device.steps,
      [name]: () => {
        device.log.push(name);
        return false;
      },
    };
    const error = await createLocalDataWiper(steps)
      .run()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LocalWipeError);
    expect((error as LocalWipeError).step).toBe(failure);
    expect(device.disk.marker).toBe(true);
  });

  it('xóa CSDL lỗi: LocalWipeError(database), giữ dấu, không thoát Auth', async () => {
    const device = fakeDevice();
    const wiper = createLocalDataWiper({
      ...device.steps,
      wipeDatabase: async () => {
        throw new Error('disk');
      },
    });
    await expect(wiper.run()).rejects.toMatchObject({ step: 'database' });
    expect(device.disk.marker).toBe(true);
    expect(device.disk.authSignedIn).toBe(true);
  });

  it('dấu nằm ngoài CSDL: xóa CSDL không làm mất dấu', async () => {
    const db = createNodeSqliteDatabase();
    await migrateLocalDatabase(db);
    await seed(db);
    let marker = false;
    let markerSeenAfterDbWipe: boolean | null = null;
    await createLocalDataWiper({
      hasMarker: () => marker,
      setMarker: () => (marker = true),
      deleteEvidenceFiles: () => true,
      wipeDatabase: async () => {
        await wipeLocalDatabase(db);
        markerSeenAfterDbWipe = marker;
      },
      signOutLocal: async () => undefined,
      clearMarker: () => !(marker = false),
    }).run();
    expect(markerSeenAfterDbWipe).toBe(true);
    expect(marker).toBe(false);
  });

  it('gọi chồng khi đang chạy: dùng chung một lần chạy', async () => {
    const device = fakeDevice();
    const wiper = createLocalDataWiper(device.steps);
    await Promise.all([wiper.run(), wiper.run()]);
    expect(device.log.filter((s) => s === 'setMarker')).toHaveLength(1);
  });
});
