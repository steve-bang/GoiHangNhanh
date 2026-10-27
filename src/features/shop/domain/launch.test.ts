import { ROUTES } from '@/core/navigation';

import {
  resolveLaunchRoute,
  SESSION_FALLBACK,
  SPLASH_MAX_WAIT_MS,
  SPLASH_MIN_VISIBLE_MS,
} from './launch';

describe('resolveLaunchRoute', () => {
  it('chưa đăng nhập -> Chào mừng', () => {
    expect(resolveLaunchRoute('signed_out')).toBe(ROUTES.welcome);
  });
  it('đã đăng nhập nhưng chưa có shop -> Tạo shop', () => {
    expect(resolveLaunchRoute('signed_in_no_shop')).toBe(ROUTES.createShop);
  });
  it('đã đăng nhập và có shop -> Tổng quan', () => {
    expect(resolveLaunchRoute('signed_in')).toBe(ROUTES.home);
  });
  it('trạng thái dự phòng (lỗi/quá hạn) là chưa đăng nhập', () => {
    expect(SESSION_FALLBACK).toBe('signed_out');
    expect(resolveLaunchRoute(SESSION_FALLBACK)).toBe(ROUTES.welcome);
  });
});

describe('thời gian Splash', () => {
  it('tối thiểu 2 giây, tối đa 3 giây, tối thiểu < tối đa', () => {
    expect(SPLASH_MIN_VISIBLE_MS).toBe(2000);
    expect(SPLASH_MAX_WAIT_MS).toBe(3000);
    expect(SPLASH_MIN_VISIBLE_MS).toBeLessThan(SPLASH_MAX_WAIT_MS);
  });
});
