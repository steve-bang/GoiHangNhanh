import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getKeyboardAvoidingBehavior, useIsOffline } from '@/platform';

import { OfflineBanner } from './OfflineBanner';
import { ScreenHeader } from './ScreenHeader';
import { Text } from './Text';
import { useTheme } from './theme';

interface ScreenProps {
  title: string;
  onBack?: () => void;
  headerRight?: ReactNode;
  /** Thay thanh tiêu đề chuẩn bằng phần đầu riêng của màn (Trang chủ: avatar + lời chào + chuông). */
  header?: ReactNode;
  /** Nút chính ghim gần đáy; được đẩy lên khỏi bàn phím. */
  footer?: ReactNode;
  /** `false` cho màn cố định không cuộn (ví dụ màn camera). Mặc định cuộn được. */
  scroll?: boolean;
  /** Màn nằm trong thanh tab: thanh tab đã lo vùng an toàn đáy nên không cộng thêm. */
  inTabs?: boolean;
  /** Nội dung dùng dữ liệu giả cục bộ của khung giao diện: hiện ghi chú "minh họa". */
  illustrative?: boolean;
  /**
   * Nhóm màn "form/quy trình" (Tạo đơn nhanh, Xác nhận đơn; mockup 03): nền trắng sạch và tiêu đề
   * header nhỏ hơn. Không đổi nền toàn app.
   */
  form?: boolean;
  children: ReactNode;
  testID?: string;
}

/**
 * Khung mọi màn hình: vùng an toàn (tràn viền Android), tiêu đề, banner ngoại tuyến, nội dung cuộn
 * được, nút chính ghim đáy, tránh bàn phím. Mọi màn dùng component này để bố cục nhất quán giữa iOS
 * và Android; khác biệt nền tảng nằm ở `@/platform`.
 */
export function Screen({
  title,
  onBack,
  headerRight,
  header,
  footer,
  scroll = true,
  inTabs = false,
  illustrative = false,
  form = false,
  children,
  testID,
}: ScreenProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();

  const content = (
    <>
      {children}
      {illustrative ? (
        <Text variant="caption" color="textMuted">
          {t('common:illustrative')}
        </Text>
      ) : null}
    </>
  );
  const background = form ? colors.formBackground : colors.background;
  const contentStyle = { padding: spacing.lg, gap: spacing.lg } as const;

  return (
    <View
      testID={testID}
      style={[styles.root, { backgroundColor: background, paddingTop: insets.top }]}
    >
      {header ?? (
        <ScreenHeader
          title={title}
          compact={form}
          {...(onBack ? { onBack } : {})}
          {...(headerRight ? { trailing: headerRight } : {})}
        />
      )}
      <OfflineBanner visible={offline} />
      <KeyboardAvoidingView style={styles.flex} behavior={getKeyboardAvoidingBehavior()}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={contentStyle}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {content}
          </ScrollView>
        ) : (
          <View style={[styles.flex, contentStyle]}>{content}</View>
        )}
        {footer ? (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: inTabs ? spacing.lg : Math.max(insets.bottom, spacing.lg),
              gap: spacing.sm,
              backgroundColor: background,
              borderTopColor: colors.border,
              borderTopWidth: StyleSheet.hairlineWidth,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 }, flex: { flex: 1 } });
