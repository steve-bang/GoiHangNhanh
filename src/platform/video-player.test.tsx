import { render } from '@testing-library/react-native';

import { VideoPlayer } from './video-player';

jest.unmock('@/platform/video-player');

const mockSources: unknown[] = [];
const mockViewProps = jest.fn();
let mockStatusListener: ((payload: { status: string }) => void) | undefined;

jest.mock('expo-video', () => ({
  useVideoPlayer: (source: unknown) => {
    mockSources.push(source);
    return { id: 'player' };
  },
  VideoView: (props: Record<string, unknown>) => {
    mockViewProps(props);
    return null;
  },
}));
jest.mock('expo', () => ({
  useEventListener: (
    _player: unknown,
    event: string,
    listener: (p: { status: string }) => void,
  ) => {
    if (event === 'statusChange') mockStatusListener = listener;
  },
}));

beforeEach(() => {
  mockSources.length = 0;
  mockViewProps.mockClear();
  mockStatusListener = undefined;
});

describe('VideoPlayer (adapter expo-video)', () => {
  it('mở đúng tệp trên máy, không cache, có thanh điều khiển, không hình-trong-hình', async () => {
    await render(<VideoPlayer uri="file:///docs/evidence/ev-1.mp4" testID="p" />);
    expect(mockSources.at(-1)).toEqual({
      uri: 'file:///docs/evidence/ev-1.mp4',
      useCaching: false,
    });
    const props = mockViewProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(props.nativeControls).toBe(true);
    expect(props.allowsPictureInPicture).toBe(false);
    expect(props.startsPictureInPictureAutomatically).toBe(false);
    expect(props.contentFit).toBe('contain');
  });

  it('nhận URL https của máy chủ và vẫn không cache (dữ liệu nhạy cảm)', async () => {
    await render(<VideoPlayer uri="https://storage.example/ev-1?sig=x" />);
    expect(mockSources.at(-1)).toEqual({
      uri: 'https://storage.example/ev-1?sig=x',
      useCaching: false,
    });
  });

  it('báo lỗi khi trình phát không mở được tệp; trạng thái khác thì không', async () => {
    const onError = jest.fn();
    await render(<VideoPlayer uri="file:///x.mp4" onError={onError} />);
    mockStatusListener?.({ status: 'loading' });
    mockStatusListener?.({ status: 'readyToPlay' });
    expect(onError).not.toHaveBeenCalled();
    mockStatusListener?.({ status: 'error' });
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
