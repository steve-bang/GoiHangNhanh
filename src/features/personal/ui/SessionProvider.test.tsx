import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AppError } from '@/core/errors/app-error';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { PersonalGatewaysProvider } from './PersonalGatewaysProvider';
import { SessionProvider, useSession } from './SessionProvider';

async function setup() {
  const gateways = createFakePersonalGateways();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PersonalGatewaysProvider gateways={gateways}>
      <SessionProvider>{children}</SessionProvider>
    </PersonalGatewaysProvider>
  );
  const hook = await renderHook(() => useSession(), { wrapper });
  return { gateways, hook };
}

const USER = { uid: 'u1', email: 'a@example.com', displayName: 'An' };

describe('SessionProvider', () => {
  it('bắt đầu chưa đăng nhập, không tự khôi phục phiên', async () => {
    const { hook, gateways } = await setup();
    expect(hook.result.current.state.status).toBe('signed_out');
    expect(hook.result.current.key).toBe('anonymous');
    expect(gateways.account.getProfileCalls).toBe(0);
  });

  it('đăng xuất thành công: xả state và gọi các hàm xả đã đăng ký', async () => {
    const { hook, gateways } = await setup();
    await act(async () => hook.result.current.beginSession(USER, 's1'));
    const cleared = jest.fn();
    hook.result.current.onSessionCleared(cleared);
    const before = hook.result.current.key;
    cleared.mockClear();

    await act(async () => {
      await hook.result.current.signOut();
    });
    expect(gateways.account.signOutCalls).toBe(1);
    expect(hook.result.current.state.status).toBe('signed_out');
    expect(hook.result.current.state.user).toBeNull();
    expect(hook.result.current.key).not.toBe(before);
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('đăng xuất lỗi: ném lại, GIỮ phiên, không xả state (không báo đăng xuất giả)', async () => {
    const { hook, gateways } = await setup();
    await act(async () => hook.result.current.beginSession(USER, 's1'));
    const cleared = jest.fn();
    hook.result.current.onSessionCleared(cleared);
    cleared.mockClear();
    gateways.account.failNext('AUTH_NETWORK_ERROR');

    await act(async () => {
      await expect(hook.result.current.signOut()).rejects.toBeInstanceOf(AppError);
    });
    expect(hook.result.current.state.status).toBe('signed_in');
    expect(hook.result.current.state.user).toEqual(USER);
    expect(cleared).not.toHaveBeenCalled();

    // Thử lại sau lỗi được (không kẹt cờ đang chạy).
    await act(async () => {
      await hook.result.current.signOut();
    });
    expect(hook.result.current.state.status).toBe('signed_out');
  });

  it('bấm đăng xuất hai lần liên tiếp chỉ gọi cổng một lần', async () => {
    const { hook, gateways } = await setup();
    await act(async () => hook.result.current.beginSession(USER, 's1'));
    await act(async () => {
      await Promise.all([hook.result.current.signOut(), hook.result.current.signOut()]);
    });
    expect(gateways.account.signOutCalls).toBe(1);
  });

  it('đổi shop đổi khóa phiên và xả state; đổi họ tên thì không', async () => {
    const { hook } = await setup();
    await act(async () => hook.result.current.beginSession(USER, 's1'));
    const cleared = jest.fn();
    hook.result.current.onSessionCleared(cleared);
    const key = hook.result.current.key;

    await act(async () => hook.result.current.updateDisplayName('Bình'));
    expect(hook.result.current.key).toBe(key);
    expect(cleared).not.toHaveBeenCalled();

    await act(async () => hook.result.current.changeShop('s2'));
    expect(hook.result.current.key).not.toBe(key);
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('hủy đăng ký thì không còn được gọi', async () => {
    const { hook } = await setup();
    const cleared = jest.fn();
    const off = hook.result.current.onSessionCleared(cleared);
    off();
    await act(async () => hook.result.current.beginSession(USER, 's1'));
    expect(cleared).not.toHaveBeenCalled();
  });

  it('dùng ngoài provider thì báo lỗi rõ ràng', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useSession())).rejects.toThrow(/SessionProvider/);
    jest.restoreAllMocks();
  });
});
