import { PlaceholderScreen } from '@/shared/ui';

/**
 * Màn khung của shop: khởi động/thiết lập (UI-A02..A06), gói dịch vụ (UI-H01..H04), hồ sơ và cài
 * đặt (UI-I01..I06). Đăng nhập/thành viên/gói chưa có nghiệp vụ (O-03, O-15, O-16, O-06).
 * UI-A01 (Splash) hiện là chuyển hướng ở route gốc, chưa có màn.
 */
export const WelcomeScreen = () => <PlaceholderScreen uiCode="UI-A02" hideBack />;
export const SignInScreen = () => <PlaceholderScreen uiCode="UI-A03" />;
export const CreateShopScreen = () => <PlaceholderScreen uiCode="UI-A04" />;
export const PermissionsScreen = () => <PlaceholderScreen uiCode="UI-A05" />;
export const SetupDoneScreen = () => <PlaceholderScreen uiCode="UI-A06" />;

export const PlanScreen = () => <PlaceholderScreen uiCode="UI-H01" />;
export const PlansScreen = () => <PlaceholderScreen uiCode="UI-H02" />;
export const CheckoutScreen = () => <PlaceholderScreen uiCode="UI-H03" />;
export const PlanLimitScreen = () => <PlaceholderScreen uiCode="UI-H04" />;

export const ProfileScreen = () => <PlaceholderScreen uiCode="UI-I01" />;
export const ShopSettingsScreen = () => <PlaceholderScreen uiCode="UI-I02" />;
export const MembersScreen = () => <PlaceholderScreen uiCode="UI-I03" />;
export const NotificationsScreen = () => <PlaceholderScreen uiCode="UI-I04" />;
export const SecurityScreen = () => <PlaceholderScreen uiCode="UI-I05" />;
export const HelpScreen = () => <PlaceholderScreen uiCode="UI-I06" />;
