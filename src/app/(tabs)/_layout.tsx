import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TAB_CONFIG } from '@/bootstrap/navigation/tab-config';
import { Icon, Text, useTheme } from '@/shared/ui';

/** Nhãn tab phóng tối đa 1,3 lần khi bật chữ lớn để thanh tab không vỡ bố cục; nội dung vẫn co giãn hết. */
const TAB_LABEL_MAX_FONT_SCALE = 1.3;

/**
 * Nhóm có thanh tab dưới. Danh sách tab đọc từ `TAB_CONFIG` (một nơi duy nhất; O-18 chưa chốt).
 * Mỗi tab là một thư mục có Stack riêng nên thanh tab vẫn hiện khi đi sâu trong tab.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.labelKey),
            tabBarAccessibilityLabel: t(tab.labelKey),
            tabBarLabel: ({ focused }) => (
              <Text
                variant="caption"
                bold
                maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
                style={{ color: focused ? colors.brand : colors.textMuted }}
              >
                {t(tab.labelKey)}
              </Text>
            ),
            tabBarIcon: ({ focused, size }) => (
              <Icon name={tab.icon} size={size} color={focused ? colors.brand : colors.textMuted} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
