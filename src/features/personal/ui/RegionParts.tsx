import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { resolveErrorMessage } from '@/core/i18n/error-message';
import { layout } from '@/core/theme';
import { Card, ErrorState, Skeleton, useTheme } from '@/shared/ui';

import type { Region } from './use-region';

/**
 * Khung chữ + nút thử lại cho một khu vực lỗi (câu chữ lấy theo mã lỗi, docs/09 mục 5.1). `inline`:
 * đặt trong một thẻ nhóm có sẵn (không bọc thẻ thứ hai). `card`: thẻ lỗi nền hồng của board 07
 * (khung 1c), tự là thẻ nên không bọc thêm.
 */
export function RegionError({
  region,
  code,
  testID,
  inline = false,
  card = false,
}: {
  region: Region<unknown>;
  code: Parameters<typeof resolveErrorMessage>[1];
  testID: string;
  inline?: boolean;
  card?: boolean;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const message = resolveErrorMessage(t, code);
  const state = (
    <ErrorState
      testID={testID}
      title={message.title}
      {...(message.hint ? { message: message.hint } : {})}
      onRetry={() => void region.reload()}
      retrying={region.refreshing}
      {...(card ? { variant: 'card' as const } : {})}
    />
  );
  if (card) return state;
  return inline ? <View style={{ padding: tokens.space.lg }}>{state}</View> : <Card>{state}</Card>;
}

/**
 * Khung chờ dựng theo hình thật của thẻ hồ sơ/cửa hàng: ảnh đại diện + hai dòng. `inline`: đặt trong
 * thẻ nhóm có sẵn. `shape="square"` cho cửa hàng.
 */
export function RegionSkeleton({
  testID,
  inline = false,
  shape = 'circle',
}: {
  testID: string;
  inline?: boolean;
  shape?: 'circle' | 'square';
}) {
  const { tokens } = useTheme();
  const size = layout.component.tile.lg;
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space.md,
        ...(inline ? { padding: tokens.space.lg } : null),
      }}
    >
      <Skeleton circle={shape === 'circle'} width={size} height={size} />
      <View style={{ flex: 1, gap: tokens.space.sm }}>
        <Skeleton width="60%" height={20} />
        <Skeleton width="80%" />
      </View>
    </View>
  );
  return inline ? <View testID={testID}>{body}</View> : <Card testID={testID}>{body}</Card>;
}
