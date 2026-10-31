import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ROUTES } from '@/core/navigation';
import { layout } from '@/core/theme';
import { useAppNavigation, useConfirmBeforeLeave } from '@/platform';
import { Button, Icon, IconTile, Text, useTheme, type IconName } from '@/shared/ui';

import { normalizeShopName } from '../domain/validation';
import {
  LINK_ROW_HEIGHT,
  SUMMARY_ROW_MIN_HEIGHT,
  computeSetupDoneLayout,
} from './onboarding-layout';
import { SetupDoneIllustration } from './onboarding/OnboardingIllustrations';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { OnboardingScaffold } from './onboarding/OnboardingScaffold';

function SummaryRow({
  icon,
  label,
  value,
  onPress,
  last,
  testID,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
  last: boolean;
  testID: string;
}) {
  const { tokens } = useTheme();
  const { color } = tokens;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: SUMMARY_ROW_MIN_HEIGHT,
          gap: tokens.space.md,
          opacity: pressed ? tokens.opacity.pressed : 1,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: color.border.subtle,
        },
      ]}
    >
      <IconTile icon={icon} size="md" />
      <View style={styles.rowText}>
        <Text variant="caption" style={{ color: color.text.subtle }}>
          {label}
        </Text>
        <Text bold numberOfLines={2} style={{ color: color.text.strong }}>
          {value}
        </Text>
      </View>
      <Icon name="forward" size={tokens.icon.md} color={color.text.subtle} />
    </Pressable>
  );
}

/**
 * UI-A06 Hoàn tất thiết lập (docs/09 mục 4; mockup 01-onboarding, màn thứ tư). Thẻ tóm tắt có hai
 * hàng (Shop, Nguồn bán); KHÔNG hiện gói dịch vụ (tên gói/thời hạn chưa chốt, O-06). Hai hàng dẫn
 * tới Cài đặt shop (màn khung; chưa chỉnh sửa được). "Bắt đầu sử dụng" xóa lịch sử thiết lập rồi vào
 * Tổng quan; không có nút Back và chặn Back hệ thống để không quay lại màn thiết lập.
 */
export function SetupDoneScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { color } = tokens;
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const navigation = useAppNavigation();
  const { state } = useOnboardingFlow();
  // Chặn rời màn bằng Back hệ thống/cử chỉ; chỉ rời qua nút "Bắt đầu sử dụng" (allowLeave trước).
  const { allowLeave } = useConfirmBeforeLeave(true, () => undefined);

  const layout = computeSetupDoneLayout({
    width,
    height,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    fontScale,
  });
  const { gaps } = layout;

  const shopName = state.shop?.name ?? normalizeShopName(state.shopName);
  const sources = state.shop?.sellingSources ?? state.sources;
  const shopValue = shopName.length > 0 ? shopName : t('screens:setupDone.shopFallback');
  const sourcesValue =
    sources.length > 0
      ? sources.map((source) => t(`screens:createShop.sources.${source}`)).join(', ')
      : t('screens:setupDone.noSources');
  const openSettings = () => navigation.push(ROUTES.shopSettings);

  return (
    <OnboardingScaffold testID="screen-UI-A06" padX={layout.padX} bottomPad={layout.bottomPad}>
      <View style={{ marginTop: gaps.top }}>
        {layout.illustrationHeight > 0 ? (
          <SetupDoneIllustration height={layout.illustrationHeight} />
        ) : null}
      </View>

      <View style={[styles.titleBlock, { marginTop: gaps.illustrationToTitle }]}>
        <Text variant="screenTitle" accessibilityRole="header" style={styles.center} bold>
          <Text variant="screenTitle" bold style={[styles.center, { color: color.text.strong }]}>
            {t('screens:setupDone.titleLead')}
          </Text>
          {'\n'}
          <Text variant="sectionTitle" bold style={{ color: color.text.strong }}>
            {t('screens:setupDone.title')}
          </Text>
        </Text>
        <Text
          style={[
            styles.center,
            styles.subtitle,
            { color: color.text.subtle, marginTop: gaps.titleToSubtitle },
          ]}
        >
          {t('screens:setupDone.subtitle')}
        </Text>
      </View>

      <View
        testID="setup-summary"
        style={{
          marginTop: gaps.subtitleToCard,
          backgroundColor: color.surface.raised,
          borderColor: color.border.default,
          borderWidth: tokens.borderWidth.thin,
          borderRadius: tokens.radius.lg,
          paddingHorizontal: tokens.space.lg,
        }}
      >
        <SummaryRow
          testID="summary-shop"
          icon="store"
          label={t('screens:setupDone.shopLabel')}
          value={shopValue}
          onPress={openSettings}
          last={false}
        />
        <SummaryRow
          testID="summary-sources"
          icon="bag"
          label={t('screens:setupDone.sourcesLabel')}
          value={sourcesValue}
          onPress={openSettings}
          last
        />
      </View>

      <View style={styles.spacer} />

      <View style={{ marginTop: gaps.cardToButton }}>
        <Button
          testID="setup-start"
          label={t('screens:setupDone.start')}
          onPress={() => {
            allowLeave();
            navigation.reset(ROUTES.home);
          }}
        />
      </View>
      <Pressable
        testID="setup-guide"
        accessibilityRole="button"
        accessibilityLabel={t('screens:setupDone.guide')}
        onPress={() => navigation.push(ROUTES.help)}
        style={[styles.guide, { minHeight: LINK_ROW_HEIGHT, gap: tokens.space.sm }]}
      >
        <Icon name="play-circle" size={tokens.icon.md} color={color.action.link} />
        <Text bold style={{ color: color.action.link }}>
          {t('screens:setupDone.guide')}
        </Text>
      </Pressable>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  titleBlock: { alignItems: 'center' },
  center: { textAlign: 'center' },
  // token-exception: giới hạn bề rộng đọc được để đoạn chữ ngắt dòng cân đối như mockup
  subtitle: { maxWidth: 280, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: layout.space.sm },
  rowText: { flex: 1 },
  spacer: { flexGrow: 1 },
  guide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
