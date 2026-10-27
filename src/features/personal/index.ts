// Public API của feature personal (tab Cá nhân). Feature khác chỉ import từ đây (@/features/personal).
export { PersonalGatewaysProvider, usePersonalGateways } from './ui/PersonalGatewaysProvider';
export { ChangePasswordScreen } from './ui/ChangePasswordScreen';
export { EditProfileScreen } from './ui/EditProfileScreen';
export { ProfileScreen } from './ui/ProfileScreen';
export { SessionHydrator } from './ui/SessionHydrator';
export { SessionProvider, useSession } from './ui/SessionProvider';
export type { SessionContextValue } from './ui/SessionProvider';
export { INITIAL_SESSION, sessionKey } from './domain/session-state';
export type { SessionState, SessionUser } from './domain/session-state';
export type {
  AccountGateway,
  NotificationPreferences,
  PersonalGateways,
  SettingsGateway,
  ShopSummary,
  SignInMethod,
  UserProfile,
} from './domain/types';
export { createFakePersonalGateways } from './data/fake-personal-gateways';
/** Chỉ cho test: đặt lại cổng mặc định (cổng giả giữ trạng thái trong bộ nhớ giữa các bài test). */
export { resetDefaultPersonalGatewaysForTests } from './data/personal-gateways';
