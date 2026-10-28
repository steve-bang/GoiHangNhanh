#!/usr/bin/env bash
# Khởi động máy ảo (iOS Simulator / Android Emulator) rồi chạy app trong Expo Go.
# Dùng: npm run dev:ios | npm run dev:android   (chỉ cho macOS)
# Biến tùy chọn: AVD_NAME=<tên AVD Android> (mặc định: AVD đầu tiên), IOS_DEVICE="iPhone 16"
set -euo pipefail

platform="${1:-}"
cd "$(dirname "$0")/.."

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Lệnh này chỉ hỗ trợ macOS." >&2
  exit 1
fi

# Dùng Expo Go, không dùng dev client (chưa có dev build); xem CLAUDE.md.
export LANG="${LANG:-en_US.UTF-8}"

start_ios() {
  if ! xcrun simctl help >/dev/null 2>&1; then
    echo "Chưa có Xcode / iOS Simulator. Cài Xcode từ App Store." >&2
    exit 1
  fi
  open -a Simulator
  if [[ -n "${IOS_DEVICE:-}" ]]; then
    xcrun simctl boot "$IOS_DEVICE" 2>/dev/null || true
  fi
  # Expo tự chọn máy ảo đang chạy và cài Expo Go khớp SDK nếu thiếu.
  exec npx expo start --go --ios
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
  exec npx expo start --go --android
}

case "$platform" in
  ios) start_ios ;;
  android) start_android ;;
  *) echo "Dùng: $0 ios|android" >&2; exit 1 ;;
esac
