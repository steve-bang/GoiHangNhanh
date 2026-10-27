import { render } from '@testing-library/react-native';

import { CameraPreview } from './camera-preview';

const mockCameraProps = jest.fn();
jest.mock('expo-camera', () => ({
  CameraView: (props: Record<string, unknown>) => {
    mockCameraProps(props);
    return null;
  },
}));

describe('CameraPreview (adapter xem trước)', () => {
  it('xem trước ở chế độ ảnh, không micro: không kéo yêu cầu micro trên iOS; giữ camera sau và đèn pin', async () => {
    await render(<CameraPreview torch />);
    const props = mockCameraProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(props.mode).toBe('picture');
    expect(props.mute).toBe(true);
    expect(props.facing).toBe('back');
    expect(props.enableTorch).toBe(true);
  });

  it('báo lỗi mở camera qua onError', async () => {
    const onError = jest.fn();
    await render(<CameraPreview onError={onError} />);
    const props = mockCameraProps.mock.calls.at(-1)?.[0] as { onMountError: () => void };
    props.onMountError();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
