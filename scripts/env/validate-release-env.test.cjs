/* Test chốt chặn môi trường lúc build (V1-01). Chạy trong project Jest `tooling`. */
const { validateReleaseEnv } = require('./validate-release-env.cjs');

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
    expect(validateReleaseEnv({ ...eas, EAS_BUILD_PLATFORM: 'ios' }, { iosFile: 'a.plist' })).toBe(
      'prod',
    );
    expect(() => validateReleaseEnv({ ...eas, EAS_BUILD_PLATFORM: 'android' }, {})).toThrow(
      'google-services.json',
    );
    expect(
      validateReleaseEnv({ ...eas, EAS_BUILD_PLATFORM: 'android' }, { androidFile: 'g.json' }),
    ).toBe('prod');
  });

  it('trên máy build EAS không rõ nền tảng: đòi cả hai tệp', () => {
    const eas = { ...PROD, EAS_BUILD: 'true' };
    expect(() => validateReleaseEnv(eas, { iosFile: 'a.plist' })).toThrow('google-services.json');
    expect(() => validateReleaseEnv(eas, { androidFile: 'g.json' })).toThrow(
      'GoogleService-Info.plist',
    );
    expect(validateReleaseEnv(eas, { iosFile: 'a.plist', androidFile: 'g.json' })).toBe('prod');
  });
});
