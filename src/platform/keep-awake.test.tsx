import { act, render } from '@testing-library/react-native';

import { logger } from '@/core/logging/logger';

import { useKeepScreenAwake } from './keep-awake';

jest.unmock('@/platform/keep-awake');

const mockActivate = jest.fn<Promise<void>, [string]>();
const mockDeactivate = jest.fn<Promise<void>, [string]>();
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: (tag: string) => mockActivate(tag),
  deactivateKeepAwake: (tag: string) => mockDeactivate(tag),
}));

function Probe({ active }: { active: boolean }) {
  useKeepScreenAwake(active);
  return null;
}

let warn: jest.SpyInstance;
beforeEach(() => {
  mockActivate.mockReset().mockResolvedValue(undefined);
  mockDeactivate.mockReset().mockResolvedValue(undefined);
  warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
});
afterEach(() => warn.mockRestore());

describe('useKeepScreenAwake', () => {
  it('bật một lần khi active, không gọi lại khi vẽ lại cùng giá trị, tắt đúng tag khi gỡ màn', async () => {
    const view = await render(<Probe active />);
    expect(mockActivate).toHaveBeenCalledTimes(1);
    const tag = mockActivate.mock.calls[0]?.[0];
    expect(tag).toMatch(/^doncung-record-/);
    await view.rerender(<Probe active />);
    expect(mockActivate).toHaveBeenCalledTimes(1);
    expect(mockDeactivate).not.toHaveBeenCalled();
    await act(async () => view.unmount());
    expect(mockDeactivate).toHaveBeenCalledTimes(1);
    expect(mockDeactivate).toHaveBeenCalledWith(tag);
  });

  it('không active thì không bật; chuyển active -> không active thì tắt, rồi bật lại khi cần', async () => {
    const view = await render(<Probe active={false} />);
    expect(mockActivate).not.toHaveBeenCalled();
    await view.rerender(<Probe active />);
    expect(mockActivate).toHaveBeenCalledTimes(1);
    await view.rerender(<Probe active={false} />);
    expect(mockDeactivate).toHaveBeenCalledTimes(1);
    await view.rerender(<Probe active />);
    expect(mockActivate).toHaveBeenCalledTimes(2);
  });

  it('hai màn dùng hai tag khác nhau (tắt màn này không nhả màn kia)', async () => {
    await render(
      <>
        <Probe active />
        <Probe active />
      </>,
    );
    const tags = mockActivate.mock.calls.map((call) => call[0]);
    expect(new Set(tags).size).toBe(2);
  });

  it('thư viện lỗi (bất đồng bộ hoặc đồng bộ): không ném, chỉ log bước, không PII', async () => {
    mockActivate.mockRejectedValue(new Error('no activity'));
    mockDeactivate.mockImplementation(() => {
      throw new Error('boom');
    });
    const view = await render(<Probe active />);
    await act(async () => undefined);
    await act(async () => view.unmount());
    expect(warn).toHaveBeenCalledWith('platform.keep_awake_failed', { step: 'on' });
    expect(warn).toHaveBeenCalledWith('platform.keep_awake_failed', { step: 'off' });
  });
});
