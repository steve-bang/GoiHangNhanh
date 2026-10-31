import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useDeviceSetting } from '@/features/orders';
import { useAppNavigation } from '@/platform';
import {
  ListGroup,
  ListItem,
  Screen,
  Skeleton,
  StatusBadge,
  Switch,
  useTheme,
  useToast,
  type IconName,
} from '@/shared/ui';

import { CRASH_REPORTS_ENABLED } from '../domain/crash-reports';
import type { UserProfile } from '../domain/types';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { useSession } from './SessionProvider';
import { useRegion, type Region } from './use-region';

/**
 * Quyền riêng tư và bảo mật (UI-I05; board 07 khung 14). Chỉ "Đổi mật khẩu" làm được thật (route con
 * `changePassword`, PER-04) và chỉ với tài khoản đăng nhập bằng mật khẩu: tài khoản Apple/Google thấy hàng
 * ghi chú, không điều hướng (như PR-C, D-13, Q-20c). Ba hàng bị khóa "Sắp có", KHÔNG điều hướng:
 * Xác thực 2 lớp (chưa có MFA; nhãn "Xác nhận 2 lớp" vì test cụm cấm chặn "xác thực"; bỏ "Chưa bật" của board), Thiết bị đăng nhập (PER-15
 * cần theo dõi phiên), Dữ liệu và quyền truy cập (chưa có màn đích). "Xóa tài khoản" (chữ đỏ, nhóm riêng) mở màn thông tin
 * `deleteAccount` (PER-22, khung 20): màn đó có nút xóa KHÓA, không luồng xóa (Q-20e, Q-21h). Không nói mã hóa, 2FA
 * hay bảo vệ đặc biệt nào chưa có. Nhóm "Gửi báo lỗi ứng dụng" (V1-16): công tắc cài đặt máy, mặc định bật.
 */
export function SecurityScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { account } = usePersonalGateways();
  const session = useSession();
  const profile = useRegion(() => account.getProfile(), session.key);

  return (
    <Screen
      title={t('nav:titles.UI-I05')}
      onBack={navigation.back}
      testID="screen-UI-I05"
      contentGap={tokens.space.lg}
    >
      <ListGroup testID="security-group">
        <PasswordRow profile={profile} />
        <LockedRow id="twoFactor" icon="shield-check" />
        <LockedRow id="devices" icon="phone" />
        <LockedRow id="dataAccess" icon="eye" />
      </ListGroup>
      <ListGroup testID="security-group-diagnostics">
        <CrashReportsSwitch />
      </ListGroup>
      <ListGroup testID="security-group-danger">
        <ListItem
          leadingIcon="alert-triangle"
          title={t('personal:security.deleteAccount')}
          titleWeight="regular"
          destructive
          onPress={() => navigation.push(ROUTES.deleteAccount)}
          testID="security-deleteAccount"
        />
      </ListGroup>
    </Screen>
  );
}

/**
 * "Gửi báo lỗi ứng dụng" (V1-16, R-8 A): lưu trên máy (`device_settings`). Tắt có hiệu lực ngay; bật lại
 * thì báo "đầy đủ từ lần mở ứng dụng sau" (thu thập sập native của SDK áp dụng ở lần chạy sau). Ghi lỗi:
 * báo và giữ giá trị cũ (như `WifiOnlySwitch`).
 */
function CrashReportsSwitch() {
  const { t } = useTranslation();
  const toast = useToast();
  const { value, loaded, setValue } = useDeviceSetting(CRASH_REPORTS_ENABLED);
  const [saving, setSaving] = useState(false);
  const change = async (next: boolean) => {
    setSaving(true);
    try {
      await setValue(next);
      if (next) toast.show(t('personal:security.crashReports.enabled'));
    } catch {
      toast.show(t('personal:security.crashReports.saveFailed'), { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Switch
      label={t('personal:security.crashReports.label')}
      description={t('personal:security.crashReports.description')}
      icon="send"
      value={value}
      onValueChange={(next) => void change(next)}
      disabled={!loaded || saving}
      testID="security-crashReports"
    />
  );
}

/** Hàng Đổi mật khẩu: tùy cách đăng nhập của tài khoản (cần tải hồ sơ). */
function PasswordRow({ profile }: { profile: Region<UserProfile> }) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const title = t('personal:security.changePassword');
  const state = profile.state;
  if (state.status === 'loading') {
    return (
      <ListItem
        leadingIcon="lock"
        title={title}
        titleWeight="regular"
        trailing={<Skeleton width={48} />}
        accessibilityLabel={`${title}. ${t('personal:security.profileLoading')}`}
        testID="security-password-loading"
      />
    );
  }
  if (state.status === 'error') {
    return (
      <ListItem
        leadingIcon="lock"
        title={title}
        titleWeight="regular"
        subtitle={t('personal:security.profileError')}
        onPress={() => void profile.reload()}
        showChevron={false}
        accessibilityLabel={`${title}. ${t('personal:security.profileError')}`}
        accessibilityHint={t('personal:security.profileRetryHint')}
        testID="security-password-retry"
      />
    );
  }
  const method = state.data.signInMethod;
  if (method !== 'password') {
    const provider = t(`personal:changePassword.provider.${method}`);
    return (
      <ListItem
        leadingIcon="lock"
        title={title}
        titleWeight="regular"
        subtitle={t('personal:security.socialPassword', { provider })}
        testID="security-password-social"
      />
    );
  }
  return (
    <ListItem
      leadingIcon="lock"
      title={title}
      titleWeight="regular"
      onPress={() => navigation.push(ROUTES.changePassword)}
      testID="security-password"
    />
  );
}

/** Hàng chưa làm: khóa, nhãn "Sắp có", không điều hướng. */
function LockedRow({
  id,
  icon,
  destructive = false,
}: {
  id: 'twoFactor' | 'devices' | 'dataAccess';
  icon: IconName;
  destructive?: boolean;
}) {
  const { t } = useTranslation();
  const label = t(`personal:security.${id}`);
  const soon = t('personal:status.comingSoon');
  return (
    <ListItem
      leadingIcon={icon}
      title={label}
      titleWeight="regular"
      destructive={destructive}
      // Hàng khóa vẫn là nút (vô hiệu) để trình đọc màn hình đọc "không dùng được" kèm gợi ý; bấm không làm gì.
      onPress={() => undefined}
      disabled
      showChevron={false}
      trailing={<StatusBadge label={soon} />}
      accessibilityLabel={`${label}. ${soon}`}
      accessibilityHint={t('personal:security.lockedHint')}
      testID={`security-${id}`}
    />
  );
}
