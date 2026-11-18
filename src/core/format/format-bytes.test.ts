import { formatBytes } from './format-bytes';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [-5, '0 B'],
    [Number.NaN, '0 B'],
    [Number.POSITIVE_INFINITY, '0 B'],
    [1, '1 B'],
    [1023, '1023 B'],
    [1024, '1 KB'],
    [1536, '1,5 KB'],
    [10 * 1024, '10 KB'],
    [1024 * 1024, '1 MB'],
    [5.5 * 1024 * 1024, '5,5 MB'],
    [1024 ** 3, '1 GB'],
    [1.25 * 1024 ** 3, '1,3 GB'],
    [4.5 * 1024 ** 3, '4,5 GB'],
    [2 * 1024 ** 4, '2 TB'],
    [5000 * 1024 ** 4, '5000 TB'],
  ])('%p -> %s', (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });
});
