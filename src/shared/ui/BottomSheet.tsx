import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from './theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Bottom sheet cho lựa chọn ngắn (docs/09 mục 3); tác vụ phức tạp dùng trang riêng. Có nút Đóng rõ
 * ràng (không chỉ chạm nền), nút Back của Android đóng sheet, nội dung cuộn được khi chữ lớn.
 */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: tokens.color.overlay.scrim }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common:actions.close')}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: tokens.color.surface.raised,
              borderTopLeftRadius: tokens.radius.lg,
              borderTopRightRadius: tokens.radius.lg,
              padding: tokens.space.lg,
              paddingBottom: Math.max(insets.bottom, tokens.space.lg),
              gap: tokens.space.md,
            },
          ]}
        >
          <Text variant="sectionTitle" accessibilityRole="header">
            {title}
          </Text>
          <ScrollView bounces={false}>{children}</ScrollView>
          <Button label={t('common:actions.close')} onPress={onClose} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1 },
  sheet: { maxHeight: '85%' },
});
