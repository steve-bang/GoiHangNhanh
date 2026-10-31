import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getIdToken,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setLanguageCode,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from '@react-native-firebase/auth';
import { doc, getDoc, getDocFromCache } from '@react-native-firebase/firestore';
import { httpsCallable } from '@react-native-firebase/functions';

import type { ShopDetails } from '../contract';

import type { FirebaseServices } from './client';
import { NO_CURRENT_USER } from './error-map';

/**
 * Đầu vào/ra của callable `createShop`/`updateShop` theo TỪ VỰNG MÁY CHỦ (nguồn bán `other_unknown`,
 * không phải `other` của app). `firebase-api.ts` đổi qua `@/core/orders/remote-source`; lớp này gửi và
 * trả nguyên văn.
 */
export interface RemoteShopInput {
  readonly name: string;
  readonly sellingSources: readonly string[];
  readonly shopId?: string;
}

export interface RemoteShopResult {
  readonly id: string;
  readonly name: string;
  readonly sellingSources: readonly string[];
}

export interface FirebaseUser {
  readonly uid: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly emailVerified: boolean;
  /** `providerId` của `user.providerData` (ví dụ `password`, `apple.com`, `google.com`). */
  readonly providerIds: readonly string[];
}

/**
 * Lớp mỏng quanh SDK (các lời gọi thật); `firebase-api.ts` ghép chúng thành hợp đồng. Tách ra để
 * unit test `firebase-api` bằng một `FirebaseOps` giả mà không cần mô phỏng cả SDK.
 */
export interface FirebaseOps {
  createUser(email: string, password: string): Promise<FirebaseUser>;
  signIn(email: string, password: string): Promise<FirebaseUser>;
  /** Phiên đã lưu trên máy: lần phát đầu của `onAuthStateChanged`, không chờ mạng. */
  restoreUser(): Promise<FirebaseUser | null>;
  /** `null` = tài khoản chưa có shop. Đọc từ máy chủ (hoặc bộ nhớ đệm của SDK nếu offline). */
  readShopId(uid: string): Promise<string | null>;
  /** Như `readShopId` nhưng thử bộ nhớ đệm trước để mở app offline vẫn biết trạng thái. */
  readShopIdForRestore(uid: string): Promise<string | null>;
  /** Thoát Firebase Auth (xóa phiên trên máy). */
  signOut(): Promise<void>;
  /**
   * Firebase gửi thư có đường dẫn đặt lại mật khẩu (D-14 v1). Thư tiếng Việt nếu mẫu thư có bản
   * tiếng Việt (Console). Không `actionCodeSettings`: mật khẩu mới đặt trên trang của Firebase.
   */
  sendPasswordReset(email: string): Promise<void>;
  /** Thông tin shop + vai trò của `uid` trong shop; `null` nếu không có shop hoặc không phải thành viên đang hoạt động. */
  readShopDetails(shopId: string, uid: string): Promise<ShopDetails | null>;
  /**
   * Đổi mật khẩu người dùng đang đăng nhập: xác thực lại bằng email + mật khẩu hiện tại TRƯỚC, rồi
   * `updatePassword`. Xác thực lại lỗi thì không đổi gì. Không còn người dùng: lỗi `NO_CURRENT_USER`.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  /** Auth `updateProfile({ displayName })` của người dùng đang đăng nhập. */
  updateDisplayName(displayName: string): Promise<void>;
  /**
   * Nguồn bán đang lưu của shop (Rules: thành viên đọc được), NGUYÊN giá trị máy chủ (từ vựng máy chủ);
   * `null` khi không đọc ra được mảng.
   */
  readShopSellingSources(shopId: string): Promise<readonly string[] | null>;
  callShop(name: 'createShop' | 'updateShop', input: RemoteShopInput): Promise<RemoteShopResult>;
  /**
   * Xác thực lại người dùng đang đăng nhập bằng email + mật khẩu. Không còn người dùng: lỗi `NO_CURRENT_USER`.
   */
  reauthenticate(password: string): Promise<void>;
  /**
   * BẮT BUỘC lấy ID token mới (`getIdToken(true)`) sau khi xác thực lại: token cũ mang `auth_time` cũ, máy
   * chủ `deleteAccount` sẽ từ chối (V1-14 b). Không còn người dùng: lỗi `NO_CURRENT_USER`.
   */
  forceRefreshIdToken(): Promise<void>;
  /** Callable `deleteAccount` (không tham số; uid lấy từ token ở máy chủ). Trả nguyên `data`. */
  callDeleteAccount(): Promise<{ readonly status?: unknown }>;
}

/** Ngôn ngữ thư đặt lại mật khẩu của Firebase Auth. */
export const PASSWORD_RESET_LANGUAGE = 'vi';

const providerIdsOf = (user: { providerData?: readonly { providerId: string }[] }): string[] =>
  (user.providerData ?? []).map((info) => info.providerId);

