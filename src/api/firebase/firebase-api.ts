import { AppError } from '@/core/errors/app-error';
import { fromRemoteSources, toRemoteSources } from '@/core/orders/remote-source';

import type {
  AccountSignInMethod,
  ApiClient,
  AuthApi,
  CreatedShop,
  CreateShopInput,
  SessionApi,
  SessionIdentity,
  SessionState,
  ShopApi,
  ShopDetails,
  UpdateShopInput,
} from '../contract';

import {
  guard,
  mapCallableReason,
  mapFirebaseError,
  NO_CURRENT_USER,
  type ErrorOverrides,
} from './error-map';
import type { FirebaseServices } from './client';
import { createFirebaseOps, type FirebaseOps, type RemoteShopResult } from './ops';

/** Nhà cung cấp Auth -> cách đăng nhập. Nhà cung cấp lạ/không có thì `null` (không đoán, O-15). */
function signInMethodOf(providerIds: readonly string[]): AccountSignInMethod | null {
  if (providerIds.includes('password')) return 'password';
  if (providerIds.includes('apple.com')) return 'apple';
  if (providerIds.includes('google.com')) return 'google';
  return null;
}

/**
 * Ranh giới nguồn bán của callable shop (Q-29 / fix-other-source): app `other` -> máy chủ
 * `other_unknown` khi gửi, ngược lại khi nhận. Function luôn trả giá trị hợp lệ; giá trị lạ (nếu có) bị
 * bỏ khỏi KẾT QUẢ hiển thị, không ghi lại lên máy chủ từ đây.
 */
function toShopRequest(input: CreateShopInput | UpdateShopInput) {
  return { ...input, sellingSources: toRemoteSources(input.sellingSources) };
}

function fromShopResult(result: RemoteShopResult): CreatedShop {
  return {
    id: result.id,
    name: result.name,
    sellingSources: fromRemoteSources(result.sellingSources),
  };
}

const unavailable = () => Promise.reject(new AppError('AUTH_SERVICE_UNAVAILABLE'));

/**
 * Chờ bao lâu mới cho gửi lại thư đặt lại mật khẩu (giây). Firebase không báo; giới hạn thật nằm ở
 * Firebase (`auth/too-many-requests`), con số này chỉ để người dùng không bấm liên tục.
 */
export const PASSWORD_RESET_RESEND_SECONDS = 60;

/**
 * Lỗi của `sendPasswordResetEmail` phụ thuộc TRẠNG THÁI TÀI KHOẢN: trả kết quả như email có tài khoản
 * để không lộ email đã đăng ký hay tài khoản bị khóa (decisions.md Q-29 / V1-03). `user-not-found` chỉ
 * có khi dự án TẮT chống dò email của Firebase; `user-disabled` khi tài khoản bị vô hiệu hóa.
 */
export const NEUTRAL_PASSWORD_RESET_ERRORS: readonly string[] = [
  'auth/user-not-found',
  'auth/user-disabled',
];
const isAccountStateError = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && NEUTRAL_PASSWORD_RESET_ERRORS.includes(code);
};

/**
 * Đổi mật khẩu: lỗi của bước xác thực lại mang nghĩa "mật khẩu hiện tại sai", không phải "sai thông
 * tin đăng nhập" như ở màn Đăng nhập (V1-05). Người dùng khác/không còn tài khoản: phiên hết hạn.
 */
export const CHANGE_PASSWORD_ERRORS: ErrorOverrides = {
  'auth/wrong-password': 'AUTH_WRONG_CURRENT_PASSWORD',
  'auth/invalid-credential': 'AUTH_WRONG_CURRENT_PASSWORD',
  'auth/user-mismatch': 'AUTH_SESSION_EXPIRED',
  'auth/user-not-found': 'AUTH_SESSION_EXPIRED',
  'auth/password-does-not-meet-requirements': 'AUTH_WEAK_PASSWORD',
};

/**
 * Xóa tài khoản (V1-15): bước xác thực lại mang nghĩa như đổi mật khẩu (sai = mật khẩu hiện tại sai).
 * Lỗi mạng của callable có thể đến ở cả hai dạng mã (có/không tiền tố `functions/`, chưa kiểm chứng trên
 * thiết bị): cả hai là mất mạng, không phải "hệ thống bận". `details.reason` đã ưu tiên ở `mapFirebaseError`.
 */
export const DELETE_ACCOUNT_ERRORS: ErrorOverrides = {
  ...CHANGE_PASSWORD_ERRORS,
  'auth/user-disabled': 'ACCOUNT_DISABLED',
  unavailable: 'AUTH_NETWORK_ERROR',
  'deadline-exceeded': 'AUTH_NETWORK_ERROR',
};

