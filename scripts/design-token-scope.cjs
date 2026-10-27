'use strict';
/**
 * NGUỒN DUY NHẤT về phạm vi áp dụng Design Token (docs/design-token-spec.md mục 7, audit mục 1).
 * ESLint (eslint.config.js) và script `check-design-tokens.cjs` cùng đọc tệp này.
 *
 * Ngoài phạm vi = các màn đã chạy và được khách hàng xác nhận: KHÔNG sửa, KHÔNG đổi hiển thị.
 * Muốn đưa một màn vào phạm vi: xóa dòng tương ứng ở đây, chuyển màn sang `useTheme().tokens`.
 */

/** Đường dẫn (tính từ gốc repo, dấu `/`) ngoài phạm vi. */
const EXCLUDED_PATTERNS = [
  // Splash
  /^src\/features\/shop\/ui\/SplashScreen/,
  /^src\/features\/shop\/ui\/splash\//,
  // Đăng nhập, Đăng ký, Quên mật khẩu, OTP, Mật khẩu mới
  /^src\/features\/shop\/ui\/(SignIn|SignUp|ForgotPassword|VerifyOtp|NewPassword)Screen/,
  /^src\/features\/shop\/ui\/auth-layout/,
  // Luồng thiết lập trước khi vào app (D-17: xác nhận ngoài phạm vi) và hạ tầng dùng chung của chúng
  /^src\/features\/shop\/ui\/(Welcome|CreateShop|SetupDone)/,
  /^src\/features\/shop\/ui\/(BrandLogo|onboarding|welcome-layout)/,
  /^src\/features\/shop\/ui\/onboarding\//,
  // Chỗ chứa giá trị gốc của chính hệ thống token và hạ tầng test
  /^src\/core\/theme\//,
  /^src\/shared\/ui\/theme\.ts$/,
  /^src\/test-utils\//,
];

/** Tệp không phải giao diện (không kiểm tra token). */
const NON_UI_PATTERNS = [/\.test\.tsx?$/, /\.d\.ts$/, /recovery-test-harness/];

/**
 * Component dùng chung với màn ngoài phạm vi: chỉ được thay literal bằng token CÙNG GIÁ TRỊ
 * (có test tương đương style). Vẫn nằm trong phạm vi kiểm tra.
 */
const SHARED_WITH_FROZEN = [
  'src/shared/ui/Button.tsx',
  'src/shared/ui/Text.tsx',
  'src/shared/ui/Icon.tsx',
  'src/shared/ui/SourceIcon.tsx',
];

/** @param {string} relPath đường dẫn tương đối từ gốc repo, dấu `/` */
function isInScope(relPath) {
  const p = relPath.split('\\').join('/');
  if (!/^src\/.*\.tsx?$/.test(p)) return false;
  if (NON_UI_PATTERNS.some((r) => r.test(p))) return false;
  return !EXCLUDED_PATTERNS.some((r) => r.test(p));
}

module.exports = { EXCLUDED_PATTERNS, NON_UI_PATTERNS, SHARED_WITH_FROZEN, isInScope };
