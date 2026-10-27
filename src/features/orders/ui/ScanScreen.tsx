import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { Button, Icon, Screen, Text, TextField, useTheme } from '@/shared/ui';

/**
 * UI-B02 Trung tâm quét mã (đặc tả A02). KHUNG: vùng quét là placeholder, chưa dùng camera.
 * Quét xong sẽ tự tra cứu (không có nút "Tìm" cho đường quét); nút "Tra cứu mã" chỉ dành cho
 * nhập tay. Tra cứu thật (mã không thấy / nhiều kết quả -> UI-J01/J02) thuộc tính năng orders.
 * Đang đi thẳng sang tạo đơn nhanh (UI-B04) vì mã chưa có hồ sơ; chưa có nhánh "đã có hồ sơ".
 */
export function ScanScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const navigation = useAppNavigation();
  const [code, setCode] = useState('');
  const trimmed = code.trim();

  return (
    <Screen
      title={t('nav:titles.UI-B02')}
      onBack={navigation.back}
      inTabs
      testID="screen-UI-B02"
      footer={
        <Button
          label={t('screens:scan.lookup')}
          disabled={trimmed.length === 0}
          onPress={() => navigation.push(ROUTES.quickOrder, { code: trimmed })}
        />
      }
    >
      <View
        style={[
          styles.camera,
          {
            backgroundColor: colors.cameraBackground,
            borderRadius: radius.lg,
            padding: spacing.xl,
          },
        ]}
      >
        <Icon name="scan" size={56} color={colors.onCamera} />
        <Text style={[styles.cameraText, { color: colors.onCamera }]}>
          {t('screens:scan.cameraPlaceholder')}
        </Text>
      </View>
      <Text color="textMuted">{t('screens:scan.instruction')}</Text>

      <View style={{ gap: spacing.sm }}>
        <Button
          variant="secondary"
          icon="flashlight"
          label={t('screens:scan.flashlight')}
          disabled
          onPress={() => undefined}
        />
        <Button
          variant="secondary"
          icon="search"
          label={t('screens:scan.savedOrders')}
          onPress={() => navigation.push(ROUTES.search)}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t('screens:scan.manualTitle')}
        </Text>
        <TextField
          testID="scan-manual-code"
          label={t('screens:scan.manualLabel')}
          placeholder={t('screens:scan.manualPlaceholder')}
          value={code}
          onChangeText={setCode}
          returnKeyType="search"
          autoCapitalize="characters"
          onSubmitEditing={() => {
            if (trimmed.length > 0) navigation.push(ROUTES.quickOrder, { code: trimmed });
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 },
  cameraText: { textAlign: 'center' },
});
