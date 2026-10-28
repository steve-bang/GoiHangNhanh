#!/usr/bin/env bash
# Khởi động máy ảo (iOS Simulator / Android Emulator) rồi chạy app theo môi trường.
# Dùng: npm run dev:ios | dev:android | prod:ios | prod:android | fake:ios | fake:android   (chỉ macOS)
#   dev  = Firebase thật của dự án dev   (scripts/env/dev.env)   - dev client
#   prod = Firebase thật của dự án prod  (scripts/env/prod.env)  - dev client
#   fake = cổng giả, không Firebase      (scripts/env/fake.env)  - Expo Go
# Biến tùy chọn: AVD_NAME=<tên AVD Android> (mặc định: AVD đầu tiên), IOS_DEVICE="iPhone 16"
set -euo pipefail

platform="${1:-}"
target="${2:-dev}"
cd "$(dirname "$0")/.."

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Lệnh này chỉ hỗ trợ macOS." >&2
  exit 1
fi
if [[ "$platform" != "ios" && "$platform" != "android" ]] || [[ ! -f "scripts/env/$target.env" ]]; then
  echo "Dùng: $0 ios|android dev|prod|fake" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "scripts/env/$target.env"
set +a
export LANG="${LANG:-en_US.UTF-8}"

# Firebase thật cần tệp cấu hình đúng môi trường (firebase/config/README.md) và dev client.
if [[ "$target" != "fake" ]]; then
  if [[ "$platform" == "ios" ]]; then cfg="GoogleService-Info.plist"; else cfg="google-services.json"; fi
  file="firebase/config/$APP_ENV/$cfg"
  if [[ ! -f "$file" ]]; then
    echo "Thiếu $file (tải từ Firebase Console, xem firebase/config/README.md)." >&2
    exit 1
  fi
  if [[ -n "${FIREBASE_PROJECT_ID:-}" ]] && ! grep -q "$FIREBASE_PROJECT_ID" "$file"; then
    echo "$file không thuộc dự án $FIREBASE_PROJECT_ID." >&2
    exit 1
  fi
fi

# Mã app theo môi trường (khớp app.config.js) để kiểm tra đã cài dev client chưa.
app_id="vn.doncung.app.dev"
[[ "$APP_ENV" == "prod" ]] && app_id="vn.doncung.app"

# fake: Expo Go; còn lại: dev client (chưa cài thì build và cài bằng `expo run:*`).
launch() {
  local installed="$1"
  if [[ "$target" == "fake" ]]; then
    exec npx expo start --go "--$platform"
  elif [[ "$installed" == "yes" ]]; then
    exec npx expo start --dev-client "--$platform"
  else
    echo "Chưa cài $app_id trên máy ảo, đang build (lần đầu mất vài phút)..."
    exec npx expo run:"$platform"
  fi
}

start_ios() {
  if ! xcrun simctl help >/dev/null 2>&1; then
    echo "Chưa có Xcode / iOS Simulator. Cài Xcode từ App Store." >&2
    exit 1
  fi
  open -a Simulator
  if [[ -n "${IOS_DEVICE:-}" ]]; then
    xcrun simctl boot "$IOS_DEVICE" 2>/dev/null || true
  fi
  xcrun simctl bootstatus booted -b >/dev/null 2>&1 || true
  if xcrun simctl get_app_container booted "$app_id" >/dev/null 2>&1; then launch yes; else launch no; fi
}

start_android() {
  local sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  local emulator="$sdk/emulator/emulator" adb="$sdk/platform-tools/adb"
  if [[ ! -x "$emulator" || ! -x "$adb" ]]; then
    echo "Không thấy Android SDK tại $sdk. Cài Android Studio hoặc đặt ANDROID_HOME." >&2
    exit 1
  fi
  if ! "$adb" devices | grep -qE '^emulator-[0-9]+[[:space:]]+device'; then
    local avd="${AVD_NAME:-$("$emulator" -list-avds | head -n 1)}"
    if [[ -z "$avd" ]]; then
      echo "Chưa có AVD. Tạo một máy ảo trong Android Studio (Device Manager)." >&2
      exit 1
    fi
    echo "Đang mở Android Emulator: $avd"
    nohup "$emulator" -avd "$avd" >/dev/null 2>&1 &
    "$adb" wait-for-device
    until [[ "$("$adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
      sleep 2
    done
  fi
  export ANDROID_HOME="$sdk"
  export PATH="$sdk/platform-tools:$PATH"
  if "$adb" shell pm list packages 2>/dev/null | grep -q "package:$app_id"; then launch yes; else launch no; fi
}

"start_$platform"
