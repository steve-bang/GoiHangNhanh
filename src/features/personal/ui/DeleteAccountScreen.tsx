import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { getSupportEmail } from '@/core/config/support-contact';
import { ROUTES } from '@/core/navigation';
import { useOrderStore } from '@/features/orders';
import { useAppNavigation, useScreenFocused } from '@/platform';
import {
  Button,
  Card,
  Checkbox,
  Icon,
  IconTile,
  ListGroup,
  ListItem,
  Screen,
  Text,
  useTheme,
  type IconName,
} from '@/shared/ui';

import {
  DELETE_CONDITION_IDS,
  evaluateDeleteConditions,
  type DeleteCondition,
  type DeleteConditionFacts,
  type DeleteConditionStatus,
} from '../domain/delete-account-conditions';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { readDeviceFacts } from './read-device-facts';
import { useSession } from './SessionProvider';

type Checked = { readonly key: string; readonly facts: DeleteConditionFacts };

/**
 * Xóa tài khoản (PER-22; board 07 khung 20), route con của UI-I05 (Q-21b). CHỈ cho biết thông tin và điều
 * kiện THẬT; KHÔNG có luồng xóa: nút "Xóa tài khoản" luôn khóa, kể cả khi đã chọn "Tôi hiểu và đồng ý"
 * (chưa có chính sách và hạ tầng: Q-20e, Q-21h; bất biến 9). Không gọi cổng nào để xóa, không đăng xuất,
 * không xóa hay ẩn dữ liệu cục bộ. Điều kiện không có nguồn (tranh chấp) hoặc đọc lỗi ghi "Chưa kiểm tra
 * được", không bao giờ dấu tích giả. Đường dẫn tới hỗ trợ chỉ hiện khi đã có địa chỉ hỗ trợ thật.
 */
export function DeleteAccountScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const store = useOrderStore();
  const { account } = usePersonalGateways();
  const session = useSession();
  const focused = useScreenFocused();
  const [agreed, setAgreed] = useState(false);
  const [checked, setChecked] = useState<Checked | null>(null);

  // Đọc tình trạng thật theo khóa phiên: đổi tài khoản/cửa hàng thì bỏ kết quả cũ (không rò sang phiên mới).
  // Đọc lại mỗi khi màn lấy lại focus (ví dụ quay về từ trung tâm đồng bộ) để số tệp không bị cũ.
  useEffect(() => {
    if (!focused) return;
    let cancelled = false;
    const key = session.key;
    void (async () => {
      const [device, ownedShops] = await Promise.all([
        readDeviceFacts(store),
        account
          .listShops()
          .then((shops) => shops.filter((shop) => shop.role === 'owner').length)
          .catch(() => null),
      ]);
      if (!cancelled) setChecked({ key, facts: { ...device, ownedShops } });
    })();
    return () => {
      cancelled = true;
    };
  }, [store, account, session.key, focused]);

  const conditions =
    checked && checked.key === session.key ? evaluateDeleteConditions(checked.facts) : null;
  const unsyncedAttention = conditions?.some(
    (c) => c.id === 'unsynced' && c.status === 'attention',
  );
  const hasSupport = getSupportEmail() !== null;

  return (
    <Screen
      title={t('nav:subTitles.deleteAccount')}
      onBack={navigation.back}
      testID="screen-UI-I05-delete-account"
      contentGap={tokens.space.lg}
    >
      <View style={{ alignItems: 'center', gap: tokens.space.sm }}>
        <IconTile icon="alert" tone="danger" shape="circle" size="lg" />
        <Text variant="sectionTitle" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {t('personal:deleteAccount.title')}
        </Text>
        <Text color="textMuted" style={{ textAlign: 'center' }} testID="delete-intro">
          {t('personal:deleteAccount.intro')}
        </Text>
      </View>

      <ListGroup title={t('personal:deleteAccount.conditionsTitle')} testID="delete-conditions">
        {DELETE_CONDITION_IDS.map((id) => (
          <ConditionRow key={id} id={id} condition={conditions?.find((c) => c.id === id) ?? null} />
        ))}
      </ListGroup>
      {unsyncedAttention ? (
        <Button
          label={t('personal:deleteAccount.syncLink')}
          variant="secondary"
          onPress={() => navigation.push(ROUTES.sync)}
          testID="delete-sync-link"
        />
      ) : null}

      <Card testID="delete-data">
        <View style={{ gap: tokens.space.sm }}>
          <Text bold accessibilityRole="header">
            {t('personal:deleteAccount.dataTitle')}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('personal:deleteAccount.dataDispute')}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('personal:deleteAccount.dataDevice')}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('personal:deleteAccount.dataServer')}
          </Text>
        </View>
      </Card>

      <Checkbox
        label={t('personal:deleteAccount.agree')}
        checked={agreed}
        onChange={setAgreed}
        testID="delete-agree"
      />
      <View style={{ gap: tokens.space.sm }}>
        <Button
          label={t('personal:deleteAccount.delete')}
          variant="destructive"
          // Luôn khóa: chưa có chính sách và hạ tầng xóa (Q-21h). Không phụ thuộc hộp kiểm hay điều kiện.
          disabled
          onPress={() => undefined}
          accessibilityHint={t('personal:deleteAccount.deleteHint')}
          testID="delete-submit"
        />
        <Text variant="caption" color="textMuted" testID="delete-soon">
          {t('personal:deleteAccount.soon')}
        </Text>
        {hasSupport ? (
          <View style={{ gap: tokens.space.xs }} testID="delete-support">
            <Text variant="caption" color="textMuted">
              {t('personal:deleteAccount.support')}
            </Text>
            <ListGroup>
              <ListItem
                leadingIcon="help"
                title={t('personal:deleteAccount.supportLink')}
                titleWeight="regular"
                onPress={() => navigation.push(ROUTES.helpContact)}
                testID="delete-support-link"
              />
            </ListGroup>
          </View>
        ) : null}
      </View>
      <Button
        label={t('personal:deleteAccount.keep')}
        variant="secondary"
        onPress={navigation.back}
        testID="delete-keep"
      />
    </Screen>
  );
}

const STATUS_ICON: Record<DeleteConditionStatus | 'checking', IconName> = {
  met: 'check-circle',
  attention: 'alert-triangle',
  unknown: 'help',
  checking: 'clock',
};

/** Một điều kiện: biểu tượng + chữ trạng thái + chi tiết (không chỉ dựa vào màu). */
function ConditionRow({
  id,
  condition,
}: {
  id: DeleteCondition['id'];
  condition: DeleteCondition | null;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const status = condition?.status ?? 'checking';
  const title = t(`personal:deleteAccount.conditions.${id}.title`);
  const word = condition
    ? t(`personal:deleteAccount.status.${status as DeleteConditionStatus}`)
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
