'use strict';
const path = require('node:path');
const { describe, expect, it } = require('@jest/globals');
const {
  assertUniqueNames,
  contentTypeFor,
  exportEnv,
  isInside,
  parseArgs,
  parseEnvPairs,
  parseRoutes,
  parseRoutesFile,
  parseSizes,
  resolveStaticFile,
  shotFileName,
  slugForRoute,
} = require('./lib.cjs');

const DEFAULTS = { session: 'signed_in', waitMs: 3500, waitFor: undefined, fullPage: false };

describe('parseArgs', () => {
  it('đọc dạng --x v, --x=v, cờ boolean và --env lặp', () => {
    expect(
      parseArgs([
        '--out',
        '/tmp/a',
        '--routes=/,/account',
        '--skip-export',
        '--env',
        'EXPO_PUBLIC_A=1',
        '--env=EXPO_PUBLIC_B=2',
        '--wait-ms',
        '0',
      ]),
    ).toEqual({
      out: '/tmp/a',
      routes: '/,/account',
      skipExport: true,
      env: ['EXPO_PUBLIC_A=1', 'EXPO_PUBLIC_B=2'],
      waitMs: '0',
    });
  });

  it('từ chối tham số lạ, thiếu giá trị, giá trị cho cờ boolean', () => {
    expect(() => parseArgs(['--nope', '1'])).toThrow('Tham số lạ');
    expect(() => parseArgs(['--out'])).toThrow('cần giá trị');
    expect(() => parseArgs(['--skip-export=1'])).toThrow('không nhận giá trị');
    expect(() => parseArgs(['out'])).toThrow('không hợp lệ');
  });
});

describe('parseSizes', () => {
  it('mặc định 390x844, "all" là ba cỡ của kế hoạch', () => {
    expect(parseSizes(undefined)).toEqual([{ width: 390, height: 844 }]);
    expect(parseSizes('all').map((s) => `${s.width}x${s.height}`)).toEqual([
      '320x568',
      '360x800',
      '390x844',
    ]);
    expect(parseSizes('360x800, 390x844')).toHaveLength(2);
  });

  it('từ chối cỡ sai dạng', () => {
    expect(() => parseSizes('390')).toThrow('Cỡ không hợp lệ');
  });
});

describe('routes', () => {
  it('tên mặc định lấy từ route', () => {
    expect(slugForRoute('/')).toBe('root');
    expect(slugForRoute('/account/help?x=1')).toBe('account-help');
    expect(slugForRoute('/orders/[id]/')).toBe('orders-id');
  });

  it('parseRoutes nhận route=tên và dùng giá trị mặc định', () => {
    expect(parseRoutes('/=01-home, /sync', DEFAULTS)).toEqual([
      { route: '/', name: '01-home', ...DEFAULTS },
      { route: '/sync', name: 'sync', ...DEFAULTS },
    ]);
  });

  it('parseRoutesFile cho ghi đè phiên/chờ từng mục', () => {
    const entries = parseRoutesFile(
      JSON.stringify([
        { route: '/welcome', name: 'w', session: 'signed_out', waitMs: 0, waitFor: 'text=Đăng' },
      ]),
      DEFAULTS,
    );
    expect(entries[0]).toEqual({
      route: '/welcome',
      name: 'w',
      session: 'signed_out',
      waitMs: 0,
      waitFor: 'text=Đăng',
      fullPage: false,
    });
  });

  it('từ chối route/tên/phiên/waitMs sai và tệp rỗng', () => {
    expect(() => parseRoutes('account', DEFAULTS)).toThrow('bắt đầu bằng "/"');
    expect(() => parseRoutes('/=../x', DEFAULTS)).toThrow('Tên ảnh không hợp lệ');
    expect(() => parseRoutesFile('[{"route":"/","session":"admin"}]', DEFAULTS)).toThrow(
      'Phiên giả không hợp lệ',
    );
    expect(() => parseRoutesFile('[{"route":"/","waitMs":-1}]', DEFAULTS)).toThrow('waitMs');
    expect(() => parseRoutesFile('[]', DEFAULTS)).toThrow('không rỗng');
  });

  it('báo tên ảnh trùng thay vì ghi đè âm thầm', () => {
    expect(() => assertUniqueNames(parseRoutes('/,/=root', DEFAULTS))).toThrow('trùng');
  });

  it('tên tệp ảnh có cỡ', () => {
    expect(shotFileName('01-home', { width: 390, height: 844 })).toBe('01-home-390x844.png');
  });
});

describe('exportEnv', () => {
  it('luôn ép cổng giả và phiên đã chọn, bỏ emulator và môi trường prod', () => {
    const env = exportEnv(
      {
        PATH: '/bin',
        EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: '10.0.2.2',
        EXPO_PUBLIC_APP_ENV: 'prod',
        APP_ENV: 'prod',
        EXPO_PUBLIC_BACKEND: 'firebase',
      },
      'signed_out',
      { EXPO_PUBLIC_X: '1' },
    );
    expect(env).toEqual({
      PATH: '/bin',
      APP_ENV: 'dev',
      CI: '1',
      EXPO_PUBLIC_USE_FAKE_BACKEND: '1',
      EXPO_PUBLIC_BACKEND: 'fake',
      EXPO_PUBLIC_FAKE_SESSION: 'signed_out',
      EXPO_PUBLIC_X: '1',
    });
  });

  it('--env chỉ nhận EXPO_PUBLIC_*', () => {
    expect(parseEnvPairs(['EXPO_PUBLIC_A=x=y'])).toEqual({ EXPO_PUBLIC_A: 'x=y' });
    expect(() => parseEnvPairs(['PATH=/x'])).toThrow('EXPO_PUBLIC_');
    expect(() => parseEnvPairs(['EXPO_PUBLIC_A'])).toThrow('EXPO_PUBLIC_');
  });
});

describe('máy chủ tĩnh', () => {
  const root = path.resolve('/srv/dist');
  const files = new Set([
    path.join(root, 'index.html'),
    path.join(root, 'app.js'),
    path.join(root, 'welcome.html'),
  ]);
  const exists = (p) => files.has(p);

  it('trả tệp có thật, tệp .html theo route, còn lại index.html (SPA)', () => {
    expect(resolveStaticFile(root, '/app.js?v=1', exists)).toBe(path.join(root, 'app.js'));
    expect(resolveStaticFile(root, '/welcome', exists)).toBe(path.join(root, 'welcome.html'));
    expect(resolveStaticFile(root, '/account/help', exists)).toBe(path.join(root, 'index.html'));
    expect(resolveStaticFile(root, '/', exists)).toBe(path.join(root, 'index.html'));
  });

  it('không cho thoát khỏi thư mục gốc', () => {
    expect(resolveStaticFile(root, '/%2e%2e/secret', exists)).toBeNull();
    expect(resolveStaticFile(root, '/%E0%A4%A', exists)).toBeNull();
  });

  it('isInside và kiểu nội dung', () => {
    expect(isInside('/a/b/c', '/a/b')).toBe(true);
    expect(isInside('/a/bc', '/a/b')).toBe(false);
    expect(contentTypeFor('x.JS')).toBe('text/javascript; charset=utf-8');
    expect(contentTypeFor('x.bin')).toBe('application/octet-stream');
  });
});