/**
 * Lỗi Auth nghĩa là "tài khoản không còn" (máy chủ đã xóa người dùng Auth ở lần gọi trước). Chỉ tin ở
 * bước xác thực lại: `user-not-found`; ở bước lấy token mới NGAY SAU khi xác thực lại thành công: thêm
 * `user-token-expired` (token bị thu hồi). `user-disabled` là tài khoản BỊ KHÓA, máy chủ vẫn còn tài
 * khoản: KHÔNG phải đã xóa (`ACCOUNT_DISABLED`, không gọi Function, không xóa gì trên máy). Sai mật khẩu (`wrong-password`,
 * `invalid-credential`) KHÔNG BAO GIỜ được coi là đã xóa. Hạn chế: dự án bật chống dò email thì Firebase
 * trả `invalid-credential` cả khi người dùng không còn, nên đường này không xảy ra (decisions Q-29 / V1-15 o).
 */
export const ACCOUNT_GONE_ON_REAUTH: readonly string[] = ['auth/user-not-found'];
export const ACCOUNT_GONE_ON_TOKEN: readonly string[] = [
  ...ACCOUNT_GONE_ON_REAUTH,
  'auth/user-token-expired',
];
const sdkCodeOf = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
};

/** Trạng thái hợp lệ của kết quả `deleteAccount` (firebase/functions/src/account.ts `DeleteAccountResult`). */
export const DELETE_ACCOUNT_OK_STATUSES: readonly string[] = [
  'pending_purge',
  'completed',
  'purged',
];

/** Đổi tên shop qua Function `updateShop`: từ chối quyền và dữ liệu bị từ chối có mã riêng của màn Sửa tên. */
export const RENAME_SHOP_ERRORS: ErrorOverrides = {
  'functions/permission-denied': 'SHOP_PERMISSION_DENIED',
  'functions/invalid-argument': 'SHOP_SAVE_FAILED',
  'functions/not-found': 'SHOP_SAVE_FAILED',
};

/**
 * Hiện thực `ApiClient` bằng Firebase: Auth cho tài khoản, Cloud Function callable cho shop,
 * Firestore (`userShops/{uid}`) để biết đã có shop chưa. Mọi lỗi SDK được đổi thành `AppError`.
 */
