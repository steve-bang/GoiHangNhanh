import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES, type RouteDef } from '@/core/navigation';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import { ILLUSTRATIVE_SHOP_NAME } from '@/shared/fixtures/illustrative-data';
import { Card, Icon, Screen, Text, useTheme } from '@/shared/ui';

interface MenuItem {
  route: RouteDef;
  labelKey: `nav:account.${string}`;
}

/**
 * Hồ sơ, cài đặt, gói, trợ giúp: các mục của tab Cá nhân (mẫu thiết kế, D-16). Tranh chấp không có
 * ở đây: đi vào từ hồ sơ đơn/hàng hoàn (O-14).
 */
const MENU_ITEMS: readonly MenuItem[] = [
  { route: ROUTES.shopSettings, labelKey: 'nav:account.shopSettings' },
  { route: ROUTES.members, labelKey: 'nav:account.members' },
  { route: ROUTES.notifications, labelKey: 'nav:account.notifications' },
  { route: ROUTES.security, labelKey: 'nav:account.security' },
  { route: ROUTES.plan, labelKey: 'nav:account.plan' },
  { route: ROUTES.help, labelKey: 'nav:account.help' },
];

/** UI-I01 Hồ sơ tài khoản (tab Cá nhân): tên shop và danh sách mục cài đặt. */
export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const navigation = useAppNavigation();
  const touch = getMinTouchTarget();

  return (
    <Screen title={t('nav:titles.UI-I01')} inTabs illustrative testID="screen-UI-I01">
      <Card>
        <View style={styles.header}>
          <Icon name="store" size={32} color={colors.brand} />
          <Text variant="sectionTitle">{ILLUSTRATIVE_SHOP_NAME}</Text>
        </View>
      </Card>
      <View style={{ gap: spacing.sm }}>
        {MENU_ITEMS.map((item) => (
          <Pressable
            key={item.route.code}
            accessibilityRole="button"
            onPress={() => navigation.push(item.route)}
            style={[
              styles.item,
              { minHeight: Math.max(touch, 52), borderBottomColor: colors.border },
            ]}
          >
            <Text style={styles.itemLabel}>{t(item.labelKey)}</Text>
            <Icon name="forward" color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemLabel: { flex: 1 },
});
