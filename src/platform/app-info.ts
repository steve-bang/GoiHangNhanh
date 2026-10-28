import Constants from 'expo-constants';

/**
 * Phiên bản ứng dụng lấy từ cấu hình Expo (`app.json`). `null` khi không đọc được: chỗ hiển thị phải
 * bỏ dòng phiên bản, không tự bịa số.
 */
export function getAppVersion(): string | null {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version.length > 0 ? version : null;
}
