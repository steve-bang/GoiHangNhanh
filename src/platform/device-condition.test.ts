import { readDeviceCondition, UNKNOWN_DEVICE_CONDITION } from './device-condition';

let mockLevel: () => Promise<number> = async () => 0.5;
let mockState: () => Promise<number> = async () => 1;
jest.mock('expo-battery', () => ({
  BatteryState: { UNKNOWN: 0, UNPLUGGED: 1, CHARGING: 2, FULL: 3 },
  getBatteryLevelAsync: () => mockLevel(),
  getBatteryStateAsync: () => mockState(),
}));

describe('readDeviceCondition', () => {
  it('đọc mức pin và trạng thái sạc; nhiệt độ chưa có nguồn nên luôn null', async () => {
    mockLevel = async () => 0.42;
    mockState = async () => 1;
    expect(await readDeviceCondition()).toEqual({
      batteryLevel: 0.42,
      charging: false,
      thermal: null,
    });
    mockState = async () => 2;
    expect((await readDeviceCondition()).charging).toBe(true);
    mockState = async () => 3;
    expect((await readDeviceCondition()).charging).toBe(true);
    mockState = async () => 0;
    expect((await readDeviceCondition()).charging).toBeNull();
  });

  it('máy không báo pin (-1, NaN) thì "không biết", không đoán', async () => {
    mockState = async () => 1;
    for (const level of [-1, Number.NaN, 7]) {
      mockLevel = async () => level;
      expect((await readDeviceCondition()).batteryLevel).toBeNull();
    }
  });

  it('lỗi đọc: trả "không biết" (không chặn quay)', async () => {
    mockLevel = async () => {
      throw new Error('native');
    };
    expect(await readDeviceCondition()).toEqual(UNKNOWN_DEVICE_CONDITION);
  });
});
