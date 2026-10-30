// Public API của feature personal (tab Cá nhân). Feature khác chỉ import từ đây (@/features/personal).
export { PersonalGatewaysProvider, usePersonalGateways } from './ui/PersonalGatewaysProvider';
export { ChangePasswordScreen } from './ui/ChangePasswordScreen';
export { DeleteAccountScreen } from './ui/DeleteAccountScreen';
export { EditProfileScreen } from './ui/EditProfileScreen';
export { EvidenceDataScreen } from './ui/EvidenceDataScreen';
export { HelpArticleScreen } from './ui/HelpArticleScreen';
export { HelpCategoryScreen } from './ui/HelpCategoryScreen';
export { HelpScreen } from './ui/HelpScreen';
export { LegalScreen } from './ui/LegalScreen';
export { NotificationsScreen } from './ui/NotificationsScreen';
export { PaymentHistoryScreen } from './ui/PaymentHistoryScreen';
export { PlanDetailScreen } from './ui/PlanDetailScreen';
export { PlanScreen } from './ui/PlanScreen';
export { ProfileScreen } from './ui/ProfileScreen';
export { useCurrentShopName } from './ui/use-current-shop-name';
export { RetentionDetailScreen } from './ui/RetentionDetailScreen';
export { SecurityScreen } from './ui/SecurityScreen';
export { ShopEditScreen } from './ui/ShopEditScreen';
export { ShopSettingsScreen } from './ui/ShopSettingsScreen';
export { ShopSwitchScreen } from './ui/ShopSwitchScreen';
export { SupportContactScreen } from './ui/SupportContactScreen';
export { SessionHydrator } from './ui/SessionHydrator';
export { SessionGate, useRequireSession, withSessionGate } from './ui/SessionGate';
export type { SessionGateOptions } from './ui/SessionGate';
export { evaluateSessionGate } from './domain/session-gate';
export type { SessionGate as SessionGateState, SessionHydration } from './domain/session-gate';
export { SessionShopProvider } from './ui/SessionShopProvider';
export { SessionProvider, useSession } from './ui/SessionProvider';
export type { SessionContextValue } from './ui/SessionProvider';
export { INITIAL_SESSION, sessionKey } from './domain/session-state';
export type { SessionState, SessionUser } from './domain/session-state';
export type {
  AccountGateway,
  NotificationPreferences,
  PersonalGateways,
  SettingsGateway,
  ShopRole,
  ShopStatus,
  ShopSummary,
  SignInMethod,
  UserProfile,
} from './domain/types';
export { createFakePersonalGateways } from './data/fake-personal-gateways';
/** Chỉ cho test: đặt lại cổng mặc định (cổng giả giữ trạng thái trong bộ nhớ giữa các bài test). */
export { resetDefaultPersonalGatewaysForTests } from './data/personal-gateways';
