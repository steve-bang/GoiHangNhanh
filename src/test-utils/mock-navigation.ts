/**
 * Mock dùng chung cho adapter điều hướng (`@/platform/navigation`). Dùng trong test màn hình:
 *
 *   jest.mock('@/platform/navigation', () => jest.requireActual('@/test-utils/mock-navigation').navigationMock);
 *
 * Màn hình test không cần Expo Router thật; kiểm tra điều hướng bằng `mockNavigation.*`.
 */
export const mockNavigation = {
  push: jest.fn(),
  replace: jest.fn(),
  reset: jest.fn(),
  back: jest.fn(),
  params: {} as Record<string, string | undefined>,
  /** Callback `onAttempt` mà màn hình đăng ký với useConfirmBeforeLeave (mô phỏng người dùng cố rời màn). */
  attemptLeave: undefined as undefined | (() => void),
  leaveGuardEnabled: undefined as undefined | boolean,
  allowLeave: jest.fn(),
};

export function resetMockNavigation(): void {
  mockNavigation.push.mockReset();
  mockNavigation.replace.mockReset();
  mockNavigation.reset.mockReset();
  mockNavigation.back.mockReset();
  mockNavigation.allowLeave.mockReset();
  mockNavigation.params = {};
  mockNavigation.attemptLeave = undefined;
  mockNavigation.leaveGuardEnabled = undefined;
}

export const navigationMock = {
  useAppNavigation: () => ({
    push: mockNavigation.push,
    replace: mockNavigation.replace,
    reset: mockNavigation.reset,
    back: mockNavigation.back,
  }),
  useRouteParams: () => mockNavigation.params,
  useConfirmBeforeLeave: (enabled: boolean, onAttempt: () => void) => {
    mockNavigation.leaveGuardEnabled = enabled;
    mockNavigation.attemptLeave = onAttempt;
    return { allowLeave: mockNavigation.allowLeave };
  },
};
