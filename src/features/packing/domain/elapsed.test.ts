import { formatElapsed } from './elapsed';

describe('formatElapsed', () => {
  it.each([
    [0, '00:00'],
    [999, '00:00'],
    [28_000, '00:28'],
    [61_000, '01:01'],
    [3_599_000, '59:59'],
    [3_600_000, '1:00:00'],
    [3_725_000, '1:02:05'],
  ])('%d ms -> %s', (ms, text) => expect(formatElapsed(1000, 1000 + ms)).toBe(text));
  it('mốc ở tương lai thì 00:00', () => expect(formatElapsed(5000, 1000)).toBe('00:00'));
});
