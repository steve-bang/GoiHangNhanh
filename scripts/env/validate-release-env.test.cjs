/* Test chốt chặn môi trường lúc build (V1-01). Chạy trong project Jest `tooling`. */
const {
  validateReleaseEnv,
  readPlistBundleId,
  readAndroidPackages,
} = require('./validate-release-env.cjs');

const plist = (id) =>
  `<?xml version="1.0"?><plist version="1.0"><dict><key>PROJECT_ID</key><string>p</string>\n  <key>BUNDLE_ID</key>\n  <string>${id}</string></dict></plist>`;
const gsJson = (...ids) =>
  JSON.stringify({
    project_info: { project_id: 'p' },
    client: ids.map((id) => ({ client_info: { android_client_info: { package_name: id } } })),
  });
/** Tệp giả: đường dẫn -> nội dung; đường dẫn lạ ném lỗi như fs. */
const files = (contents, extra = {}) => ({
  iosBundleId: 'vn.doncung.app',
  androidPackage: 'vn.doncung.app',
  readFile: (path) => {
    if (!(path in contents)) throw new Error(`ENOENT ${path}`);
    return contents[path];
  },
  ...extra,
});
const GOOD = { 'a.plist': plist('vn.doncung.app'), 'g.json': gsJson('vn.doncung.app') };

const PROD = { APP_ENV: 'prod', EXPO_PUBLIC_APP_ENV: 'prod', EXPO_PUBLIC_BACKEND: 'firebase' };
const FAKE_FLAGS = {
  EXPO_PUBLIC_USE_FAKE_BACKEND: '1',
  EXPO_PUBLIC_BACKEND: 'fake',
  EXPO_PUBLIC_FAKE_SESSION: 'signed_in',
  EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: '10.0.2.2',
};

describe('validateReleaseEnv: dev', () => {
  it('không đặt APP_ENV (expo export, test) là dev', () => {
    expect(validateReleaseEnv({})).toBe('dev');
  });

  it('dev cho phép mọi cờ cổng giả/emulator', () => {
    expect(validateReleaseEnv({ APP_ENV: 'dev', EXPO_PUBLIC_APP_ENV: 'fake', ...FAKE_FLAGS })).toBe(
      'dev',
    );
  });

  it('APP_ENV lạ (gõ nhầm) bị từ chối, không lặng lẽ thành dev', () => {
    for (const v of ['prd', 'staging', 'Prod', 'development']) {
      expect(() => validateReleaseEnv({ APP_ENV: v })).toThrow(/APP_ENV/);
    }
  });

  it.each(['prod', 'production'])(
    'EXPO_PUBLIC_APP_ENV=%s mà APP_ENV là dev: lệch môi trường',
    (publicEnv) => {
      expect(() => validateReleaseEnv({ APP_ENV: 'dev', EXPO_PUBLIC_APP_ENV: publicEnv })).toThrow(
        /lệch môi trường/,
      );
      expect(() => validateReleaseEnv({ EXPO_PUBLIC_APP_ENV: publicEnv })).toThrow(
        /lệch môi trường/,
      );
    },
  );

  it('dev trên máy build EAS không đòi tệp Firebase', () => {
    expect(validateReleaseEnv({ APP_ENV: 'dev', EAS_BUILD: 'true' })).toBe('dev');
  });
});

