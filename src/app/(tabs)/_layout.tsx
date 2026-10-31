import { Tabs, usePathname, useRouter } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScanTabButton } from '@/bootstrap/navigation/ScanTabButton';
import { TAB_CONFIG } from '@/bootstrap/navigation/tab-config';
import { isTabBarHiddenAt } from '@/core/navigation';
import { SessionGate } from '@/features/personal';
import { Icon, Text, useTheme } from '@/shared/ui';

/** Nhãn tab phóng tối đa 1,3 lần khi bật chữ lớn để thanh tab không vỡ bố cục; nội dung vẫn co giãn hết. */
const TAB_LABEL_MAX_FONT_SCALE = 1.3;
/**
 * Màn hẹp (dưới 360 pt, ví dụ 320 pt): năm ô tab chỉ còn ~64 pt mỗi ô (chữ ~54 pt) nên nhãn caption 12 xuống
 * dòng rồi bị cắt ("Trang chủ" -> "Trang"). Ở màn hẹp nhãn dùng cỡ caption x 0,85 (~10 pt, ngang nhãn tab
 * chuẩn của iOS) và luôn một dòng; iOS/Android còn tự thu nhỏ thêm tới 80% khi chữ lớn
 * (`adjustsFontSizeToFit`), web chỉ hiện dấu "…" (V1-18). Màn rộng giữ nguyên như trước: `numberOfLines`
 * làm web cắt phần chữ tràn xuống dưới ô tab nên chỉ bật ở màn hẹp (dòng thấp hơn, đã chụp kiểm tra).
 */
const NARROW_TAB_BAR_BELOW = 360;
const NARROW_TAB_LABEL_SCALE = 0.85;
const TAB_LABEL_MIN_FONT_SCALE = 0.8;

/**
 * Nhóm có thanh tab dưới. Danh sách tab đọc từ `TAB_CONFIG` (một nơi duy nhất). Mỗi tab là một thư
 * mục có Stack riêng nên thanh tab vẫn hiện khi đi sâu trong tab. Tab `action` (Quét, nút nổi giữa)
 * không chuyển tab: bấm là mở màn quét; màn quét ẩn thanh tab. Cổng phiên (V1-06): ở bản Firebase chỉ
 * hiện các tab khi đã đăng nhập và biết cửa hàng thật.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { tokens, typography } = useTheme();
  const { width } = useWindowDimensions();
  const narrowLabel =
    width < NARROW_TAB_BAR_BELOW
      ? {
          fontSize: typography.caption.fontSize * NARROW_TAB_LABEL_SCALE,
          lineHeight: typography.caption.lineHeight * NARROW_TAB_LABEL_SCALE,
        }
      : null;
  const router = useRouter();
  const pathname = usePathname();
  const hideBar = isTabBarHiddenAt(pathname);
  return (
    <SessionGate>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: tokens.color.action.primary,
          tabBarInactiveTintColor: tokens.color.text.secondary,
          tabBarStyle: {
            backgroundColor: tokens.color.surface.raised,
            borderTopColor: tokens.color.border.default,
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
                    {...(narrowLabel
                      ? {
                          numberOfLines: 1,
                          adjustsFontSizeToFit: true,
                          minimumFontScale: TAB_LABEL_MIN_FONT_SCALE,
                        }
                      : {})}
                    maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
                    style={[
                      narrowLabel,
                      {
                        color: focused ? tokens.color.action.primary : tokens.color.text.secondary,
                      },
                    ]}
                  >
                    {t(tab.labelKey)}
                  </Text>
                ),
                tabBarIcon: ({ focused, size }) => (
                  <Icon
                    name={tab.icon}
                    size={size}
                    color={focused ? tokens.color.action.primary : tokens.color.text.secondary}
                  />
                ),
              }}
            />
          ),
        )}
      </Tabs>
    </SessionGate>
  );
}
