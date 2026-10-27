import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { AccountMenuButton } from '@/features/shop';
import { useAppNavigation } from '@/platform';
import {
  ILLUSTRATIVE_ORDERS,
  ILLUSTRATIVE_SHOP_NAME,
  ILLUSTRATIVE_SYNC_COUNTS,
} from '@/shared/fixtures/illustrative-data';
import {
  ActionCard,
  Button,
  Card,
  EvidenceStatusBadge,
  Icon,
  OrderCard,
  Screen,
  SyncStatusBar,
  Text,
  useTheme,
} from '@/shared/ui';

const RECENT_ORDER_COUNT = 3;
/** Số lượng dưới đây là DỮ LIỆU MINH HỌA của việc cần xử lý. */
const ILLUSTRATIVE_UNFINISHED_SESSIONS = 1;

/**
 * UI-B01 Tổng quan (đặc tả A01). Thứ tự trên xuống theo docs/09: tên shop + menu tài khoản, khối
 * đồng bộ (chỉ khi có lỗi/tệp chờ), hai nút lớn, đơn gần đây, việc cần xử lý. KHÔNG biểu đồ doanh
 * thu, KHÔNG banner quảng bá (docs/09 mục 5.5, A.10).
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const navigation = useAppNavigation();
  const recent = ILLUSTRATIVE_ORDERS.slice(0, RECENT_ORDER_COUNT);

  return (
    <Screen
      title={ILLUSTRATIVE_SHOP_NAME}
      headerRight={<AccountMenuButton />}
      inTabs
      illustrative
      testID="screen-UI-B01"
    >
      <SyncStatusBar
        counts={ILLUSTRATIVE_SYNC_COUNTS}
        onPress={() => navigation.push(ROUTES.sync)}
      />

      <View style={{ gap: spacing.md }}>
        <ActionCard
          testID="home-pack-order"
          emphasis="primary"
          icon="package"
          title={t('screens:home.packOrder')}
          description={t('screens:home.packOrderHint')}
          onPress={() => navigation.push(ROUTES.scan)}
        />
        <ActionCard
          testID="home-receive-return"
          icon="returns"
          title={t('screens:home.receiveReturn')}
          description={t('screens:home.receiveReturnHint')}
          onPress={() => navigation.push(ROUTES.returnFindOrder)}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t('screens:home.recentOrders')}
        </Text>
        {recent.map((order) => (
          <OrderCard
            key={order.id}
            orderCode={order.orderCode}
            sourceLabel={t(`common:sources.${order.source}`)}
            source={order.source}
            dateLabel={order.dateLabel}
            videoCount={order.videoCount}
            {...(order.status ? { status: order.status } : {})}
            onPress={() => navigation.push(ROUTES.orderDetail, { orderId: order.id })}
          />
        ))}
        <Button
          variant="secondary"
          label={t('screens:home.allOrders')}
          onPress={() => navigation.push(ROUTES.orders)}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t('screens:home.tasks')}
        </Text>
        <TaskRow
          badge={<EvidenceStatusBadge status="error" />}
          text={t('screens:home.task.syncError', { count: ILLUSTRATIVE_SYNC_COUNTS.error })}
          onPress={() => navigation.push(ROUTES.sync)}
        />
        <TaskRow
          icon="camera"
          text={t('screens:home.task.unfinishedSession', {
            count: ILLUSTRATIVE_UNFINISHED_SESSIONS,
          })}
          onPress={() => navigation.push(ROUTES.packConfirm)}
        />
        <TaskRow
          icon="info"
          text={t('screens:home.task.storage')}
          onPress={() => navigation.push(ROUTES.storage)}
        />
      </View>
    </Screen>
  );
}

function TaskRow({
  text,
  onPress,
  badge,
  icon,
}: {
  text: string;
  onPress: () => void;
  badge?: ReactNode;
  icon?: 'camera' | 'info';
}) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={text}>
      <View style={styles.taskRow}>
        {badge ?? (icon ? <Icon name={icon} color={colors.warning} /> : null)}
        <Text style={styles.taskText}>{text}</Text>
        <Icon name="forward" color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskText: { flex: 1 },
});
