import type { RemoteDocuments } from './contract';
import { createRemoteDocuments } from './create-remote-documents';

const docs = { tag: 'docs' } as unknown as RemoteDocuments;
const build = jest.fn(() => docs);

beforeEach(() => build.mockClear());

describe('createRemoteDocuments', () => {
  it('cổng giả, test và dev: null, không nạp Firebase', () => {
    for (const env of [
      { isDev: true, isTest: false, fakeFlag: undefined },
      { isDev: false, isTest: true, fakeFlag: undefined },
      { isDev: false, isTest: false, fakeFlag: '1' },
      { isDev: false, isTest: false, fakeFlag: undefined, backend: 'fake' },
    ]) {
      expect(createRemoteDocuments(env, build)).toBeNull();
    }
    expect(build).not.toHaveBeenCalled();
  });

  it('Firebase thật (bản build thường, hoặc ép firebase/emulator): dùng cổng Firebase', () => {
    expect(createRemoteDocuments({ isDev: false, isTest: false, fakeFlag: undefined }, build)).toBe(
      docs,
    );
    expect(
      createRemoteDocuments(
        { isDev: true, isTest: false, fakeFlag: undefined, backend: 'firebase' },
        build,
      ),
    ).toBe(docs);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('bản production (EXPO_PUBLIC_APP_ENV=prod): bỏ qua cờ giả, vẫn dùng cổng Firebase (V1-01)', () => {
    expect(
      createRemoteDocuments(
        { isDev: true, isTest: false, fakeFlag: '1', backend: 'fake', appEnv: 'prod' },
        build,
      ),
    ).toBe(docs);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('thiếu cấu hình Firebase: null (không giả vờ đã đồng bộ)', () => {
    expect(
      createRemoteDocuments({ isDev: false, isTest: false, fakeFlag: undefined }, () => null),
    ).toBeNull();
  });
});