/** Rules từ chối (đã bị thu hồi, không phải thành viên, `members/{uid}` chưa có). Mạng/lỗi khác thì KHÔNG. */
export function isPermissionDenied(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'firestore/permission-denied' || code === 'permission-denied';
}

export function createFirebaseOps({ auth, db, functions }: FirebaseServices): FirebaseOps {
  const shopIdOf = (data: { shopId?: unknown } | undefined): string | null =>
    typeof data?.shopId === 'string' ? data.shopId : null;

  return {
    async createUser(email, password) {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      return {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        providerIds: providerIdsOf(user),
      };
    },
    async signIn(email, password) {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        providerIds: providerIdsOf(user),
      };
    },
    restoreUser() {
      return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(
          auth,
          (user) => {
            unsubscribe();
            resolve(
              user
                ? {
                    uid: user.uid,
                    email: user.email,
                    emailVerified: user.emailVerified,
                    displayName: user.displayName,
                    providerIds: providerIdsOf(user),
                  }
                : null,
            );
          },
          reject,
        );
      });
    },
    async readShopId(uid) {
      const snapshot = await getDoc(doc(db, 'userShops', uid));
      return snapshot.exists() ? shopIdOf(snapshot.data()) : null;
    },
    async readShopIdForRestore(uid) {
      const ref = doc(db, 'userShops', uid);
      try {
        const cached = await getDocFromCache(ref);
        if (cached.exists()) return shopIdOf(cached.data());
      } catch {
        // Chưa có trong bộ nhớ đệm: hỏi máy chủ bên dưới.
      }
      const snapshot = await getDoc(ref);
      return snapshot.exists() ? shopIdOf(snapshot.data()) : null;
    },
    signOut() {
      return signOut(auth);
    },
    async sendPasswordReset(email) {
      // Ngôn ngữ thư: đặt lỗi thì vẫn gửi (thư có thể ra tiếng Anh), không chặn người dùng lấy lại mật khẩu.
      await setLanguageCode(auth, PASSWORD_RESET_LANGUAGE).catch(() => undefined);
      await sendPasswordResetEmail(auth, email);
    },
    async readShopDetails(shopId, uid) {
      // Chỉ thành viên đang hoạt động đọc được (Rules). Rules từ chối (`permission-denied`) thì coi như
      // không có shop (`null`); lỗi khác (mạng...) vẫn ném để bên gọi không nhầm là "chưa có shop".
      let shopSnap;
      let memberSnap;
      try {
        [shopSnap, memberSnap] = await Promise.all([
          getDoc(doc(db, 'shops', shopId)),
          getDoc(doc(db, 'shops', shopId, 'members', uid)),
        ]);
      } catch (error) {
        if (isPermissionDenied(error)) return null;
        throw error;
      }
      if (!shopSnap.exists() || !memberSnap.exists()) return null;
      const member = memberSnap.data() as { roles?: unknown; status?: unknown } | undefined;
      if (member?.status !== 'active') return null;
      const name = (shopSnap.data() as { name?: unknown } | undefined)?.name;
      if (typeof name !== 'string') return null;
      const roles = Array.isArray(member.roles) ? member.roles : [];
      const isOwner = roles.includes('owner');
      return {
        id: shopId,
        name,
        role: isOwner ? 'owner' : 'member',
        canEdit: isOwner || roles.includes('manager'),
      };
    },
    async changePassword(currentPassword, newPassword) {
      const user = auth.currentUser;
      if (!user?.email) throw Object.assign(new Error(NO_CURRENT_USER), { code: NO_CURRENT_USER });
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, currentPassword),
      );
      await updatePassword(user, newPassword);
    },
    async updateDisplayName(displayName) {
      const user = auth.currentUser;
      if (!user) throw Object.assign(new Error(NO_CURRENT_USER), { code: NO_CURRENT_USER });
      await updateProfile(user, { displayName });
    },
    async readShopSellingSources(shopId) {
      const snapshot = await getDoc(doc(db, 'shops', shopId));
      if (!snapshot.exists()) return null;
      const sources = (snapshot.data() as { sellingSources?: unknown } | undefined)?.sellingSources;
      return Array.isArray(sources) && sources.every((value) => typeof value === 'string')
        ? sources
        : null;
    },
    async reauthenticate(password) {
      const user = auth.currentUser;
      if (!user?.email) throw Object.assign(new Error(NO_CURRENT_USER), { code: NO_CURRENT_USER });
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    },
    async forceRefreshIdToken() {
      const user = auth.currentUser;
      if (!user) throw Object.assign(new Error(NO_CURRENT_USER), { code: NO_CURRENT_USER });
      await getIdToken(user, true);
    },
    async callDeleteAccount() {
      const call = httpsCallable<Record<string, never>, { status?: unknown }>(
        functions,
        'deleteAccount',
      );
      const { data } = await call({});
      return data ?? {};
    },
    async callShop(name, input) {
      const call = httpsCallable<RemoteShopInput, RemoteShopResult>(functions, name);
      const { data } = await call(input);
      return { id: data.id, name: data.name, sellingSources: data.sellingSources };
    },
  };
}
