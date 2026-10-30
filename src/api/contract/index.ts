// Hợp đồng API của app: TypeScript thuần, không SDK, không biết backend nào đứng sau. Mọi hiện thực
// (api/firebase, api/fake, api/unavailable) phải qua bộ test hợp đồng (api/contract-tests).
// Lỗi nghiệp vụ được ném dưới dạng `AppError` (core/errors) với mã `AUTH_*`...; hiện thực tự dịch
// lỗi của SDK/giao thức sang các mã này, không để mã SDK lọt lên trên.
import type { AuthApi } from './auth';
import type { SessionApi } from './session';
import type { ShopApi } from './shop';

export type {
  AccountSignInMethod,
  AuthAccount,
  AuthApi,
  ChangePasswordInput,
  ResetPasswordInput,
  SignedInAccount,
  SignInWithPasswordInput,
  SignUpWithEmailInput,
  VerifiedRecovery,
  VerifyRecoveryCodeInput,
} from './auth';
export type { CreatedShop, CreateShopInput, ShopApi, ShopDetails, UpdateShopInput } from './shop';
export type { SessionApi, SessionIdentity, SessionState } from './session';

export interface ApiClient {
  readonly auth: AuthApi;
  readonly shop: ShopApi;
  readonly session: SessionApi;
}
export type { RemoteDocuments, RemoteWriteSpec } from './remote-documents';
