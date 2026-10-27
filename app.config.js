// Mở rộng app.json: gắn tệp cấu hình Firebase của app nếu có. Hai tệp KHÔNG commit (docs/engineering
// ADR-009): đặt cục bộ ở gốc repo hoặc nạp qua EAS file secret, trỏ bằng biến môi trường
// GOOGLE_SERVICES_INFO_PLIST / GOOGLE_SERVICES_JSON. Không có tệp thì không gắn (expo export, test và
// bản giả vẫn chạy); bản build thật thiếu tệp sẽ rơi về "chưa kết nối" (src/api/create-api.ts).
const fs = require('node:fs');

function existing(path) {
  return path && fs.existsSync(path) ? path : undefined;
}

module.exports = ({ config }) => {
  const iosFile = existing(process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist');
  const androidFile = existing(process.env.GOOGLE_SERVICES_JSON ?? './google-services.json');
  return {
    ...config,
    ios: { ...config.ios, ...(iosFile ? { googleServicesFile: iosFile } : {}) },
    android: { ...config.android, ...(androidFile ? { googleServicesFile: androidFile } : {}) },
  };
};