export function createFirebaseApi(services: FirebaseServices): ApiClient {
  const ops: FirebaseOps = createFirebaseOps(services);

  const auth: AuthApi = {
    signUpWithEmail: (input) =>
      guard(async () => {
        const user = await ops.createUser(input.email.trim(), input.password);
        return {
          uid: user.uid,
          email: user.email ?? input.email.trim(),
          emailVerified: user.emailVerified,
        };
      }),
    signInWithPassword: (input) =>
      guard(async () => {
        const user = await ops.signIn(input.email.trim(), input.password);
        let shopId: string | null;
        try {
          shopId = await ops.readShopId(user.uid);
        } catch (error) {
          // Auth đã đăng nhập nhưng chưa biết shop: UI sẽ báo lỗi, nên không để lại phiên "nửa đăng nhập"
          // (lần mở sau Splash sẽ khôi phục thành đã đăng nhập dù người dùng thấy lỗi). Thoát cho sạch rồi
          // báo lỗi gốc; thoát lỗi thì bỏ qua (người dùng đăng nhập lại là xong).
          await ops.signOut().catch(() => undefined);
          throw error;
        }
        return {
          uid: user.uid,
          email: user.email ?? input.email.trim(),
          emailVerified: user.emailVerified,
          displayName: user.displayName,
          hasShop: shopId !== null,
          shopId,
        };
      }),
    // Đăng nhập Apple/Google chưa làm (O-15): không giả vờ thành công.
    signInWithProvider: unavailable,
    // D-14 v1: thư đặt lại của Firebase (PASSWORD_RECOVERY_MODE = 'email_link'). TRUNG TÍNH: email
    // không có tài khoản cũng resolve như nhau. Mã 6 số (hướng B của O-22) để sau: hai hàm dưới vẫn
    // `AUTH_SERVICE_UNAVAILABLE` và không có lối vào ở chế độ email.
    requestPasswordRecovery: (email) =>
      guard(async () => {
        try {
          await ops.sendPasswordReset(email.trim());
        } catch (error) {
          if (!isAccountStateError(error)) throw error;
        }
        return { retryAfterSeconds: PASSWORD_RESET_RESEND_SECONDS };
      }),
    verifyRecoveryCode: unavailable,
    resetPassword: unavailable,
    signOut: () => guard(() => ops.signOut()),
    changePassword: (input) =>
      guard(
        () => ops.changePassword(input.currentPassword, input.newPassword),
        CHANGE_PASSWORD_ERRORS,
      ),
    updateDisplayName: (displayName) =>
      guard(async () => {
        await ops.updateDisplayName(displayName);
        return { displayName };
      }),
    // Hai pha (review PR #61): lỗi TRƯỚC khi gửi lời gọi xóa (xác thực lại, token mới) chắc chắn chưa xóa
    // gì; lỗi của chính lời gọi mà không có lý do rõ thì KHÔNG biết máy chủ đã xóa chưa
    // (`ACCOUNT_DELETE_UNCONFIRMED`). Kết quả lạ (thiếu `status`) cũng là chưa xác nhận.
    deleteAccount: async ({ password }) => {
      try {
        await ops.reauthenticate(password);
      } catch (error) {
        if (ACCOUNT_GONE_ON_REAUTH.includes(sdkCodeOf(error) ?? '')) return 'already_deleted';
        throw mapFirebaseError(error, DELETE_ACCOUNT_ERRORS);
      }
      try {
        await ops.forceRefreshIdToken();
      } catch (error) {
        if (ACCOUNT_GONE_ON_TOKEN.includes(sdkCodeOf(error) ?? '')) return 'already_deleted';
        throw mapFirebaseError(error, DELETE_ACCOUNT_ERRORS);
      }
      let result: { readonly status?: unknown };
      try {
        result = await ops.callDeleteAccount();
      } catch (error) {
        const byReason = mapCallableReason(error);
        if (byReason) throw byReason;
        const sdkCode = sdkCodeOf(error);
        throw new AppError('ACCOUNT_DELETE_UNCONFIRMED', sdkCode ? { sdkCode } : {}, {
          cause: error,
        });
      }
      if (
        typeof result.status !== 'string' ||
        !DELETE_ACCOUNT_OK_STATUSES.includes(result.status)
      ) {
        throw new AppError('ACCOUNT_DELETE_UNCONFIRMED');
      }
      return 'deleted';
    },
  };

  /** Người dùng đang đăng nhập hoặc lỗi phiên hết hạn (không coi "chưa đăng nhập" là "không có shop"). */
  const requireUser = async () => {
    const user = await ops.restoreUser();
    if (!user) throw Object.assign(new Error(NO_CURRENT_USER), { code: NO_CURRENT_USER });
    return user;
  };

  const shop: ShopApi = {
    createShop: (input) =>
      guard(async () => fromShopResult(await ops.callShop('createShop', toShopRequest(input)))),
    updateShop: (input) =>
      guard(async () => fromShopResult(await ops.callShop('updateShop', toShopRequest(input)))),
    getShop: (shopId) =>
      guard(async () => {
        const user = await ops.restoreUser();
        return user ? ops.readShopDetails(shopId, user.uid) : null;
      }),
    // Máy chủ chỉ cho một shop mỗi tài khoản (`createShop` idempotent theo `userShops/{uid}`).
    listMyShops: () =>
      guard(async (): Promise<readonly ShopDetails[]> => {
        const user = await requireUser();
        const shopId = await ops.readShopId(user.uid);
        if (shopId === null) return [];
        const details = await ops.readShopDetails(shopId, user.uid);
        return details ? [details] : [];
      }),
    // Function `updateShop` ghi đè cả tên và nguồn bán: đọc nguồn bán đang lưu để giữ nguyên. Không đọc
    // được thì dừng (không gửi mảng rỗng xóa nguồn bán). Quyền thật do Function kiểm `members/{uid}`.
    renameShop: (shopId, name) =>
      guard(async (): Promise<ShopDetails> => {
        const user = await requireUser();
        const details = await ops.readShopDetails(shopId, user.uid);
        if (!details) throw new AppError('SHOP_SAVE_FAILED');
        if (!details.canEdit) throw new AppError('SHOP_PERMISSION_DENIED');
        const stored = await ops.readShopSellingSources(shopId);
        if (stored === null) throw new AppError('SHOP_SAVE_FAILED');
        // Gửi lại NGUYÊN giá trị máy chủ đã lưu (đã là từ vựng máy chủ, ví dụ `other_unknown`): KHÔNG đi
        // qua ánh xạ app -> máy chủ, không lọc, để không làm mất hay đổi nguồn bán. Function tự kiểm lại.
        const saved = await ops.callShop('updateShop', { shopId, name, sellingSources: stored });
        return { ...details, name: saved.name };
      }, RENAME_SHOP_ERRORS),
  };

  const session: SessionApi = {
    restore: (): Promise<SessionState> =>
      guard(async () => {
        const user = await ops.restoreUser();
        if (!user) return 'signed_out';
        return (await ops.readShopIdForRestore(user.uid)) !== null
          ? 'signed_in'
          : 'signed_in_no_shop';
      }),
    // Không bịa ID: `readShopIdForRestore` thử bộ nhớ đệm rồi máy chủ; lỗi (offline, chưa có đệm) thì
    // ném lên để bên gọi giữ trạng thái "chưa biết" thay vì coi là không có shop.
    identity: (): Promise<SessionIdentity | null> =>
      guard(async () => {
        const user = await ops.restoreUser();
        if (!user) return null;
        // Tài khoản email/mật khẩu luôn có email. Thiếu thì không bịa chuỗi rỗng làm email thật: coi là
        // chưa xác định được danh tính (các nhà cung cấp khác có thể không có email: xem O-15).
        if (!user.email) throw new AppError('AUTH_SERVICE_UNAVAILABLE');
        return {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          signInMethod: signInMethodOf(user.providerIds),
          shopId: await ops.readShopIdForRestore(user.uid),
        };
      }),
  };

  return { auth, shop, session };
}

export type { CreatedShop };
