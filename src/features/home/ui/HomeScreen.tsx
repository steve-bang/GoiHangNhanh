import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { logger } from '@/core/logging/logger';
import { ROUTES } from '@/core/navigation';
import { useDeviceSetting } from '@/features/orders';
import { useCurrentShopName } from '@/features/personal';
import { useTodayEvidenceStats } from '@/features/upload';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import {
  Button,
  Card,
  Icon,
  type IconName,
  ListGroup,
  ListItem,
  Screen,
  StatTile,
  SyncStatusBar,
  Text,
  useTheme,
} from '@/shared/ui';
import { layout } from '@/core/theme';

import { HOME_DEVICE_DATA_NOTICE_DISMISSED } from '../domain';

/** Dưới ngưỡng này (dp) hoặc khi chữ phóng từ mức này, ba ô thống kê xếp theo cột. */
const STACK_STATS_BELOW_WIDTH = 340;
const STACK_STATS_FONT_SCALE = 1.5;

/**
 * UI-B01 Trang chủ (đặc tả A01; mockup docs/assets/ui/02-home-and-scan.png, D-16; làm gọn theo
 * design system v2). Thứ tự: đầu trang (tên shop, lời chào, chuông), MỘT hành động chính *Đóng gói
 * đơn* và một hành động phụ *Nhận hàng hoàn*, 3 lối tắt, thống kê hôm nay, một hàng trợ giúp. Không
 * còn banner/thẻ gradient trang trí; lối tắt Quét bỏ vì trùng nút Quét giữa thanh tab. Chữ đã sửa so với mẫu (docs/09 mục 5.5): không hứa quá
 * mức, nhãn thống kê dùng nhãn trạng thái chuẩn. KHÔNG biểu đồ doanh thu. Hàng hoàn và Đồng bộ
 * không còn là tab: vào từ đây. "Đơn gần đây"/"Việc cần xử lý" của docs/09 chưa có trên mẫu (Q-16).
 *
 * UX redesign (docs/ux-architecture-redesign.md mục 6.1, PR #71, chưa BA duyệt): thứ tự hai thẻ hành động
 * -> khối "Bằng chứng cần theo dõi" (chỉ khi có tệp lỗi, dùng `SyncStatusBar`) -> thống kê hôm nay (ô số có
 * khối giữ chỗ khi đang đọc, nút Thử lại khi lỗi, ba ô xếp cột khi màn hẹp/chữ lớn) -> nhóm "Lối tắt" dạng
 * danh sách (gồm Danh sách hàng hoàn, trước đây là chữ lẻ) -> thẻ phụ. Kéo để làm mới đọc lại số liệu.
 * Không đổi route, dữ liệu hay luật nghiệp vụ.
 *
 * V1-10: tên shop từ phiên (`getShopSummary`), 3 ô đếm THẬT trên máy cho shop đang dùng
 * (`useTodayEvidenceStats`: định nghĩa ở `upload/domain/evidence-stats.ts`), không còn dữ liệu minh họa.
 * Đang đọc/đọc lỗi: ô hiện "–", không hiện 0 giả. Thẻ "Dữ liệu nằm trên máy này" (Q-24a) đóng được,
 * nhớ theo máy (`device_settings`).
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const touch = getMinTouchTarget();
  const shopName = useCurrentShopName();
  const { state: stats, reload } = useTodayEvidenceStats();
  const { width, fontScale } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  // Màn hẹp hoặc chữ phóng lớn: xếp ba ô số theo cột để số và nhãn không bị cắt (chưa kiểm trên máy).
  const stackStats = width < STACK_STATS_BELOW_WIDTH || fontScale >= STACK_STATS_FONT_SCALE;
  const refresh = () => {
    setRefreshing(true);
    reload()
      .catch((error: unknown) => {
        logger.warn('home.refresh_failed', {
          reason: error instanceof Error ? error.name : 'unknown',
        });
      })
      .finally(() => setRefreshing(false));
  };
  const loadingStats = stats.kind === 'loading';
  const needsAction = stats.kind === 'ready' ? stats.data.needsAction : 0;
  const notice = useDeviceSetting(HOME_DEVICE_DATA_NOTICE_DISMISSED);
  const showNotice = notice.loaded && !notice.value;
  const statValue = (key: 'packed' | 'uploaded' | 'needsAction') =>
    stats.kind === 'ready' ? stats.data[key] : t('screens:home.statUnknown');
  const todayEmpty =
    stats.kind === 'ready' &&
    stats.data.packed === 0 &&
    stats.data.uploaded === 0 &&
    stats.data.needsAction === 0;
  const dismissNotice = () => {
    notice.setValue(true).catch((error: unknown) => {
      // Ghi lỗi: thẻ vẫn hiện (giá trị giữ nguyên), lần sau bấm lại được.
      logger.warn('home.notice_dismiss_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
    });
  };

  const header = (
    <View
      style={[
        styles.header,
        { paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.sm },
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.avatar, { backgroundColor: tokens.color.brand.soft }]}
      >
        <Icon name="store" size={tokens.icon.lg} color={tokens.color.brand.primary} />
      </View>
      <View style={styles.headerText}>
        <Text
          variant="sectionTitle"
          numberOfLines={1}
          accessibilityRole="header"
          testID="home-shop-name"
        >
          {shopName === undefined ? '' : (shopName ?? t('screens:home.shopFallback'))}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('screens:home.greeting')}
        </Text>
      </View>
      <Pressable
        testID="home-notifications"
        accessibilityRole="button"
        accessibilityLabel={t('screens:home.notifications')}
        onPress={() => navigation.push(ROUTES.notificationList)}
        style={{
          minWidth: touch,
          minHeight: touch,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="notifications" size={tokens.icon.lg} color={tokens.color.text.primary} />
      </Pressable>
    </View>
  );

  return (
    <Screen
      title={t('nav:titles.UI-B01')}
      header={header}
      inTabs
      testID="screen-UI-B01"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={{ gap: tokens.space.md }}>
        <HomeActionCard
          testID="home-pack-order"
          icon="package"
          emphasis="primary"
          title={t('screens:home.packOrder')}
          description={t('screens:home.packOrderHint')}
          onPress={() => navigation.push(ROUTES.scan)}
        />
        <HomeActionCard
          testID="home-receive-return"
          icon="returns"
          emphasis="secondary"
          title={t('screens:home.receiveReturn')}
          description={t('screens:home.receiveReturnHint')}
          onPress={() => navigation.push(ROUTES.returnFindOrder)}
        />
      </View>

      {needsAction > 0 ? (
        <View accessibilityLiveRegion="polite" testID="home-needs-action">
          <SyncStatusBar
            counts={{ error: needsAction, waiting_upload: 0, uploading: 0 }}
            onPress={() => navigation.push(ROUTES.sync, { filter: 'error' })}
          />
        </View>
      ) : null}

      <View style={{ gap: tokens.space.md }}>
        <View style={styles.sectionRow}>
          <Text variant="sectionTitle" accessibilityRole="header" style={styles.flex}>
            {t('screens:home.todayTitle')}
          </Text>
          <Pressable
            testID="home-today-detail"
            accessibilityRole="button"
            onPress={() => navigation.push(ROUTES.sync)}
            style={{ minHeight: touch, justifyContent: 'center' }}
          >
            <Text variant="caption" bold style={{ color: tokens.color.action.link }}>
              {t('screens:home.todayDetail')}
            </Text>
          </Pressable>
        </View>
        <View style={[stackStats ? styles.statColumn : styles.statRow, { gap: tokens.space.sm }]}>
          <StatTile
            testID="home-stat-packed"
            tone="success"
            icon="check-circle"
            value={statValue('packed')}
            loading={loadingStats}
            label={t('screens:home.stat.packed')}
            onPress={() => navigation.push(ROUTES.orders)}
          />
          <StatTile
            testID="home-stat-uploaded"
            tone="info"
            icon="cloud-up"
            value={statValue('uploaded')}
            loading={loadingStats}
            label={t('screens:home.stat.uploaded')}
            onPress={() => navigation.push(ROUTES.sync)}
          />
          <StatTile
            testID="home-stat-error"
            tone="danger"
            icon="alert"
            value={statValue('needsAction')}
            loading={loadingStats}
            label={t('screens:home.stat.error')}
            onPress={() => navigation.push(ROUTES.sync, { filter: 'error' })}
          />
        </View>
        {todayEmpty ? (
          <Text variant="caption" color="textMuted" testID="home-today-empty">
            {t('screens:home.todayEmpty')}
          </Text>
        ) : null}
        {stats.kind === 'error' ? (
          <View style={styles.errorRow}>
            <Text variant="caption" color="textMuted" testID="home-today-error" style={styles.flex}>
              {t('screens:home.todayLoadError')}
            </Text>
            <Pressable
              testID="home-today-retry"
              accessibilityRole="button"
              onPress={refresh}
              style={{ minHeight: touch, justifyContent: 'center' }}
            >
              <Text variant="caption" bold style={{ color: tokens.color.action.link }}>
                {t('common:actions.retry')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <ListGroup title={t('screens:home.shortcutsTitle')} testID="home-shortcuts">
        <ListItem
          testID="home-quick-order"
          leadingIcon="add-circle"
          title={t('screens:home.quick.quickOrder')}
          onPress={() => navigation.push(ROUTES.quickOrder)}
        />
        <ListItem
          testID="home-quick-orders"
          leadingIcon="orders"
          title={t('screens:home.quick.orders')}
          onPress={() => navigation.push(ROUTES.orders)}
        />
        <ListItem
          testID="home-returns-list"
          leadingIcon="returns"
          title={t('screens:home.returnsList')}
          onPress={() => navigation.push(ROUTES.returns)}
        />
        <ListItem
          testID="home-quick-evidence"
          leadingIcon="cloud-up"
          title={t('screens:home.quick.evidence')}
          onPress={() => navigation.push(ROUTES.sync)}
        />
      </ListGroup>

      {showNotice ? (
        <Card testID="home-device-notice">
          <View style={{ gap: tokens.space.sm }}>
            <View style={[styles.helpRow, { gap: tokens.space.md }]}>
              <Icon name="info" size={tokens.icon.lg} color={tokens.color.brand.primary} />
              <Text variant="cardTitle" accessibilityRole="header" style={styles.flex}>
                {t('screens:home.deviceNotice.title')}
              </Text>
            </View>
            <Text variant="caption" color="textMuted">
              {t('screens:home.deviceNotice.body')}
            </Text>
            <Button
              variant="secondary"
              size="slim"
              label={t('screens:home.deviceNotice.dismiss')}
              onPress={dismissNotice}
              testID="home-device-notice-dismiss"
            />
          </View>
        </Card>
      ) : null}

      <Card
        testID="home-tip-guide"
        flush
        onPress={() => navigation.push(ROUTES.help)}
        accessibilityLabel={`${t('screens:home.tipTitle')}. ${t('screens:home.tipHint')}`}
      >
        <View style={[styles.helpRow, { padding: tokens.space.lg, gap: tokens.space.md }]}>
          <Icon name="help" size={tokens.icon.lg} color={tokens.color.brand.primary} />
          <View style={styles.flex}>
            <Text variant="cardTitle">{t('screens:home.tipTitle')}</Text>
            <Text variant="caption" color="textMuted">
              {t('screens:home.tipHint')}
            </Text>
          </View>
          <Icon name="forward" size={tokens.icon.md} color={tokens.color.text.tertiary} />
        </View>
      </Card>
    </Screen>
  );
}

/**
 * Hành động trên Trang chủ. `primary` (Đóng gói đơn) là việc làm cả ngày: nền xanh đặc, chữ trắng,
 * duy nhất một thẻ. `secondary` (Nhận hàng hoàn): thẻ trắng viền mảnh, cùng bố cục để quét mắt nhanh.
 */
