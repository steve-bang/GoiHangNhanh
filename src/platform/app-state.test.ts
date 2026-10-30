import { AppState, type AppStateStatus } from 'react-native';

import { onceAppActive, subscribeAppActive, subscribeAppBackground } from './app-state';

const listeners = new Set<(state: AppStateStatus) => void>();
let spy: jest.SpyInstance;

beforeEach(() => {
  listeners.clear();
  spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    fn: (state: AppStateStatus) => void,
  ) => {
    listeners.add(fn);
    return { remove: () => listeners.delete(fn) };
  }) as never);
});
afterEach(() => spy.mockRestore());

const emit = (state: AppStateStatus) => {
  for (const fn of Array.from(listeners)) fn(state);
};

describe('app-state adapter', () => {
  it('subscribeAppBackground: chỉ background, không inactive (iOS) hay active; hủy thì thôi gọi', () => {
    const onBackground = jest.fn();
    const off = subscribeAppBackground(onBackground);
    emit('inactive');
    emit('active');
    expect(onBackground).not.toHaveBeenCalled();
    emit('background');
    expect(onBackground).toHaveBeenCalledTimes(1);
    off();
    emit('background');
    expect(onBackground).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it('subscribeAppActive: gọi mỗi lần trở lại active', () => {
    const onActive = jest.fn();
    const off = subscribeAppActive(onActive);
    emit('background');
    emit('active');
    emit('active');
    expect(onActive).toHaveBeenCalledTimes(2);
    off();
  });

  it('onceAppActive: gọi đúng một lần ở lần active kế tiếp rồi tự hủy; hủy trước thì không gọi', () => {
    const callback = jest.fn();
    onceAppActive(callback);
    emit('background');
    expect(callback).not.toHaveBeenCalled();
    emit('active');
    emit('active');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);

    const other = jest.fn();
    const cancel = onceAppActive(other);
    cancel();
    cancel();
    emit('active');
    expect(other).not.toHaveBeenCalled();
  });
});
