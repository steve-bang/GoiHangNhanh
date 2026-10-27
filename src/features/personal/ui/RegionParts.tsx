import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { resolveErrorMessage } from '@/core/i18n/error-message';
import { Card, ErrorState, Skeleton, useTheme } from '@/shared/ui';

import type { Region } from './use-region';

/** Khung chữ + nút thử lại cho một khu vực lỗi (câu chữ lấy theo mã lỗi, docs/09 mục 5.1). */
export function RegionError({
  region,
  code,
  testID,
}: {
  region: Region<unknown>;
  code: Parameters<typeof resolveErrorMessage>[1];
  testID: string;
}) {
  const { t } = useTranslation();
  const message = resolveErrorMessage(t, code);
  return (
    <Card>
      <ErrorState
        testID={testID}
        title={message.title}
        {...(message.hint ? { message: message.hint } : {})}
        onRetry={() => void region.reload()}
        retrying={region.refreshing}
      />
    </Card>
  );
}

export function RegionSkeleton({ testID }: { testID: string }) {
  const { tokens } = useTheme();
  return (
    <Card testID={testID}>
      <View style={{ gap: tokens.space.sm }}>
        <Skeleton width="60%" height={20} />
        <Skeleton width="80%" />
      </View>
    </Card>
  );
}
