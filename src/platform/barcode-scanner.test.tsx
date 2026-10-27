import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useScannerPermission } from './barcode-scanner';

type Listener = (state: string) => void;
const mockGetPermission = jest.fn(async () => undefined);

jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [
    { granted: false, canAskAgain: false },
    jest.fn(),
    mockGetPermission,
  ],
}));

describe('useScannerPermission (adapter quét mã)', () => {
  it('đọc lại quyền camera khi app trở lại active (người dùng vừa bật quyền trong Cài đặt)', async () => {
    const listeners: Listener[] = [];
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _type: string,
      listener: Listener,
    ) => {
      listeners.push(listener);
      return { remove };
    }) as never);

    const { result, unmount } = await renderHook(() => useScannerPermission());
    expect(result.current.status).toBe('blocked');
    expect(mockGetPermission).not.toHaveBeenCalled();

    await act(async () => listeners.forEach((l) => l('background')));
    expect(mockGetPermission).not.toHaveBeenCalled();

    await act(async () => listeners.forEach((l) => l('active')));
    expect(mockGetPermission).toHaveBeenCalledTimes(1);

    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
