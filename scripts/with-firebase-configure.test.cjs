'use strict';
const { addFirebaseConfigure } = require('./with-firebase-configure.cjs');

const TEMPLATE = `internal import Expo
import React

@main
class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

describe('with-firebase-configure', () => {
  it('chèn configure và import vào đầu didFinishLaunchingWithOptions', () => {
    const out = addFirebaseConfigure(TEMPLATE);
    expect(out).toContain('import FirebaseCore');
    expect(out.indexOf('FirebaseApp.configure()')).toBeGreaterThan(
      out.indexOf('didFinishLaunchingWithOptions launchOptions'),
    );
    expect(out.indexOf('FirebaseApp.configure()')).toBeLessThan(
      out.indexOf('let delegate = ReactNativeDelegate()'),
    );
  });

  it('idempotent: chạy lại không chèn thêm', () => {
    const once = addFirebaseConfigure(TEMPLATE);
    expect(addFirebaseConfigure(once)).toBe(once);
    expect(once.match(/FirebaseApp\.configure\(\)/g)).toHaveLength(1);
  });

  it('giữ nguyên khi plugin RNFirebase đã chèn configure', () => {
    const already = TEMPLATE.replace('let delegate', 'FirebaseApp.configure()\n    let delegate');
    expect(addFirebaseConfigure(already)).toBe(already);
  });

  it('không thêm import trùng khi đã có', () => {
    const withImport = `import FirebaseCore\n${TEMPLATE}`;
    expect(addFirebaseConfigure(withImport).match(/import FirebaseCore/g)).toHaveLength(1);
  });

  it('ném lỗi rõ ràng khi template không có didFinishLaunchingWithOptions', () => {
    expect(() => addFirebaseConfigure('class A {}')).toThrow(/didFinishLaunchingWithOptions/);
  });
});
