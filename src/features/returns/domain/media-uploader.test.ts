import { returnMediaUploader } from './media-uploader';

describe('returnMediaUploader (V1-07)', () => {
  const published = { createdBy: 'a', anchorPublishedAtDevice: 5 };
  const pendingOfA = { createdBy: 'a' };
  const pendingUnknown = {};

  it.each([
    // [media.createdBy, hồ sơ, uid, kết quả]
    ['b', pendingOfA, 'b', 'case_owner'],
    ['b', published, 'b', 'current'],
    ['a', pendingOfA, 'a', 'current'],
    ['b', pendingUnknown, 'b', 'unknown'],
    ['a', pendingOfA, 'b', 'other'],
    [undefined, published, 'b', 'unknown'],
    ['b', pendingOfA, null, 'current'],
  ] as const)('media %s, hồ sơ %j, đăng nhập %s -> %s', (createdBy, returnCase, uid, expected) => {
    expect(returnMediaUploader(createdBy ? { createdBy } : {}, returnCase, uid)).toBe(expected);
  });
});