function HomeActionCard({
  icon,
  emphasis,
  title,
  description,
  onPress,
  testID,
}: {
  icon: IconName;
  emphasis: 'primary' | 'secondary';
  title: string;
  description: string;
  onPress: () => void;
  testID: string;
}) {
  const { tokens } = useTheme();
  const primary = emphasis === 'primary';
  const fg = primary ? tokens.color.text.onAction : tokens.color.text.primary;
  const fgMuted = primary ? tokens.color.text.onBrandMuted : tokens.color.text.secondary;
  return (
    <Card
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`${title}. ${description}`}
      style={{
        backgroundColor: primary ? tokens.color.action.primary : tokens.color.surface.raised,
        borderColor: primary ? tokens.color.action.primary : tokens.color.border.default,
        minHeight: layout.component.actionCard.minHeight,
        justifyContent: 'center',
      }}
    >
      <View style={[styles.actionRow, { gap: tokens.space.lg }]}>
        <View
          style={[
            styles.cardIcon,
            {
              borderRadius: tokens.radius.md,
              backgroundColor: primary
                ? tokens.color.action.primaryPressed
                : tokens.color.brand.soft,
            },
          ]}
        >
          <Icon
            name={icon}
            size={tokens.icon.xl}
            color={primary ? tokens.color.text.onAction : tokens.color.brand.primary}
          />
        </View>
        <View style={styles.flex}>
          <Text variant="sectionTitle" style={{ color: fg }}>
            {title}
          </Text>
          <Text variant="caption" style={{ color: fgMuted }}>
            {description}
          </Text>
        </View>
        <Icon name="forward" size={tokens.icon.lg} color={fg} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  helpRow: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: {
    width: layout.component.tile.lg,
    height: layout.component.tile.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: layout.space.md },
  avatar: {
    width: layout.component.tile.md,
    height: layout.component.tile.md,
    borderRadius: layout.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  statRow: { flexDirection: 'row' },
  statColumn: { flexDirection: 'column' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: layout.space.md },
});
