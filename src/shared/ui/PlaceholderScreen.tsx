import { useTranslation } from 'react-i18next';

import type { UiCode } from '@/core/navigation';
import { useAppNavigation } from '@/platform';

import { EmptyState } from './EmptyState';
import { Screen } from './Screen';
import { Text } from './Text';

interface PlaceholderScreenProps {
  /** Mã danh mục giao diện (docs/09 mục 4) để truy ngược về tài liệu. */
  uiCode: UiCode;
  /** Màn gốc của tab thì không có nút quay lại. */
  hideBack?: boolean;
  inTabs?: boolean;
}

/**
 * Màn hình khung: có route, tiêu đề, bố cục và lối quay lại, CHƯA có nội dung nghiệp vụ. Mỗi màn
 * thật thay thế dần; không hiển thị dữ liệu giả ở đây. Mã `UI-xx` chỉ hiện ở bản dev.
 */
export function PlaceholderScreen({
  uiCode,
  hideBack = false,
  inTabs = false,
}: PlaceholderScreenProps) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  return (
    <Screen
      title={t(`nav:titles.${uiCode}`)}
      inTabs={inTabs}
      {...(hideBack ? {} : { onBack: navigation.back })}
      testID={`screen-${uiCode}`}
    >
      <EmptyState
        title={t('common:placeholder.title')}
        message={t('common:placeholder.message')}
        actionLabel={t('common:placeholder.action')}
        onAction={navigation.back}
      />
      {__DEV__ ? (
        <Text variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
          {uiCode}
        </Text>
      ) : null}
    </Screen>
  );
}
