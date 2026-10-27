import { Tabs, usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ScanTabButton } from '@/bootstrap/navigation/ScanTabButton';
import { TAB_CONFIG } from '@/bootstrap/navigation/tab-config';
import { isTabBarHiddenAt } from '@/core/navigation';
import { Icon, Text, useTheme } from '@/shared/ui';

/** Nhãn tab phóng tối đa 1,3 lần khi bật chữ lớn để thanh tab không vỡ bố cục; nội dung vẫn co giãn hết. */
const TAB_LABEL_MAX_FONT_SCALE = 1.3;

/**
 * Nhóm có thanh tab dưới. Danh sách tab đọc từ `TAB_CONFIG` (một nơi duy nhất). Mỗi tab là một thư
 * mục có Stack riêng nên thanh tab vẫn hiện khi đi sâu trong tab. Tab `action` (Quét, nút nổi giữa)
 * không chuyển tab: bấm là mở màn quét; màn quét ẩn thanh tab.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const hideBar = isTabBarHiddenAt(pathname);
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          display: hideBar ? 'none' : 'flex',
        },
      }}
    >
      {TAB_CONFIG.map((tab) =>
        'action' in tab ? (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            listeners={{
              tabPress: (event) => {
                event.preventDefault();
                router.push(tab.route.path);
              },
            }}
            options={{
              title: t(tab.labelKey),
              tabBarAccessibilityLabel: t(tab.labelKey),
              tabBarButton: (props) => (
                <ScanTabButton label={t(tab.labelKey)} onPress={props.onPress} />
              ),
            }}
          />
        ) : (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: t(tab.labelKey),
              tabBarAccessibilityLabel: t(tab.labelKey),
              tabBarLabel: ({ focused }) => (
                <Text
                  variant="caption"
                  maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
                  style={{ color: focused ? colors.brand : colors.textMuted }}
                >
                  {t(tab.labelKey)}
                </Text>
              ),
              tabBarIcon: ({ focused, size }) => (
                <Icon
                  name={tab.icon}
                  size={size}
                  color={focused ? colors.brand : colors.textMuted}
                />
              ),
            }}
          />
        ),
      )}
    </Tabs>
  );
}
