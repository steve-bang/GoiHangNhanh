import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { useAppNavigation } from '@/platform';
import {
  Card,
  ErrorState,
  Icon,
  ListGroup,
  Screen,
  Skeleton,
  StatusBadge,
  Switch,
  Text,
  useTheme,
  useToast,
  type IconName,
} from '@/shared/ui';

import type { NotificationPreferenceKey, NotificationPreferences } from '../domain/types';
import { planMenuItem } from './account-menu';
import { Notice } from './Notice';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { useSession } from './SessionProvider';
import { useRegion } from './use-region';

/** Bốn loại thông báo theo docs/09 UI-I04, thứ tự hiển thị. Không có "mỗi video tải thành công". */
const OPTIONS: readonly { key: NotificationPreferenceKey; icon: IconName }[] = [
  { key: 'uploadProblems', icon: 'alert-triangle' },
  { key: 'syncCompleted', icon: 'sync' },
  { key: 'storageNearlyFull', icon: 'cloud' },
  { key: 'planExpiring', icon: 'clock' },
];

/**
 * Loại thông báo gắn với gói dịch vụ: ẩn khi mục `plan` của menu là `hidden` (cùng một cờ ở `account-menu.ts`,
 * Q-21ag). Giá trị vẫn nằm trong `NotificationPreferences` và được giữ nguyên khi lưu công tắc khác.
 */
const PLAN_LINKED_OPTION: NotificationPreferenceKey = 'planExpiring';

/**
 * Cài đặt thông báo (PER-13; UI-I04; board 07 khung 13). Bốn loại theo docs/09, hôm nay hiện ba (loại "Gói sắp hết hạn" ẩn
 * theo cờ `plan`; board vẽ năm loại, lệch: xem personal-tab-redesign-plan.md mục 6.7). Lựa chọn lưu qua `SettingsGateway`; ứng dụng CHƯA có hạ
 * tầng thông báo đẩy nên màn nói thẳng điều đó và KHÔNG hứa "bạn sẽ nhận thông báo". Không xin quyền hệ điều
 * hành ở đây và không dựng thẻ "Quyền thông báo bị từ chối" (chưa có adapter đọc quyền: sẽ là chức năng giả).
 * Giá trị hiện theo kết quả cổng: bật/tắt tức thì, hoàn về giá trị cũ nếu lưu lỗi; báo "Đã lưu" chỉ SAU KHI
 * cổng xác nhận; đang lưu thì mọi công tắc bị khóa (không gửi hai lần, không ghi chồng nhau). Dữ liệu gắn với
 * khóa phiên: đổi tài khoản/cửa hàng thì tải lại, kết quả muộn của phiên cũ bị bỏ.
 */
export function NotificationsScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const toast = useToast();
  const { settings } = usePersonalGateways();
  const session = useSession();
  const region = useRegion(() => settings.getNotificationPreferences(), session.key);

  // Bản đã được cổng xác nhận sau khi lưu (thắng bản tải ban đầu), gắn với khóa phiên để không rò sang phiên khác.
  const [confirmed, setConfirmed] = useState<{
    key: string;
    prefs: NotificationPreferences;
  } | null>(null);
  const [pending, setPending] = useState<{
    key: string;
    option: NotificationPreferenceKey;
    value: boolean;
  } | null>(null);
  const [saveError, setSaveError] = useState<{ key: string; code: ErrorCode } | null>(null);
  // Khóa phiên của lần lưu đang chạy (null = rảnh). Chỉ coi là bận khi trùng phiên hiện tại: lần lưu treo của
  // phiên cũ không được làm công tắc của phiên mới "chết".
  const busyScopeRef = useRef<string | null>(null);
  const scopeRef = useRef(session.key);
  useEffect(() => {
    scopeRef.current = session.key;
  }, [session.key]);

  const showPlanOption = planMenuItem().availability !== 'hidden';
  const options = OPTIONS.filter(({ key }) => showPlanOption || key !== PLAN_LINKED_OPTION);
  const loaded = region.state.status === 'ready' ? region.state.data : null;
  const base = confirmed?.key === session.key ? confirmed.prefs : loaded;

  const toggle = useCallback(
    async (option: NotificationPreferenceKey, value: boolean) => {
      const scope = session.key;
      if (busyScopeRef.current === scope || !base) return;
      busyScopeRef.current = scope;
      setSaveError(null);
      setPending({ key: scope, option, value });
      try {
        const saved = await settings.updateNotificationPreferences({ ...base, [option]: value });
        if (scopeRef.current !== scope) return;
        setConfirmed({ key: scope, prefs: saved });
        toast.show(t('personal:notificationSettings.saved'), { tone: 'success' });
      } catch (error) {
        if (scopeRef.current !== scope) return;
        setSaveError({
          key: scope,
          code: error instanceof AppError ? error.code : 'SETTINGS_SAVE_FAILED',
        });
      } finally {
        if (busyScopeRef.current === scope) busyScopeRef.current = null;
        setPending((current) => (current?.key === scope ? null : current));
      }
    },
    [base, session.key, settings, t, toast],
  );

  const activePending = pending?.key === session.key ? pending : null;
  const activeError = saveError?.key === session.key ? saveError.code : null;
  const loadMessage = resolveErrorMessage(
    t,
    region.state.status === 'error' ? region.state.code : 'AUTH_SERVICE_UNAVAILABLE',
  );

  return (
    <Screen
      title={t('nav:titles.UI-I04')}
      onBack={navigation.back}
      testID="screen-UI-I04"
      contentGap={tokens.space.lg}
    >
      <Card compact testID="notification-push-note">
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.sm }}>
          <Icon name="info" size={18} color={tokens.color.accent.blue.fg} />
          <View style={{ flex: 1, flexShrink: 1, gap: tokens.space.xs }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm }}>
              <Text bold>{t('personal:notificationSettings.pushTitle')}</Text>
              <StatusBadge label={t('personal:status.comingSoon')} />
            </View>
            <Text variant="caption" color="textMuted">
              {t('personal:notificationSettings.pushMessage')}
            </Text>
          </View>
        </View>
      </Card>

      {region.state.status === 'loading' ? (
        <Card testID="notification-loading">
          <View style={{ gap: tokens.space.md }}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="80%" />
            <Skeleton width="70%" />
          </View>
        </Card>
      ) : null}
      {region.state.status === 'error' ? (
        <Card>
          <ErrorState
            testID="notification-load-error"
            title={loadMessage.title}
            {...(loadMessage.hint ? { message: loadMessage.hint } : {})}
            onRetry={() => void region.reload()}
            retrying={region.refreshing}
          />
        </Card>
      ) : null}

      {activeError ? (
        <Notice alert testID="notification-save-error">
          {errorText(resolveErrorMessage(t, activeError))}
        </Notice>
      ) : null}

      {base ? (
        <ListGroup testID="notification-options">
          {options.map(({ key, icon }) => (
            <Switch
              key={key}
              icon={icon}
              label={t(`personal:notificationSettings.options.${key}.title`)}
              description={t(`personal:notificationSettings.options.${key}.description`)}
              value={activePending?.option === key ? activePending.value : base[key]}
              disabled={activePending !== null}
              onValueChange={(value) => void toggle(key, value)}
              testID={`notification-switch-${key}`}
            />
          ))}
        </ListGroup>
      ) : null}
    </Screen>
  );
}
