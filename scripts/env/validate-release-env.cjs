// Chốt chặn môi trường lúc build (V1-01, lớp một). `app.config.js` gọi hàm này mỗi lần Expo/EAS đọc
// cấu hình; ném lỗi thì `expo config`, `expo prebuild`, `eas build` đều dừng. Lớp hai (lúc chạy) ở
// `src/api/create-api.ts` (`isProductionAppEnv`): hai nơi phải giữ cùng tập bí danh production.

const PROD_ALIASES = ['prod', 'production'];
const DEV_VALUES = ['', 'dev'];

function value(env, name) {
  const v = env[name];
  return typeof v === 'string' ? v.trim() : '';
}

function isProd(v) {
  return PROD_ALIASES.includes(v);
}

/** `prod` khi `APP_ENV` là `prod`/`production`, còn lại `dev` (không ném lỗi; dùng để chọn tệp cấu hình). */
function resolveAppEnv(env) {
  return isProd(value(env, 'APP_ENV')) ? 'prod' : 'dev';
}

/**
 * Kiểm biến môi trường của một lần build/đọc cấu hình.
 * @param {Record<string, string | undefined>} env thường là `process.env`
 * @param {{ iosFile?: string, androidFile?: string }} files tệp cấu hình Firebase đã tìm thấy (nếu có)
 * @returns {'dev' | 'prod'} môi trường đã chuẩn hóa
 * @throws {Error} liệt kê mọi vi phạm khi bản production mang cờ cổng giả/emulator hoặc cấu hình lệch
 */
function validateReleaseEnv(env, files = {}) {
  const appEnv = value(env, 'APP_ENV');
  const publicAppEnv = value(env, 'EXPO_PUBLIC_APP_ENV');
  const errors = [];

  if (!isProd(appEnv) && !DEV_VALUES.includes(appEnv)) {
    errors.push(`APP_ENV="${appEnv}" không hợp lệ (dùng dev, prod hoặc production).`);
  }
  const target = resolveAppEnv(env);

  if (target !== 'prod' && isProd(publicAppEnv)) {
    errors.push(
      `EXPO_PUBLIC_APP_ENV="${publicAppEnv}" nhưng APP_ENV không phải production: gói JS và mã app/Firebase lệch môi trường.`,
    );
  }

  if (target === 'prod') {
    if (!isProd(publicAppEnv)) {
      errors.push(
        'Bản production phải đặt EXPO_PUBLIC_APP_ENV=prod để app chặn cổng giả cả lúc chạy.',
      );
    }
    if (value(env, 'EXPO_PUBLIC_USE_FAKE_BACKEND')) {
      errors.push('Bản production không được đặt EXPO_PUBLIC_USE_FAKE_BACKEND.');
    }
    const backend = value(env, 'EXPO_PUBLIC_BACKEND');
    if (backend && backend !== 'firebase') {
      errors.push(`Bản production chỉ dùng EXPO_PUBLIC_BACKEND=firebase (đang là "${backend}").`);
    }
    if (value(env, 'EXPO_PUBLIC_FAKE_SESSION')) {
      errors.push('Bản production không được đặt EXPO_PUBLIC_FAKE_SESSION.');
    }
    if (value(env, 'EXPO_PUBLIC_FIREBASE_EMULATOR_HOST')) {
      errors.push(
        'Bản production không được nối Firebase Emulator (EXPO_PUBLIC_FIREBASE_EMULATOR_HOST).',
      );
    }
    // Chỉ đòi tệp cấu hình trên máy build EAS: máy dev vẫn chạy được `expo config` để kiểm cấu hình.
    if (value(env, 'EAS_BUILD') === 'true') {
      const platform = value(env, 'EAS_BUILD_PLATFORM');
      if (platform !== 'android' && !files.iosFile) {
        errors.push(
          'Thiếu GoogleService-Info.plist của dự án production (EAS file secret GOOGLE_SERVICE_INFO_PLIST).',
        );
      }
      if (platform !== 'ios' && !files.androidFile) {
        errors.push(
          'Thiếu google-services.json của dự án production (EAS file secret GOOGLE_SERVICES_JSON).',
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Cấu hình môi trường không an toàn để build:\n- ${errors.join('\n- ')}`);
  }
  return target;
}

module.exports = { resolveAppEnv, validateReleaseEnv, PROD_ALIASES };
