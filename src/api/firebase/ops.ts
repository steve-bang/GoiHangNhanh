import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from '@react-native-firebase/auth';
import { doc, getDoc, getDocFromCache } from '@react-native-firebase/firestore';
import { httpsCallable } from '@react-native-firebase/functions';

import type { CreatedShop, CreateShopInput, ShopDetails, UpdateShopInput } from '../contract';

import type { FirebaseServices } from './client';

export interface FirebaseUser {
  readonly uid: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly emailVerified: boolean;
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
  /** Thông tin shop + vai trò của `uid` trong shop; `null` nếu không có shop hoặc không phải thành viên đang hoạt động. */
  readShopDetails(shopId: string, uid: string): Promise<ShopDetails | null>;
  callShop(
    name: 'createShop' | 'updateShop',
    input: CreateShopInput | UpdateShopInput,
  ): Promise<CreatedShop>;
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
      };
    },
    async signIn(email, password) {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
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
    async readShopDetails(shopId, uid) {
      // Chỉ thành viên đang hoạt động đọc được (Rules); không đọc được thì coi như không có.
      const [shopSnap, memberSnap] = await Promise.all([
        getDoc(doc(db, 'shops', shopId)),
        getDoc(doc(db, 'shops', shopId, 'members', uid)),
      ]);
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
    async callShop(name, input) {
      const call = httpsCallable<CreateShopInput | UpdateShopInput, CreatedShop>(functions, name);
      const { data } = await call(input);
      return { id: data.id, name: data.name, sellingSources: data.sellingSources };
    },
  };
}
