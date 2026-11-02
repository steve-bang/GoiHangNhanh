'use strict';
/**
 * Config plugin: chèn `FirebaseApp.configure()` vào AppDelegate.swift lúc prebuild.
 *
 * Vì sao cần: plugin `@react-native-firebase/app` tìm điểm chèn là `factory.startReactNative(` hoặc
 * `self.moduleName = ...`. Template Expo mới (SceneDelegate, iOS 27 SDK) chuyển `startReactNative`
 * sang `SceneDelegate`, AppDelegate không còn mốc nào khớp nên plugin chỉ cảnh báo rồi bỏ qua, để lại
 * `import FirebaseCore` mà không có lệnh configure. Kết quả: JS gọi `getApp()` báo
 * "No Firebase App '[DEFAULT]'" và app rơi về bản "chưa kết nối" (AUTH_SERVICE_UNAVAILABLE).
 *
 * Chèn ở đầu `didFinishLaunchingWithOptions`, trước mọi mã React Native. Idempotent: có
 * `FirebaseApp.configure()` rồi (do plugin RNFirebase hoặc lần chạy trước) thì giữ nguyên.
 *
 * Cùng plugin còn copy `GoogleService-Info.plist` ra thư mục gốc `ios/`: script build
 * "[RNFB] Crashlytics Configuration" đọc `${PROJECT_DIR}/GoogleService-Info.plist`, trong khi Expo
 * chỉ đặt tệp vào `ios/<tên app>/`. Thiếu tệp này thì build dừng với "Unable to read Google Service plist".
 */
const fs = require('node:fs');
const nodePath = require('node:path');
const { IOSConfig, withDangerousMod } = require('@expo/config-plugins');

const MARKER = '// @doncung/firebase-configure';
const IMPORT_LINE = 'import FirebaseCore';
const CONFIGURE_CALL = 'FirebaseApp.configure()';
// Đầu thân hàm: `didFinishLaunchingWithOptions ... -> Bool {` (chữ ký có thể xuống dòng).
const DID_FINISH_LAUNCHING = /didFinishLaunchingWithOptions[^{]*\{[ \t]*\r?\n/;

/** @param {string} contents nội dung AppDelegate.swift @returns {string} */
function addFirebaseConfigure(contents) {
  if (contents.includes(CONFIGURE_CALL)) return contents;

  const match = DID_FINISH_LAUNCHING.exec(contents);
  if (!match) {
    throw new Error(
      'with-firebase-configure: không tìm thấy didFinishLaunchingWithOptions trong AppDelegate.swift; ' +
        'cập nhật scripts/with-firebase-configure.cjs theo template mới.',
    );
  }

  const newline = match[0].endsWith('\r\n') ? '\r\n' : '\n';
  const block = [
    `    ${MARKER}`,
    `    if FirebaseApp.app() == nil {`,
    `      ${CONFIGURE_CALL}`,
    `    }`,
    '',
    '',
  ].join(newline);
  const at = match.index + match[0].length;
  let result = contents.slice(0, at) + block + contents.slice(at);

  if (!/^[ \t]*import\s+FirebaseCore[ \t]*$/m.test(result)) {
    result = `${IMPORT_LINE}${newline}${result}`;
  }
  return result;
}

const withFirebaseConfigure = (config) =>
  withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const { path, contents, language } = IOSConfig.Paths.getAppDelegate(
        modConfig.modRequest.projectRoot,
      );
      if (language !== 'swift') {
        throw new Error(
          `with-firebase-configure: chỉ hỗ trợ AppDelegate Swift, gặp "${language}".`,
        );
      }
      await fs.promises.writeFile(path, addFirebaseConfigure(contents));

      const plist = modConfig.ios?.googleServicesFile;
      if (plist) {
        const { projectRoot, platformProjectRoot } = modConfig.modRequest;
        await fs.promises.copyFile(
          nodePath.resolve(projectRoot, plist),
          nodePath.join(platformProjectRoot, 'GoogleService-Info.plist'),
        );
      }
      return modConfig;
    },
  ]);

module.exports = withFirebaseConfigure;
module.exports.addFirebaseConfigure = addFirebaseConfigure;
