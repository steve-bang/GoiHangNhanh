// Kiểu của feature shop lấy từ hợp đồng API (src/api/contract); các tên *Gateway là bí danh giữ cho
// mã màn hình hiện có. Domain chỉ import KIỂU từ hợp đồng, không import hiện thực.
export type {
  ApiClient as Gateways,
  AuthAccount,
  AuthApi as AuthGateway,
  CreatedShop,
  CreateShopInput,
  ResetPasswordInput,
  SessionApi as SessionGateway,
  SessionState,
  ShopApi as ShopGateway,
  SignedInAccount,
  SignInWithPasswordInput,
  SignUpWithEmailInput,
  UpdateShopInput,
  VerifiedRecovery,
  VerifyRecoveryCodeInput,
} from '@/api/contract';
