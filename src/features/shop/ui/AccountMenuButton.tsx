import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES, type RouteDef } from '@/core/navigation';
import { useAppNavigation, getMinTouchTarget } from '@/platform';
import { BottomSheet, Icon, Text, useTheme } from '@/shared/ui';

interface MenuItem {
  route: RouteDef;
  labelKey: `nav:account.${string}`;
}

/**
 * Hồ sơ, cài đặt, gói, trợ giúp nằm trong menu tài khoản ở góc trên, KHÔNG chiếm tab
 * (docs/09 mục 2). Tranh chấp không có ở đây: đi vào từ hồ sơ đơn/hàng hoàn (O-14).
 */
const MENU_ITEMS: readonly MenuItem[] = [
  { route: ROUTES.profile, labelKey: 'nav:account.profile' },
  { route: ROUTES.shopSettings, labelKey: 'nav:account.shopSettings' },
  { route: ROUTES.members, labelKey: 'nav:account.members' },
  { route: ROUTES.notifications, labelKey: 'nav:account.notifications' },
  { route: ROUTES.security, labelKey: 'nav:account.security' },
  { route: ROUTES.plan, labelKey: 'nav:account.plan' },
  { route: ROUTES.help, labelKey: 'nav:account.help' },
];

export function AccountMenuButton() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useAppNavigation();
  const [open, setOpen] = useState(false);
  const touch = getMinTouchTarget();

  return (
    <>
      <Pressable
        testID="account-menu-button"
        accessibilityRole="button"
        accessibilityLabel={t('nav:account.button')}
        onPress={() => setOpen(true)}
        style={[styles.button, { minWidth: touch, minHeight: touch }]}
      >
        <Icon name="user" size={30} color={colors.brand} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('nav:account.title')}>
        <View>
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.route.code}
              accessibilityRole="button"
              onPress={() => {
                setOpen(false);
                navigation.push(item.route);
              }}
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
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemLabel: { flex: 1 },
});
