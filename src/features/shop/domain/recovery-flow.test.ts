import { INITIAL_RECOVERY_STATE, recoveryReducer, type RecoveryState } from './recovery-flow';

describe('recoveryReducer', () => {
  it('xin mã: ghi email đã gửi + mốc xin lại, xóa vé cũ', () => {
    const before: RecoveryState = { ...INITIAL_RECOVERY_STATE, ticket: 'cu' };
    const after = recoveryReducer(before, {
      type: 'code_requested',
      email: 'a@b.co',
      resendAvailableAt: 123,
    });
    expect(after).toMatchObject({ requestedEmail: 'a@b.co', resendAvailableAt: 123, ticket: null });
  });

  it('mã đúng: giữ vé; đặt lại xong: xóa mọi thứ và bật cờ thông báo; cờ chỉ dùng một lần', () => {
    let s = recoveryReducer(INITIAL_RECOVERY_STATE, { type: 'code_verified', ticket: 'v1' });
    expect(s.ticket).toBe('v1');
    s = recoveryReducer(
      { ...s, email: 'a@b.co', requestedEmail: 'a@b.co' },
      {
        type: 'reset_completed',
      },
    );
    expect(s).toEqual({ ...INITIAL_RECOVERY_STATE, resetNotice: true });
    s = recoveryReducer(s, { type: 'notice_consumed' });
    expect(s).toEqual(INITIAL_RECOVERY_STATE);
  });

  it('không có trường nào chứa mật khẩu hoặc mã người dùng gõ', () => {
    expect(Object.keys(INITIAL_RECOVERY_STATE).sort()).toEqual([
      'email',
      'requestedEmail',
      'resendAvailableAt',
      'resetNotice',
      'ticket',
    ]);
  });
});
