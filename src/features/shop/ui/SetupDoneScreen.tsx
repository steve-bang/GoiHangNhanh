import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useConfirmBeforeLeave } from '@/platform';
import { Button, Icon, Text, useTheme, type IconName } from '@/shared/ui';

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
  const { colors, spacing } = useTheme();
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
          gap: spacing.md,
          opacity: pressed ? 0.85 : 1,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.fieldBorder,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.brand }]}>
        <Icon name={icon} size={20} color={colors.onBrand} />
      </View>
      <View style={styles.rowText}>
        <Text variant="caption" style={{ color: colors.inkMuted }}>
          {label}
        </Text>
        <Text bold color="ink" numberOfLines={2}>
          {value}
        </Text>
      </View>
      <Icon name="forward" size={20} color={colors.inkMuted} />
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
  const { colors, radius, spacing } = useTheme();
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
  const { gaps, titleLead } = layout;

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
        <Text accessibilityRole="header" style={styles.center} bold>
          <Text bold style={[titleLead, styles.block, { color: colors.ink }]}>
            {t('screens:setupDone.titleLead')}
          </Text>
          {'\n'}
          <Text bold style={[styles.titleSecond, { color: colors.ink }]}>
            {t('screens:setupDone.title')}
          </Text>
        </Text>
        <Text
          style={[
            styles.center,
            styles.subtitle,
            { color: colors.inkMuted, marginTop: gaps.titleToSubtitle },
          ]}
        >
          {t('screens:setupDone.subtitle')}
        </Text>
      </View>

      <View
        testID="setup-summary"
        style={{
          marginTop: gaps.subtitleToCard,
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.lg,
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
        style={[styles.guide, { minHeight: LINK_ROW_HEIGHT, gap: spacing.sm }]}
      >
        <Icon name="play-circle" size={20} color={colors.brand} />
        <Text bold style={{ color: colors.brand }}>
          {t('screens:setupDone.guide')}
        </Text>
      </Pressable>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  titleBlock: { alignItems: 'center' },
  center: { textAlign: 'center' },
  // Giới hạn bề rộng để đoạn chữ ngắt dòng cân đối như mockup (không còn một chữ lẻ ở dòng cuối).
  subtitle: { maxWidth: 280, alignSelf: 'center' },
  block: { textAlign: 'center' },
  titleSecond: { fontSize: 18, lineHeight: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  spacer: { flexGrow: 1 },
  guide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
