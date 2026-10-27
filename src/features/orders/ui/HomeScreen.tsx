import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import {
  ILLUSTRATIVE_SHOP_NAME,
  ILLUSTRATIVE_TODAY_STATS,
} from '@/shared/fixtures/illustrative-data';
import {
  Button,
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

import { GradientPanel, ParcelIllustration } from './HomeBanner';

/**
 * UI-B01 Trang chủ (đặc tả A01; mockup docs/assets/ui/02-home-and-scan.png, D-16). Thứ tự theo mẫu:
 * đầu trang (tên shop, lời chào, chuông), banner, hai nút lớn *Đóng gói đơn* / *Nhận hàng hoàn*,
 * 4 lối tắt, thống kê hôm nay, thẻ hướng dẫn. Chữ đã sửa so với mẫu (docs/09 mục 5.5): không hứa quá
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
      <Pressable
        testID="home-banner"
        accessibilityRole="button"
        accessibilityLabel={`${t('screens:home.bannerTitle')}. ${t('screens:home.bannerHint')}`}
        onPress={() => navigation.push(ROUTES.help)}
      >
        <GradientPanel
          from={tokens.color.action.primary}
          to={tokens.color.brand.deep}
          radius={tokens.radius.lg}
        >
          <View style={[styles.banner, { padding: tokens.space.lg, gap: tokens.space.md }]}>
            <ParcelIllustration />
            <View style={styles.bannerText}>
              <Text bold style={{ color: tokens.color.text.onAction }}>
                {t('screens:home.bannerTitle')}
              </Text>
              <Text variant="caption" style={{ color: tokens.color.text.onAction }}>
                {t('screens:home.bannerHint')}
              </Text>
            </View>
            <Icon name="forward" size={22} color={tokens.color.text.onAction} />
          </View>
        </GradientPanel>
      </Pressable>

      <View style={[styles.cardRow, { gap: tokens.space.md }]}>
        <HomeActionCard
          testID="home-pack-order"
          icon="package"
          tone="success"
          title={t('screens:home.packOrder')}
          description={t('screens:home.packOrderHint')}
          onPress={() => navigation.push(ROUTES.scan)}
        />
        <HomeActionCard
          testID="home-receive-return"
          icon="returns"
          tone="brand"
          title={t('screens:home.receiveReturn')}
          description={t('screens:home.receiveReturnHint')}
          onPress={() => navigation.push(ROUTES.returnFindOrder)}
        />
      </View>

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

      <View style={styles.quickRow}>
        <QuickAction
          testID="home-quick-scan"
          icon="scan"
          label={t('screens:home.quick.scan')}
          onPress={() => navigation.push(ROUTES.scan)}
        />
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

      <GradientPanel
        from={tokens.color.brand.deep}
        to={tokens.color.action.primary}
        radius={tokens.radius.lg}
      >
        <View style={[styles.tip, { padding: tokens.space.lg, gap: tokens.space.sm }]}>
          <Text bold style={{ color: tokens.color.text.onAction }}>
            {t('screens:home.tipTitle')}
          </Text>
          <Text variant="caption" style={{ color: tokens.color.text.onAction }}>
            {t('screens:home.tipHint')}
          </Text>
          <View style={styles.tipAction}>
            <Button
              testID="home-tip-guide"
              variant="secondary"
              label={t('screens:home.tipAction')}
              onPress={() => navigation.push(ROUTES.help)}
            />
          </View>
        </View>
      </GradientPanel>
    </Screen>
  );
}

/** Thẻ lớn nửa chiều ngang (hai tác vụ chính, đặt cạnh nhau như mẫu): ô biểu tượng, tên, mô tả. */
function HomeActionCard({
  icon,
  tone,
  title,
  description,
  onPress,
  testID,
}: {
  icon: IconName;
  tone: 'success' | 'brand';
  title: string;
  description: string;
  onPress: () => void;
  testID: string;
}) {
  const { tokens } = useTheme();
  return (
    <Card
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`${title}. ${description}`}
      style={styles.flex}
    >
      <View style={{ gap: tokens.space.sm }}>
        <View
          style={[
            styles.cardIcon,
            {
              borderRadius: tokens.radius.md,
              backgroundColor:
                tone === 'success' ? tokens.color.action.primary : tokens.color.text.strong,
            },
          ]}
        >
          <Icon name={icon} size={26} color={tokens.color.text.onAction} />
        </View>
        <Text
          bold
          style={{
            color: tone === 'success' ? tokens.color.action.primary : tokens.color.text.strong,
          }}
        >
          {title}
        </Text>
        <Text variant="caption" color="textMuted">
          {description}
        </Text>
        <View style={styles.cardForward}>
          <Icon name="forward" size={20} color={tokens.color.text.secondary} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardRow: { flexDirection: 'row', alignItems: 'stretch' },
  cardIcon: {
    width: layout.component.tile.lg,
    height: layout.component.tile.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardForward: { alignSelf: 'flex-end' },
  header: { flexDirection: 'row', alignItems: 'center', gap: layout.space.md },
  avatar: {
    width: layout.component.tile.md,
    height: layout.component.tile.md,
    borderRadius: layout.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center' },
  bannerText: { flex: 1, gap: layout.space.xs },
  quickRow: { flexDirection: 'row', gap: layout.space.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  statRow: { flexDirection: 'row' },
  tip: { alignItems: 'flex-start' },
  tipAction: { alignSelf: 'stretch' },
});
