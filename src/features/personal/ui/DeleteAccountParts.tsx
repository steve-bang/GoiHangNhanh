import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { ErrorCode } from '@/core/errors/codes';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import {
  Button,
  Card,
  Checkbox,
  Icon,
  ListGroup,
  PasswordField,
  Text,
  useTheme,
  type IconName,
  type TextFieldInput,
} from '@/shared/ui';

import {
  DELETE_CONDITION_IDS,
  type DeleteCondition,
  type DeleteConditionId,
  type DeleteConditionStatus,
} from '../domain/delete-account-conditions';

const STATUS_ICON: Record<DeleteConditionStatus | 'checking', IconName> = {
  met: 'check-circle',
  attention: 'alert-triangle',
  unknown: 'help',
  checking: 'clock',
};

/** Danh sách điều kiện (đang kiểm tra = `null`). `hide` bỏ mục không có nghĩa ở màn đó. */
export function DeleteConditionList({
  conditions,
  hide = [],
}: {
  conditions: readonly DeleteCondition[] | null;
  hide?: readonly DeleteConditionId[];
}) {
  const { t } = useTranslation();
  return (
    <ListGroup title={t('personal:deleteAccount.conditionsTitle')} testID="delete-conditions">
      {DELETE_CONDITION_IDS.filter((id) => !hide.includes(id)).map((id) => (
        <ConditionRow key={id} id={id} condition={conditions?.find((c) => c.id === id) ?? null} />
      ))}
    </ListGroup>
  );
}

