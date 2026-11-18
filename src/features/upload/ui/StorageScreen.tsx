import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatBytes } from '@/core/format/format-bytes';
import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { Button, ListGroup, MetricTile, Screen, Text, useTheme } from '@/shared/ui';

import type { UsageGroup } from '../domain';
import { useStorageUsage } from './use-evidence-stats';

/**
 * UI-F03 Dung lượng (V1-30). Dung lượng tệp bằng chứng TRÊN MÁY NÀY của cửa hàng đang dùng, chỉ tệp do
 * chính tài khoản đang đăng nhập tạo (`upload/domain/storage-usage.ts`). Ba nhóm theo trạng thái tệp: "Đã
 * lên máy chủ" chỉ khi máy chủ đã xác nhận (bất biến 3). Đang đọc/lỗi hiện "–", không số giả. KHÔNG có
 * nút xóa/giải phóng (Q-30g A), KHÔNG số hạn mức hay hạn lưu của gói (D-4 còn giữ chỗ), không chữ
 * "an toàn" (bất biến 11).
 */
export function StorageScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { state, reload } = useStorageUsage();
  const data = state.kind === 'ready' ? state.data : null;

  const withSize = (group: UsageGroup | undefined): string =>
    group
      ? t('screens:storage.valueWithSize', { count: group.files, size: formatBytes(group.bytes) })
      : t('screens:storage.unknown');
  const countOnly = (group: UsageGroup | undefined): string =>
    group ? t('screens:storage.valueCount', { count: group.files }) : t('screens:storage.unknown');

  const empty =
    data !== null && data.onServer.files + data.notOnServer.files + data.noLocalCopy.files === 0;
  const unknownSize = data ? data.onServer.unknownSize + data.notOnServer.unknownSize : 0;

  return (
    <Screen
      title={t('nav:titles.UI-F03')}
      onBack={navigation.back}
      testID="screen-UI-F03"
      contentGap={tokens.space.lg}
    >
      {empty ? (
        <Text variant="formBody" color="textMuted" testID="storage-empty">
          {t('screens:storage.empty')}
        </Text>
      ) : (
        <ListGroup>
          <MetricTile
            layout="row"
            icon="cloud"
            tone="blue"
            label={t('screens:storage.onServer')}
            value={withSize(data?.onServer)}
            testID="storage-on-server"
          />
          <MetricTile
            layout="row"
            icon="sync"
            tone="warning"
            label={t('screens:storage.notOnServer')}
            value={withSize(data?.notOnServer)}
            testID="storage-not-on-server"
          />
          {/* Trường hợp hiếm (đang ghi, lưu máy lỗi): chỉ hiện khi có, để không làm rối màn. */}
          {!data || data.noLocalCopy.files > 0 ? (
            <MetricTile
              layout="row"
              icon="alert"
              tone="neutral"
              label={t('screens:storage.noLocalCopy')}
              value={countOnly(data?.noLocalCopy)}
              testID="storage-no-local-copy"
            />
          ) : null}
        </ListGroup>
      )}
      <View style={{ gap: tokens.space.xs }} testID="storage-explain">
        {state.kind === 'error' ? (
          <Text variant="caption" color="textMuted" testID="storage-load-error">
            {t('screens:storage.loadError')}
          </Text>
        ) : null}
        <Text variant="caption" color="textMuted">
          {t('screens:storage.scope')}
        </Text>
        {data && data.notOnServer.files > 0 ? (
          <Text variant="caption" color="textMuted" testID="storage-risk">
            {t('screens:storage.risk')}
          </Text>
        ) : null}
        {unknownSize > 0 ? (
          <Text variant="caption" color="textMuted" testID="storage-unknown-size">
            {t('screens:storage.unknownSize', { count: unknownSize })}
          </Text>
        ) : null}
        {data && data.otherAccountFiles > 0 ? (
          <Text variant="caption" color="textMuted" testID="storage-other-accounts">
            {t('screens:storage.otherAccounts', { count: data.otherAccountFiles })}
          </Text>
        ) : null}
      </View>
      {state.kind === 'error' ? (
        <Button
          label={t('screens:storage.retry')}
          variant="secondary"
          onPress={() => void reload()}
          testID="storage-retry"
        />
      ) : null}
      <Button
        label={t('screens:storage.openSync')}
        onPress={() => navigation.push(ROUTES.sync)}
        testID="storage-open-sync"
      />
    </Screen>
  );
}
