import { evaluateSignOutGuard, type SignOutFacts, type SignOutGuard } from './sign-out-guard';

/**
 * Điều kiện bảo vệ dữ liệu trước khi chuyển shop (PER-07). TypeScript thuần. Cùng quy tắc bảo thủ với
 * đăng xuất (đang quay > còn tệp chưa đồng bộ > không đọc được kho > cho phép) vì cả hai đều rời bối cảnh
 * mà video đang ghi/chờ tải thuộc về; "không đọc được kho" KHÔNG được coi là an toàn. Chuyển shop không
 * xóa dữ liệu cục bộ của shop cũ (Q-20h). Hành vi khi còn tệp chưa đồng bộ chốt tạm ở Q-20o.
 */
export type SwitchShopFacts = SignOutFacts;
export type SwitchShopGuard = SignOutGuard;

export function evaluateSwitchShopGuard(facts: SwitchShopFacts): SwitchShopGuard {
  return evaluateSignOutGuard(facts);
}
