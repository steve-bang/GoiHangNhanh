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
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getKeyboardAvoidingBehavior, getMinTouchTarget } from '@/platform';
import { Icon, useTheme } from '@/shared/ui';

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
  children: ReactNode;
}

/**
 * Khung chung ba màn thiết lập: nền, vùng an toàn, nút quay lại (tùy chọn), nội dung cuộn được và
 * tránh bàn phím. Không dùng `Screen` vì mockup không có thanh tiêu đề. Nội dung luôn nằm trong
 * ScrollView (`flexGrow: 1`) nên chữ lớn hay màn thấp thì cuộn, không vỡ bố cục.
 */
export function OnboardingScaffold({
  testID,
  padX,
  bottomPad,
  onBack,
  children,
}: OnboardingScaffoldProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
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

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: colors.onboardingBackground }]}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <View style={[styles.blob, { backgroundColor: colors.welcomeBlob }]} />
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
              {onBack ? (
                <Pressable
                  testID="onboarding-back"
                  accessibilityRole="button"
                  accessibilityLabel={t('common:actions.back')}
                  onPress={onBack}
                  hitSlop={8}
                  style={[
                    styles.back,
                    { minWidth: touch, height: BACK_ROW_HEIGHT, marginLeft: -12 },
                  ]}
                >
                  <Icon name="arrow-back" size={26} color={colors.ink} />
                </Pressable>
              ) : null}
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ScaffoldContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  back: { justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start' },
  blob: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 260,
    bottom: -330,
    left: -60,
    opacity: 0.6,
  },
});
