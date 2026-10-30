// Mở rộng app.json: gắn tệp cấu hình Firebase của app nếu có. Hai tệp KHÔNG commit (docs/engineering
// ADR-009): đặt cục bộ ở gốc repo (chỉ dev) hoặc nạp qua EAS file secret, trỏ bằng biến môi trường
// GOOGLE_SERVICES_INFO_PLIST (hoặc tên DEPLOYMENT.md: GOOGLE_SERVICE_INFO_PLIST) / GOOGLE_SERVICES_JSON. Không có tệp thì không gắn (expo export, test và
// bản giả vẫn chạy); bản build thật thiếu tệp sẽ rơi về "chưa kết nối" (src/api/create-api.ts).
const fs = require('node:fs');

const { resolveAppEnv, validateReleaseEnv } = require('./scripts/env/validate-release-env.cjs');

function existing(path) {
  return path && fs.existsSync(path) ? path : undefined;
}

// APP_ENV=dev|prod (bí danh production; đặt bởi `npm run dev:*` / `prod:*`, scripts/env/*.env, hoặc
// profile trong eas.json) chọn tệp trong firebase/config/<env>/ trước, rồi mới tới gốc repo (gốc repo chỉ cho dev). prod bỏ hậu
// tố `.dev` của mã app (giá trị giữ chỗ, O-11). Bản production mang cờ cổng giả/emulator thì
// `validateReleaseEnv` ném lỗi và build dừng (V1-01).
module.exports = ({ config }) => {
  const env = resolveAppEnv(process.env);
  // Bản production KHÔNG lấy tệp ở gốc repo (nơi đặt tệp dev): chỉ biến môi trường (EAS file secret)
  // hoặc firebase/config/prod/ (`npm run prod:*`); `validateReleaseEnv` còn đối chiếu mã app trong tệp.
  const rootFallback = (name) => (env === 'prod' ? undefined : `./${name}`);
  const iosFile = existing(
    process.env.GOOGLE_SERVICES_INFO_PLIST ??
      process.env.GOOGLE_SERVICE_INFO_PLIST ??
      existing(`./firebase/config/${env}/GoogleService-Info.plist`) ??
      rootFallback('GoogleService-Info.plist'),
  );
  const androidFile = existing(
    process.env.GOOGLE_SERVICES_JSON ??
      existing(`./firebase/config/${env}/google-services.json`) ??
      rootFallback('google-services.json'),
  );
  const appId = (id) => (env === 'prod' && id ? id.replace(/\.dev$/, '') : id);
  validateReleaseEnv(process.env, {
    iosFile,
    androidFile,
    iosBundleId: appId(config.ios?.bundleIdentifier),
    androidPackage: appId(config.android?.package),
  });
  return {
    ...config,
    ios: {
      ...config.ios,
      bundleIdentifier: appId(config.ios?.bundleIdentifier),
      ...(iosFile ? { googleServicesFile: iosFile } : {}),
    },
    android: {
      ...config.android,
      package: appId(config.android?.package),
      ...(androidFile ? { googleServicesFile: androidFile } : {}),
    },
  };
};
