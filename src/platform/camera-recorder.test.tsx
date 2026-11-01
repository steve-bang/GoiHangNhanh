import { createRef, type MutableRefObject } from 'react';
import { render } from '@testing-library/react-native';

import { CameraRecorder, type CameraRecorderHandle } from './camera-recorder';

const mockCameraProps = jest.fn();
const mockRecordAsync = jest.fn();
const mockStopRecording = jest.fn();
jest.mock('expo-camera', () => {
  const React = jest.requireActual('react');
  return {
    CameraView: React.forwardRef(function MockCameraView(
      props: Record<string, unknown>,
      ref: unknown,
    ) {
      mockCameraProps(props);
      React.useImperativeHandle(ref, () => ({
        recordAsync: mockRecordAsync,
        stopRecording: mockStopRecording,
      }));
      return null;
    }),
  };
});

const PROFILE = {
  quality: '1080p',
  bitrateBps: 6_000_000,
  codec: 'avc1',
  maxFileBytes: 1_900_000_000,
} as const;

const mount = async (profile?: typeof PROFILE) => {
  const handleRef =
    createRef<CameraRecorderHandle | null>() as MutableRefObject<CameraRecorderHandle | null>;
  await render(<CameraRecorder handleRef={handleRef} {...(profile ? { profile } : {})} />);
  return () => {
    const handle = handleRef.current;
    if (!handle) throw new Error('recorder handle missing');
    return handle;
  };
};

describe('CameraRecorder: thông số quay (V1-22)', () => {
  beforeEach(() => {
    mockCameraProps.mockClear();
    mockRecordAsync.mockReset();
    mockRecordAsync.mockResolvedValue({ uri: 'file:///cache/Camera/a.mp4' });
  });

  it('CameraView nhận videoQuality và videoBitrate từ profile; vẫn mode video, không thu tiếng', async () => {
    await mount(PROFILE);
    const props = mockCameraProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(props).toMatchObject({
      mode: 'video',
      mute: true,
      facing: 'back',
      videoQuality: '1080p',
      videoBitrate: 6_000_000,
    });
  });

  it('recordAsync nhận maxFileSize (lưới chống 2 GB), codec avc1 và maxDuration', async () => {
    const handle = await mount(PROFILE);
    const recording = handle().record({ maxDurationSec: 600 });
    expect(mockRecordAsync).toHaveBeenCalledWith({
      maxDuration: 600,
      maxFileSize: 1_900_000_000,
      codec: 'avc1',
    });
    expect(await recording.done).toEqual({ ok: true, tempUri: 'file:///cache/Camera/a.mp4' });
  });

  it('không có profile: giữ hành vi cũ (không videoQuality/videoBitrate, recordAsync không tùy chọn)', async () => {
    const handle = await mount();
    const props = mockCameraProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(props).not.toHaveProperty('videoQuality');
    expect(props).not.toHaveProperty('videoBitrate');
    handle().record();
    expect(mockRecordAsync).toHaveBeenCalledWith(undefined);
  });

  it('recordAsync bị từ chối hoặc không có uri: RECORDER_FAILED (không ném)', async () => {
    const handle = await mount(PROFILE);
    mockRecordAsync.mockRejectedValueOnce(new Error('ERROR_INSUFFICIENT_STORAGE'));
    expect(await handle().record().done).toEqual({
      ok: false,
      reason: 'RECORDER_FAILED',
    });
    mockRecordAsync.mockResolvedValueOnce(undefined);
    expect(await handle().record().done).toEqual({
      ok: false,
      reason: 'RECORDER_FAILED',
    });
  });
});
