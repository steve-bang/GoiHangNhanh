import {
  createContext,
  type ComponentRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '@/core/theme';
import { getKeyboardAvoidingBehavior, getMinTouchTarget } from '@/platform';
import { AppThemeScope, Icon, Text, useTheme } from '@/shared/ui';

import { BACK_ROW_HEIGHT } from '../onboarding-layout';

/** Khoảng trống giữ phía trên ô đang nhập khi cuộn tới nó (dp). */
const SCROLL_MARGIN_TOP = 96;

interface ScaffoldContextValue {
  /** Cuộn để phần tử (nằm trong nội dung cuộn) hiện trên bàn phím. */
  scrollIntoView: (target: RefObject<ComponentRef<typeof View> | null>) => void;
}

const ScaffoldContext = createContext<ScaffoldContextValue>({ scrollIntoView: () => undefined });

/** Dùng trong ô nhập: gọi khi ô nhận focus để cuộn tới nó (bàn phím không che ô đang nhập). */
export function useScrollIntoView(): ScaffoldContextValue['scrollIntoView'] {
  return useContext(ScaffoldContext).scrollIntoView;
}

interface OnboardingScaffoldProps {
  testID: string;
  padX: number;
  bottomPad: number;
  /** Có thì hiện nút quay lại ở góc trên trái. */
  onBack?: () => void;
  /** Tiêu đề nhỏ cạnh nút quay lại (màn Quên mật khẩu, Nhập mã, Mật khẩu mới). */
  headerTitle?: string;
  children: ReactNode;
}

/**
 * Khung chung ba màn thiết lập: nền, vùng an toàn, nút quay lại (tùy chọn), nội dung cuộn được và
 * tránh bàn phím. Không dùng `Screen` vì mockup không có thanh tiêu đề; bọc `AppThemeScope` để
 * `Button`/`Text`/`Icon` bên trong dùng bảng Bright Orange như màn trong app (D-20). Nội dung luôn
 * nằm trong ScrollView (`flexGrow: 1`) nên chữ lớn hay màn thấp thì cuộn, không vỡ bố cục.
 */
export function OnboardingScaffold({
  testID,
  padX,
  bottomPad,
  onBack,
  headerTitle,
  children,
}: OnboardingScaffoldProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const contentRef = useRef<ComponentRef<typeof View>>(null);

  const scrollIntoView = useCallback((target: RefObject<ComponentRef<typeof View> | null>) => {
    // Chờ bàn phím mở xong mới đo; lỗi đo (ví dụ ô đã gỡ) thì bỏ qua.
    setTimeout(() => {
      const node = target.current;
      const content = contentRef.current;
      if (!node || !content) return;
      try {
        node.measureLayout(content, (_x, y) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - SCROLL_MARGIN_TOP), animated: true });
        });
      } catch {
        // không đo được: giữ nguyên vị trí cuộn
      }
    }, 250);
  }, []);
  const value = useMemo(() => ({ scrollIntoView }), [scrollIntoView]);
  const touch = getMinTouchTarget();
  // Đốm nền trang trí ở góc dưới, tỉ lệ theo bề rộng cửa sổ (thiết kế gốc 520 trên màn rộng 390).
  const blob = width * 1.33;

  return (
    <AppThemeScope>
      <View testID={testID} style={[styles.root, { backgroundColor: tokens.color.surface.screen }]}>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
        >
          <View
            style={[
              styles.blob,
              {
                width: blob,
                height: blob,
                bottom: -blob * 0.63,
                left: -blob * 0.12,
                backgroundColor: tokens.color.brand.soft,
              },
            ]}
          />
        </View>
        <ScaffoldContext.Provider value={value}>
          <KeyboardAvoidingView style={styles.flex} behavior={getKeyboardAvoidingBehavior()}>
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                flexGrow: 1,
                paddingTop: insets.top,
                paddingBottom: bottomPad,
                paddingHorizontal: padX,
              }}
            >
              <View ref={contentRef} collapsable={false} style={styles.content}>
                {onBack || headerTitle ? (
                  <View style={styles.headerRow}>
                    {onBack ? (
                      <Pressable
                        testID="onboarding-back"
                        accessibilityRole="button"
                        accessibilityLabel={t('common:actions.back')}
                        onPress={onBack}
                        hitSlop={tokens.space.sm}
                        style={[
                          styles.back,
                          {
                            minWidth: touch,
                            height: BACK_ROW_HEIGHT,
                            marginLeft: -tokens.space.md,
                          },
                        ]}
                      >
                        <Icon
                          name="arrow-back"
                          size={tokens.icon.lg}
                          color={tokens.color.text.strong}
                        />
                      </Pressable>
                    ) : null}
                    {headerTitle ? (
                      <Text
                        variant="sectionTitle"
                        accessibilityRole="header"
                        bold
                        style={{ color: tokens.color.text.strong }}
                      >
                        {headerTitle}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {children}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </ScaffoldContext.Provider>
      </View>
    </AppThemeScope>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: layout.space.xs },
  back: { justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start' },
  blob: { position: 'absolute', borderRadius: layout.radius.full },
});
