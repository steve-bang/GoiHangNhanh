import { useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ROUTES } from '@/core/navigation';
import type { OrderSource } from '@/core/orders/order-source';
import { getInputResetStyle, getMinTouchTarget, useAppNavigation } from '@/platform';
import { Button, Text, useTheme } from '@/shared/ui';

import { normalizeSources, SELLING_SOURCES } from '../domain/selling-sources';
import {
  normalizeShopName,
  SHOP_NAME_MAX_LENGTH,
  textLength,
  validateShopName,
} from '../domain/validation';
import {
  FormErrorBanner,
  SourceCard,
  StepProgress,
  type TextInputHandle,
} from './onboarding/OnboardingParts';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { OnboardingScaffold, useScrollIntoView } from './onboarding/OnboardingScaffold';
import {
  computeCreateShopLayout,
  LINK_ROW_HEIGHT,
  SHOP_NAME_INPUT_HEIGHT,
} from './onboarding-layout';
import { getStepSegments, ONBOARDING_STEP, ONBOARDING_TOTAL_STEPS } from './onboarding-progress';
import { useGatewayTask } from './onboarding/useGatewayTask';

/** Ô tên shop: nhãn có dấu * (bắt buộc) phía trên, ô nhập, lỗi bên trái và bộ đếm ký tự bên phải. */
function ShopNameField({
  value,
  onChange,
  onBlur,
  error,
  inputRef,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: string | undefined;
  inputRef: RefObject<TextInputHandle | null>;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<ComponentRef<typeof View>>(null);
  const scrollIntoView = useScrollIntoView();
  return (
    <View ref={wrapperRef} collapsable={false}>
      <Text bold color="ink">
        {t('screens:createShop.shopNameLabel')}
        <Text bold style={{ color: colors.danger }} accessibilityElementsHidden>
          {' *'}
        </Text>
      </Text>
      <TextInput
        ref={inputRef}
        testID="shop-name-input"
        accessibilityLabel={`${t('screens:createShop.shopNameLabel')}, ${t('screens:createShop.shopNameRequired')}`}
        value={value}
        onChangeText={onChange}
        onFocus={() => {
          setFocused(true);
          scrollIntoView(wrapperRef);
        }}
        onBlur={() => {
          setFocused(false);
          onBlur();
        }}
        placeholder={t('screens:createShop.shopNamePlaceholder')}
        placeholderTextColor={colors.inkMuted}
        maxLength={SHOP_NAME_MAX_LENGTH}
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="organizationName"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        style={[
          styles.nameInput,
          getInputResetStyle(),
          {
            height: Math.max(SHOP_NAME_INPUT_HEIGHT, getMinTouchTarget()),
            marginTop: 8,
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.brand : colors.fieldBorder,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.lg,
          },
        ]}
      />
      <View style={styles.nameFooter}>
        <Text
          variant="caption"
          accessibilityLiveRegion="polite"
          style={[styles.nameError, { color: colors.danger }]}
        >
          {error ?? ''}
        </Text>
        <Text variant="caption" style={{ color: colors.inkMuted }}>
          {t('screens:createShop.shopNameCounter', {
            count: textLength(value),
            max: SHOP_NAME_MAX_LENGTH,
          })}
        </Text>
      </View>
    </View>
  );
}

/**
 * UI-A04 Tạo hồ sơ shop (docs/09 mục 4; mockup 01-onboarding, màn thứ ba). Tên shop bắt buộc (1-50
 * ký tự); nguồn bán chọn nhiều và BỎ QUA ĐƯỢC. "Bỏ qua, để sau" = tiếp tục không chọn nguồn bán,
 * nhưng vẫn cần tên shop. Chỉ sang bước sau khi cổng xác nhận đã tạo shop. Shop chỉ được TẠO một
 * lần mỗi luồng: quay lại từ bước Hoàn tất rồi sửa thì gọi `updateShop` với shop đã có.
 */
export function CreateShopScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const navigation = useAppNavigation();
  const { state, dispatch, gateways } = useOnboardingFlow();

  const [nameTouched, setNameTouched] = useState(false);
  const { busy, busyRef, formError, setFormError, run } = useGatewayTask();
  const nameRef = useRef<TextInputHandle>(null);

  const layout = computeCreateShopLayout({
    width,
    height,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    fontScale,
  });
  const { gaps, title } = layout;

  const nameIssue = validateShopName(state.shopName);
  const nameError =
    nameTouched && nameIssue
      ? t(
          nameIssue === 'required'
            ? 'screens:createShop.errors.nameRequired'
            : 'screens:createShop.errors.nameTooLong',
        )
      : undefined;

  const create = (sources: readonly OrderSource[]) => {
    if (busyRef.current) return;
    if (nameIssue) {
      setNameTouched(true);
      nameRef.current?.focus();
      return;
    }
    const name = normalizeShopName(state.shopName);
    const sellingSources = normalizeSources(sources);
    // Chỉ dùng shop do CHÍNH tài khoản hiện tại tạo; shop của tài khoản khác không bao giờ được cập nhật.
    const ownerUid = state.account?.uid ?? null;
    const existing = state.shop !== null && state.shopOwnerUid === ownerUid ? state.shop : null;
    void run(async (isActive) => {
      if (existing === null) {
        const shop = await gateways.shop.createShop({ name, sellingSources });
        // Máy chủ đã tạo shop: luôn ghi nhận ID để không bao giờ tạo shop thứ hai trong luồng này.
        dispatch({ type: 'shop_created', shop, ownerUid });
      } else if (
        existing.name !== name ||
        existing.sellingSources.join() !== sellingSources.join()
      ) {
        // Đã có shop (quay lại từ bước sau) và người dùng đã sửa: cập nhật, không tạo mới.
        const shop = await gateways.shop.updateShop({ shopId: existing.id, name, sellingSources });
        dispatch({ type: 'shop_created', shop, ownerUid });
      }
      if (!isActive()) return;
      navigation.push(ROUTES.setupDone);
    });
  };

  const skip = () => {
    dispatch({ type: 'sources_cleared' });
    create([]);
  };

  return (
    <OnboardingScaffold
      testID="screen-UI-A04"
      padX={layout.padX}
      bottomPad={layout.bottomPad}
      onBack={navigation.back}
    >
      <View style={{ marginTop: gaps.afterBack }}>
        <StepProgress
          segments={getStepSegments(ONBOARDING_STEP.shop)}
          current={ONBOARDING_STEP.shop}
          total={ONBOARDING_TOTAL_STEPS}
        />
      </View>
      <View style={{ marginTop: gaps.progressToTitle }}>
        <Text accessibilityRole="header" bold style={[title, { color: colors.ink }]}>
          {t('screens:createShop.title')}
        </Text>
        <Text style={{ color: colors.inkMuted, marginTop: gaps.titleToSubtitle }}>
          {t('screens:createShop.subtitle')}
        </Text>
      </View>

      <View style={{ marginTop: gaps.subtitleToName }}>
        <ShopNameField
          value={state.shopName}
          onChange={(name) => {
            setNameTouched(true);
            setFormError(null);
            dispatch({ type: 'shop_name_changed', name });
          }}
          onBlur={() => setNameTouched(true)}
          error={nameError}
          inputRef={nameRef}
          onSubmit={() => undefined}
        />
      </View>

      <View style={{ marginTop: gaps.nameToSources }}>
        <Text bold color="ink">
          {t('screens:createShop.sourcesLabel')}
        </Text>
        <Text variant="caption" style={{ color: colors.inkMuted }}>
          {t('screens:createShop.sourcesHint')}
        </Text>
        <View
          accessibilityRole="list"
          style={{ marginTop: gaps.sourcesHeaderToCards, gap: gaps.betweenCards }}
        >
          {SELLING_SOURCES.map((source) => (
            <SourceCard
              key={source}
              source={source}
              label={t(`screens:createShop.sources.${source}`)}
              checked={state.sources.includes(source)}
              height={layout.cardHeight}
              onToggle={() => dispatch({ type: 'source_toggled', source })}
            />
          ))}
        </View>
      </View>

      <View style={styles.spacer} />

      {formError ? (
        <View style={{ marginTop: spacing.md }}>
          <FormErrorBanner code={formError} />
        </View>
      ) : null}
      <View style={{ marginTop: gaps.cardsToButton }}>
        <Button
          testID="create-shop-submit"
          label={t('screens:createShop.submit')}
          loading={busy}
          disabled={nameIssue !== null}
          onPress={() => create(state.sources)}
        />
      </View>
      <Pressable
        testID="create-shop-skip"
        accessibilityRole="button"
        accessibilityLabel={t('screens:createShop.skip')}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={skip}
        style={[styles.skip, { minHeight: LINK_ROW_HEIGHT, marginTop: gaps.buttonToSkip }]}
      >
        <Text bold style={{ color: colors.brand }}>
          {t('screens:createShop.skip')}
        </Text>
      </Pressable>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  nameInput: { fontSize: 15, borderWidth: 1 },
  nameFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  nameError: { flex: 1, paddingRight: 8 },
  spacer: { flexGrow: 1 },
  skip: { alignItems: 'center', justifyContent: 'center' },
});
