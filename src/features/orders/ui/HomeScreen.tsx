import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import {
  ILLUSTRATIVE_SHOP_NAME,
  ILLUSTRATIVE_TODAY_STATS,
} from '@/shared/fixtures/illustrative-data';
import {
  Card,
  Icon,
  type IconName,
  QuickAction,
  Screen,
  StatTile,
  Text,
  useTheme,
} from '@/shared/ui';
import { layout } from '@/core/theme';

/**
 * UI-B01 Trang chủ (đặc tả A01; mockup docs/assets/ui/02-home-and-scan.png, D-16; làm gọn theo
 * design system v2). Thứ tự: đầu trang (tên shop, lời chào, chuông), MỘT hành động chính *Đóng gói
 * đơn* và một hành động phụ *Nhận hàng hoàn*, 3 lối tắt, thống kê hôm nay, một hàng trợ giúp. Không
 * còn banner/thẻ gradient trang trí; lối tắt Quét bỏ vì trùng nút Quét giữa thanh tab. Chữ đã sửa so với mẫu (docs/09 mục 5.5): không hứa quá
 * mức, nhãn thống kê dùng nhãn trạng thái chuẩn. KHÔNG biểu đồ doanh thu. Hàng hoàn và Đồng bộ
 * không còn là tab: vào từ đây. "Đơn gần đây"/"Việc cần xử lý" của docs/09 chưa có trên mẫu (Q-16).
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const touch = getMinTouchTarget();

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
        <Icon name="store" size={26} color={tokens.color.action.primary} />
      </View>
      <View style={styles.headerText}>
        <Text variant="sectionTitle" numberOfLines={1}>
          {ILLUSTRATIVE_SHOP_NAME}
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
        <Icon name="notifications" size={26} color={tokens.color.text.primary} />
      </Pressable>
    </View>
  );

  return (
    <Screen
      title={t('nav:titles.UI-B01')}
      header={header}
      inTabs
      illustrative
      testID="screen-UI-B01"
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
        <Pressable
          testID="home-returns-list"
          accessibilityRole="button"
          onPress={() => navigation.push(ROUTES.returns)}
          style={{ minHeight: touch, justifyContent: 'center', alignSelf: 'flex-end' }}
        >
          <Text variant="caption" bold style={{ color: tokens.color.action.primary }}>
            {t('screens:home.returnsList')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.quickRow}>
        <QuickAction
          testID="home-quick-order"
          icon="add-circle"
          label={t('screens:home.quick.quickOrder')}
          onPress={() => navigation.push(ROUTES.quickOrder)}
        />
        <QuickAction
          testID="home-quick-orders"
          icon="orders"
          label={t('screens:home.quick.orders')}
          onPress={() => navigation.push(ROUTES.orders)}
        />
        <QuickAction
          testID="home-quick-evidence"
          icon="cloud-up"
          label={t('screens:home.quick.evidence')}
          onPress={() => navigation.push(ROUTES.sync)}
        />
      </View>

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
            <Text variant="caption" bold style={{ color: tokens.color.action.primary }}>
              {t('screens:home.todayDetail')}
            </Text>
          </Pressable>
        </View>
        <View style={[styles.statRow, { gap: tokens.space.sm }]}>
          <StatTile
            testID="home-stat-packed"
            tone="success"
            icon="check-circle"
            value={ILLUSTRATIVE_TODAY_STATS.packed}
            label={t('screens:home.stat.packed')}
            onPress={() => navigation.push(ROUTES.orders)}
          />
          <StatTile
            testID="home-stat-uploaded"
            tone="brand"
            icon="cloud-up"
            value={ILLUSTRATIVE_TODAY_STATS.uploaded}
            label={t('screens:home.stat.uploaded')}
            onPress={() => navigation.push(ROUTES.sync)}
          />
          <StatTile
            testID="home-stat-error"
            tone="danger"
            icon="alert"
            value={ILLUSTRATIVE_TODAY_STATS.error}
            label={t('screens:home.stat.error')}
            onPress={() => navigation.push(ROUTES.sync)}
          />
        </View>
      </View>

      <Card
        testID="home-tip-guide"
        flush
        onPress={() => navigation.push(ROUTES.help)}
        accessibilityLabel={`${t('screens:home.tipTitle')}. ${t('screens:home.tipHint')}`}
      >
        <View style={[styles.helpRow, { padding: tokens.space.lg, gap: tokens.space.md }]}>
          <Icon name="help" size={tokens.icon.lg} color={tokens.color.action.primary} />
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
              backgroundColor: primary ? tokens.color.brand.deep : tokens.color.brand.soft,
            },
          ]}
        >
          <Icon
            name={icon}
            size={tokens.icon.xl}
            color={primary ? tokens.color.text.onAction : tokens.color.action.primary}
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
  quickRow: { flexDirection: 'row', gap: layout.space.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  statRow: { flexDirection: 'row' },
});
