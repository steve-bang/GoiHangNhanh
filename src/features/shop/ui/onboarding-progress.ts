/**
 * Tiến trình luồng thiết lập đếm theo luồng thật: Tạo tài khoản = 1, Thông tin shop = 2,
 * Hoàn tất = 3 (quyết định đã duyệt, docs/09 UI-A04). Thuần TypeScript.
 */
export const ONBOARDING_TOTAL_STEPS = 3;
export const ONBOARDING_STEP = { account: 1, shop: 2, done: 3 } as const;

export type StepState = 'done' | 'current' | 'todo';

/** Trạng thái từng đoạn của thanh: các bước trước bước hiện tại là `done`, sau là `todo`. */
export function getStepSegments(current: number, total = ONBOARDING_TOTAL_STEPS): StepState[] {
  return Array.from({ length: total }, (_, index) => {
    const step = index + 1;
    return step < current ? 'done' : step === current ? 'current' : 'todo';
  });
}
