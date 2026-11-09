import { pickDefaultSyncFilter } from './sync-default-filter';

const c = (error: number, uploading: number, waiting_upload: number) => ({
  error,
  uploading,
  waiting_upload,
});

describe('pickDefaultSyncFilter', () => {
  it.each([
    [c(1, 0, 0), 'error'],
    [c(1, 2, 3), 'error'],
    [c(0, 2, 3), 'uploading'],
    [c(0, 1, 0), 'uploading'],
    [c(0, 0, 3), 'waiting_upload'],
    [c(0, 0, 0), 'uploaded'],
  ] as const)('%j -> %s', (counts, expected) => {
    expect(pickDefaultSyncFilter(counts)).toBe(expected);
  });
});