describe('validateReleaseEnv: production', () => {
  it('cấu hình chuẩn của profile production', () => {
    expect(validateReleaseEnv(PROD)).toBe('prod');
    expect(validateReleaseEnv({ APP_ENV: 'prod', EXPO_PUBLIC_APP_ENV: 'prod' })).toBe('prod');
  });

  it('nhận bí danh production ở cả hai biến, bỏ khoảng trắng thừa', () => {
    expect(validateReleaseEnv({ APP_ENV: 'production', EXPO_PUBLIC_APP_ENV: 'production' })).toBe(
      'prod',
    );
    expect(validateReleaseEnv({ APP_ENV: ' prod ', EXPO_PUBLIC_APP_ENV: 'prod' })).toBe('prod');
  });

  it('thiếu hoặc sai EXPO_PUBLIC_APP_ENV: mất lớp chặn lúc chạy nên từ chối', () => {
    for (const v of [undefined, '', 'dev', 'fake']) {
      expect(() => validateReleaseEnv({ APP_ENV: 'prod', EXPO_PUBLIC_APP_ENV: v })).toThrow(
        /EXPO_PUBLIC_APP_ENV=prod/,
      );
    }
  });

  it.each(Object.entries(FAKE_FLAGS))('từ chối %s=%s', (name, flag) => {
    expect(() => validateReleaseEnv({ ...PROD, [name]: flag })).toThrow(name);
  });

  it.each(['0', 'true', 'yes'])(
    'EXPO_PUBLIC_USE_FAKE_BACKEND=%s cũng bị từ chối (chặt hơn lúc chạy)',
    (flag) => {
      expect(() => validateReleaseEnv({ ...PROD, EXPO_PUBLIC_USE_FAKE_BACKEND: flag })).toThrow(
        'EXPO_PUBLIC_USE_FAKE_BACKEND',
      );
    },
  );

  it('EXPO_PUBLIC_BACKEND chỉ nhận firebase', () => {
    for (const v of ['fake', 'unavailable', 'Firebase']) {
      expect(() => validateReleaseEnv({ ...PROD, EXPO_PUBLIC_BACKEND: v })).toThrow(
        'EXPO_PUBLIC_BACKEND',
      );
    }
  });

  it('chuỗi rỗng/khoảng trắng coi như không đặt', () => {
    expect(
      validateReleaseEnv({
        ...PROD,
        EXPO_PUBLIC_USE_FAKE_BACKEND: '',
        EXPO_PUBLIC_FAKE_SESSION: ' ',
        EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: '',
      }),
    ).toBe('prod');
  });

  it('gom mọi vi phạm vào một lỗi', () => {
    let message = '';
    try {
      validateReleaseEnv({ APP_ENV: 'production', ...FAKE_FLAGS });
    } catch (e) {
      message = e.message;
    }
    for (const name of ['EXPO_PUBLIC_APP_ENV', ...Object.keys(FAKE_FLAGS)]) {
      expect(message).toContain(name);
    }
  });

  it('ngoài máy build EAS không đòi tệp Firebase (kiểm cấu hình trên máy dev)', () => {
    expect(validateReleaseEnv(PROD, {})).toBe('prod');
  });

  it('trên máy build EAS: đòi tệp Firebase của nền tảng đang build', () => {
    const eas = { ...PROD, EAS_BUILD: 'true' };
    expect(() => validateReleaseEnv({ ...eas, EAS_BUILD_PLATFORM: 'ios' }, {})).toThrow(
      'GoogleService-Info.plist',
    );
    expect(
      validateReleaseEnv(
        { ...eas, EAS_BUILD_PLATFORM: 'ios' },
        files(GOOD, { iosFile: 'a.plist' }),
      ),
    ).toBe('prod');
    expect(() => validateReleaseEnv({ ...eas, EAS_BUILD_PLATFORM: 'android' }, {})).toThrow(
      'google-services.json',
    );
    expect(
      validateReleaseEnv(
        { ...eas, EAS_BUILD_PLATFORM: 'android' },
        files(GOOD, { androidFile: 'g.json' }),
      ),
    ).toBe('prod');
  });

  it('trên máy build EAS không rõ nền tảng: đòi cả hai tệp', () => {
    const eas = { ...PROD, EAS_BUILD: 'true' };
    expect(() => validateReleaseEnv(eas, files(GOOD, { iosFile: 'a.plist' }))).toThrow(
      'google-services.json',
    );
    expect(() => validateReleaseEnv(eas, files(GOOD, { androidFile: 'g.json' }))).toThrow(
      'GoogleService-Info.plist',
    );
    expect(
      validateReleaseEnv(eas, files(GOOD, { iosFile: 'a.plist', androidFile: 'g.json' })),
    ).toBe('prod');
  });
});

describe('validateReleaseEnv: tệp Firebase phải thuộc app production', () => {
  it('đọc BUNDLE_ID trong plist và package_name trong google-services.json', () => {
    expect(readPlistBundleId(plist('vn.doncung.app'))).toBe('vn.doncung.app');
    expect(readPlistBundleId('<plist><dict></dict></plist>')).toBeUndefined();
    expect(readAndroidPackages(gsJson('a.b', 'vn.doncung.app'))).toEqual(['a.b', 'vn.doncung.app']);
    expect(readAndroidPackages('không phải json')).toEqual([]);
    expect(readAndroidPackages('{}')).toEqual([]);
  });

  it('tệp của dự án dev (.dev) bị từ chối ở production, cả ngoài máy build EAS', () => {
    const dev = { 'a.plist': plist('vn.doncung.app.dev'), 'g.json': gsJson('vn.doncung.app.dev') };
    expect(() => validateReleaseEnv(PROD, files(dev, { iosFile: 'a.plist' }))).toThrow(
      /BUNDLE_ID "vn.doncung.app.dev"/,
    );
    expect(() => validateReleaseEnv(PROD, files(dev, { androidFile: 'g.json' }))).toThrow(
      /không có package_name "vn.doncung.app"/,
    );
  });

  it('google-services.json nhiều app: chỉ cần có app production', () => {
    const multi = { 'g.json': gsJson('vn.doncung.app.dev', 'vn.doncung.app') };
    expect(validateReleaseEnv(PROD, files(multi, { androidFile: 'g.json' }))).toBe('prod');
  });

  it('tệp không đọc được hoặc không có BUNDLE_ID: từ chối', () => {
    expect(() => validateReleaseEnv(PROD, files({}, { iosFile: 'missing.plist' }))).toThrow(
      /không đọc được/,
    );
    expect(() =>
      validateReleaseEnv(PROD, files({ 'a.plist': '<plist/>' }, { iosFile: 'a.plist' })),
    ).toThrow(/không đọc được/);
    expect(() =>
      validateReleaseEnv(PROD, files({ 'g.json': '{' }, { androidFile: 'g.json' })),
    ).toThrow(/không đọc được/);
  });

  it('dev không đối chiếu mã app trong tệp', () => {
    const dev = { 'a.plist': plist('khac'), 'g.json': gsJson('khac') };
    expect(
      validateReleaseEnv(
        { APP_ENV: 'dev' },
        files(dev, { iosFile: 'a.plist', androidFile: 'g.json' }),
      ),
    ).toBe('dev');
  });

  it('đọc tệp thật trên đĩa khi không truyền readFile', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v1-01-'));
    const p = path.join(dir, 'GoogleService-Info.plist');
    fs.writeFileSync(p, plist('vn.doncung.app.dev'));
    expect(() => validateReleaseEnv(PROD, { iosFile: p, iosBundleId: 'vn.doncung.app' })).toThrow(
      /không khớp mã app production/,
    );
    fs.writeFileSync(p, plist('vn.doncung.app'));
    expect(validateReleaseEnv(PROD, { iosFile: p, iosBundleId: 'vn.doncung.app' })).toBe('prod');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
