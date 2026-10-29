import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';
import { BottomSheet, Button, Icon, Text, useTheme } from '@/shared/ui';

import type { MissingVideoReason } from '../domain';

/**
 * Hỏi LÝ DO khi hồ sơ chưa có video mở kiện (video là bằng chứng chính, không chặn cứng nhưng không bỏ
 * qua âm thầm). Dùng chung cho màn xem trước (chưa ghi được video) và màn quay thật (lưu lỗi/không quay được).
 */
export function SkipReasonSheet({
  visible,
  onClose,
  options,
  reason,
  onSelect,
  busy,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  options: readonly MissingVideoReason[];
  reason: MissingVideoReason;
  onSelect: (reason: MissingVideoReason) => void;
  busy: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('returns:record.skipTitle')}>
      <View testID="return-skip-sheet" style={{ gap: tokens.space.md }}>
        <Text variant="formBody">{t('returns:record.skipMessage')}</Text>
        <Text variant="formButton" accessibilityRole="header">
          {t('returns:record.skipReasonLabel')}
        </Text>
        <View accessibilityRole="radiogroup" style={{ gap: tokens.space.xs }}>
          {options.map((option) => {
            const selected = option === reason;
            return (
              <Pressable
                key={option}
                testID={`return-skip-reason-${option}`}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                onPress={() => onSelect(option)}
                style={{
                  minHeight: getMinTouchTarget(),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: tokens.space.md,
                  paddingHorizontal: tokens.space.md,
                  borderRadius: tokens.radius.md,
                  borderWidth: selected ? tokens.borderWidth.emphasis : tokens.borderWidth.thin,
                  borderColor: selected ? tokens.color.brand.primary : tokens.color.border.default,
                  backgroundColor: selected ? tokens.color.brand.soft : tokens.color.surface.raised,
                }}
              >
                <Icon
                  name={selected ? 'check-circle' : 'forward'}
                  size={tokens.icon.lg}
                  color={selected ? tokens.color.brand.primary : tokens.color.text.tertiary}
                />
                <Text variant="formBody" style={{ flex: 1, flexShrink: 1 }}>
                  {t(`returns:record.skipReasons.${option}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Button
          testID="return-skip-confirm"
          label={t('returns:record.skipConfirm')}
          loading={busy}
          disabled={busy}
          onPress={onConfirm}
        />
      </View>
    </BottomSheet>
  );
}