/** Một điều kiện: biểu tượng + chữ trạng thái + chi tiết (không chỉ dựa vào màu). */
function ConditionRow({
  id,
  condition,
}: {
  id: DeleteConditionId;
  condition: DeleteCondition | null;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const status = condition?.status ?? 'checking';
  const title = t(`personal:deleteAccount.conditions.${id}.title`);
  // Mục không chặn (cảnh báo, thông tin) mà có việc: "Lưu ý", không phải "Cần xử lý".
  const wordKey =
    condition?.status === 'attention' && condition.kind !== 'blocker' ? 'notice' : status;
  const word = condition
    ? t(`personal:deleteAccount.status.${wordKey}`)
    : t('personal:deleteAccount.checking');
  const detail = condition
    ? t(`personal:deleteAccount.conditions.${id}.${condition.status}`, {
        count: condition.count ?? 0,
      })
    : null;
  const color =
    status === 'met'
      ? tokens.color.feedback.success.fg
      : status === 'attention'
        ? tokens.color.feedback.warning.fg
        : tokens.color.text.secondary;
  return (
    <View
      testID={`delete-condition-${id}`}
      accessible
      accessibilityLabel={[title, word, detail].filter(Boolean).join('. ')}
      style={{
        flexDirection: 'row',
        gap: tokens.space.md,
        padding: tokens.space.lg,
        alignItems: 'flex-start',
      }}
    >
      <Icon name={STATUS_ICON[status]} size={22} color={color} />
      <View style={{ flex: 1, flexShrink: 1, gap: tokens.space.xs }}>
        <Text>{title}</Text>
        <Text variant="caption" bold style={{ color }} testID={`delete-condition-${id}-status`}>
          {word}
        </Text>
        {detail ? (
          <Text variant="caption" color="textMuted">
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Cảnh báo tệp chưa tải sẽ mất (R-2 A) + hộp kiểm xác nhận RIÊNG + lối tới Trung tâm đồng bộ. */
export function UnsyncedLossNotice({
  count,
  acknowledged,
  onAcknowledge,
}: {
  count: number;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  return (
    <Card tone="warning" testID="delete-unsynced-warning">
      <View style={{ gap: tokens.space.md }}>
        <Text bold>{t('personal:deleteAccount.unsyncedWarning', { count })}</Text>
        <Checkbox
          label={t('personal:deleteAccount.unsyncedAck', { count })}
          checked={acknowledged}
          onChange={onAcknowledge}
          testID="delete-unsynced-ack"
        />
        <Button
          label={t('personal:deleteAccount.syncLink')}
          variant="secondary"
          onPress={() => navigation.push(ROUTES.sync)}
          testID="delete-sync-link"
        />
      </View>
    </Card>
  );
}

/** "Dữ liệu sẽ ra sao": câu máy chủ là câu chung app/web/store (decisions Q-29 / V1-20 điểm 11). */
export function DeleteDataCard() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <Card testID="delete-data">
      <View style={{ gap: tokens.space.sm }}>
        <Text bold accessibilityRole="header">
          {t('personal:deleteAccount.dataTitle')}
        </Text>
        <Text variant="caption" color="textMuted" testID="delete-data-server">
          {t('personal:deleteAccount.dataServer')}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('personal:deleteAccount.dataDevice')}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('personal:deleteAccount.dataDispute')}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('personal:deleteAccount.dataRestore')}
        </Text>
      </View>
    </Card>
  );
}

/**
 * Ô mật khẩu + nút xác nhận. Sai mật khẩu báo tại ô; lỗi khác báo dưới ô kèm "Chưa có gì bị xóa" (người
 * dùng lo mất dữ liệu). Không log, không giữ mật khẩu ngoài state của màn.
 */
export function DeletePasswordForm({
  password,
  onChangePassword,
  submitted,
  error,
  busy,
  disabled = false,
  confirmLabel,
  onConfirm,
  onBack,
}: {
  password: string;
  onChangePassword: (value: string) => void;
  submitted: boolean;
  error: ErrorCode | 'conditions_changed' | null;
  busy: boolean;
  /** Khóa nút xác nhận (điều kiện chưa đạt) mà không hiện "đang xử lý". */
  disabled?: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const inputRef = useRef<TextFieldInput>(null);
  const wrongPassword = error === 'AUTH_WRONG_CURRENT_PASSWORD';
  const fieldError = wrongPassword
    ? errorText(resolveErrorMessage(t, 'AUTH_WRONG_CURRENT_PASSWORD'))
    : submitted && password.length === 0
      ? t('personal:deleteAccount.password.required')
      : undefined;
  const banner =
    error === null || wrongPassword
      ? null
      : error === 'conditions_changed'
        ? t('personal:deleteAccount.conditionsChanged')
        : errorText(resolveErrorMessage(t, error));
  return (
    <View style={{ gap: tokens.space.lg }} testID="delete-password-step">
      <View style={{ gap: tokens.space.xs }}>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t('personal:deleteAccount.password.title')}
        </Text>
        <Text color="textMuted">{t('personal:deleteAccount.password.intro')}</Text>
      </View>
      <PasswordField
        label={t('personal:deleteAccount.password.label')}
        placeholder={t('personal:deleteAccount.password.placeholder')}
        required
        value={password}
        onChangeText={onChangePassword}
        autoComplete="current-password"
        inputRef={inputRef}
        returnKeyType="done"
        onSubmitEditing={onConfirm}
        {...(fieldError ? { error: fieldError } : {})}
        testID="delete-password"
      />
      {banner ? (
        <Card tone="danger" testID="delete-error">
          <View style={{ gap: tokens.space.xs }}>
            <Text bold accessibilityRole="alert">
              {banner}
            </Text>
            <Text variant="caption" testID="delete-nothing-deleted">
              {t('personal:deleteAccount.password.nothingDeleted')}
            </Text>
          </View>
        </Card>
      ) : null}
      <Button
        label={confirmLabel}
        variant="destructive"
        loading={busy}
        disabled={busy || disabled}
        onPress={onConfirm}
        testID="delete-confirm"
      />
      {onBack ? (
        <Button
          label={t('personal:deleteAccount.password.back')}
          variant="secondary"
          disabled={busy}
          onPress={onBack}
          testID="delete-password-back"
        />
      ) : null}
    </View>
  );
}
