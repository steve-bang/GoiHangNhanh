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
    // xóa vé + email đã gửi mã; chỉ còn banner và email điền sẵn cho màn Đăng nhập (dùng một lần)
    expect(s).toEqual({ ...INITIAL_RECOVERY_STATE, resetNotice: true, signInEmail: 'a@b.co' });
    s = recoveryReducer(s, { type: 'notice_consumed' });
    s = recoveryReducer(s, { type: 'signin_email_consumed' });
    expect(s).toEqual(INITIAL_RECOVERY_STATE);
  });

  it('không có trường nào chứa mật khẩu hoặc mã người dùng gõ', () => {
    expect(Object.keys(INITIAL_RECOVERY_STATE).sort()).toEqual([
      'email',
      'requestedEmail',
      'resendAvailableAt',
      'resetNotice',
      'signInEmail',
      'ticket',
      'ticketExpiresAt',
    ]);
  });

  const inFlow: RecoveryState = {
    ...INITIAL_RECOVERY_STATE,
    email: 'a@b.co',
    requestedEmail: 'a@b.co',
    resendAvailableAt: 99,
    ticket: 'v1',
    ticketExpiresAt: 500,
  };

  it('đổi sang email khác: xóa email đã gửi mã, mốc gửi lại, vé và hạn vé', () => {
    const after = recoveryReducer(inFlow, { type: 'email_changed', email: 'khac@b.co' });
    expect(after).toMatchObject({
      email: 'khac@b.co',
      requestedEmail: null,
      resendAvailableAt: null,
      ticket: null,
      ticketExpiresAt: null,
    });
  });

  it('gõ lại đúng email đã gửi mã (khác hoa/thường, khoảng trắng): giữ nguyên điều kiện', () => {
    const after = recoveryReducer(inFlow, { type: 'email_changed', email: ' A@B.co ' });
    expect(after).toMatchObject({ requestedEmail: 'a@b.co', ticket: 'v1', resendAvailableAt: 99 });
  });

  it('rời luồng: xóa email đã gửi mã, mốc gửi lại, vé; giữ email đang gõ', () => {
    const after = recoveryReducer(inFlow, { type: 'left_flow' });
    expect(after).toEqual({ ...INITIAL_RECOVERY_STATE, email: 'a@b.co' });
  });

  it('vé hết hạn: chỉ xóa vé, còn điều kiện vào màn Nhập mã', () => {
    const after = recoveryReducer(inFlow, { type: 'ticket_expired' });
    expect(after).toMatchObject({ ticket: null, ticketExpiresAt: null, requestedEmail: 'a@b.co' });
  });

  it('mã đúng ghi hạn vé khi cổng báo; không báo thì null', () => {
    expect(
      recoveryReducer(INITIAL_RECOVERY_STATE, {
        type: 'code_verified',
        ticket: 'v',
        ticketExpiresAt: 1000,
      }).ticketExpiresAt,
    ).toBe(1000);
    expect(
      recoveryReducer(INITIAL_RECOVERY_STATE, { type: 'code_verified', ticket: 'v' })
        .ticketExpiresAt,
    ).toBeNull();
  });

  it('email điền sẵn cho Đăng nhập: đặt rồi dùng một lần', () => {
    let s = recoveryReducer(INITIAL_RECOVERY_STATE, { type: 'signin_email_set', email: 'a@b.co' });
    expect(s.signInEmail).toBe('a@b.co');
    s = recoveryReducer(s, { type: 'signin_email_consumed' });
    expect(s.signInEmail).toBeNull();
  });

  it('xin mã (lại): xóa vé và hạn vé cũ', () => {
    const after = recoveryReducer(inFlow, {
      type: 'code_requested',
      email: 'a@b.co',
      resendAvailableAt: 5,
    });
    expect(after).toMatchObject({ ticket: null, ticketExpiresAt: null });
  });
});
