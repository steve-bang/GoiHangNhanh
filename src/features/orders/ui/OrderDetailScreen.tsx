import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { OrderId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { copyText, useAppNavigation, useRouteParams } from '@/platform';
import {
  Button,
  Card,
  EmptyState,
  ProductLineList,
  Screen,
  Skeleton,
  SourceIcon,
  Text,
  useTheme,
} from '@/shared/ui';
import { layout } from '@/core/theme';

import {
  canRecordNow,
  countEvidence,
  formatDeviceDateTime,
  isSessionActive,
  type OrderDetails,
  type OrderEvidenceItem,
  type OrderEvidenceSummary,
  type PackingSession,
} from '../domain';
import { CopyButton } from './CopyButton';
import { CopyableOrderCode } from './CopyableOrderCode';
import { EvidenceSummaryCard } from './EvidenceSummaryCard';
import { useOrderDetail } from './use-order-detail';
import { useRecordOrder } from './use-record-order';

/**
 * UI-E02 Chi tiết đơn, CHỈ ĐỌC (sửa đơn là việc sau). Mở bằng ID nội bộ; ID không có hoặc thuộc shop
 * khác đều hiện "không tìm thấy" mà không lộ dữ liệu. Phiên `created` hiện ở Kiện hàng và Lịch sử
 * hoạt động như phiên đã bắt đầu, KHÔNG phải bằng chứng: mục Bằng chứng chỉ nói về video thật (hiện
 * chưa có). Thời gian là giờ thiết bị.
 */
export function OrderDetailScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const params = useRouteParams();
  const orderId = params.orderId as OrderId | undefined;
  const { state, reload } = useOrderDetail(orderId);

  const header = {
    form: true,
    contentGap: tokens.space.md,
    title: t('nav:titles.UI-E02'),
    onBack: navigation.back,
    inTabs: true,
    testID: 'screen-UI-E02',
  } as const;

  if (state.kind === 'loading') {
    return (
      <Screen {...header}>
        <Text variant="formBody" accessibilityLiveRegion="polite" color="inkMuted">
          {t('screens:orderDetail.loading')}
        </Text>
        <Skeleton height={72} />
      </Screen>
    );
  }
  if (state.kind === 'notFound') {
    return (
      <Screen {...header}>
        <View testID="order-not-found">
          <EmptyState
            compact
            title={t('screens:orderDetail.notFoundTitle')}
            message={t('screens:orderDetail.notFound')}
            actionLabel={t('screens:orderDetail.backToList')}
            onAction={navigation.back}
          />
        </View>
      </Screen>
    );
  }
  if (state.kind === 'error') {
    return (
      <Screen {...header}>
        <Card compact tone="danger" testID="order-detail-error">
          <View style={{ gap: tokens.space.sm }}>
            <Text variant="formBody" accessibilityRole="alert">
              {t('screens:orderDetail.loadError')}
            </Text>
            <Button size="slim" label={t('common:actions.retry')} onPress={reload} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <DetailReady
      header={header}
      details={state.details}
      sessions={state.sessions}
      evidence={state.evidence}
      items={state.items}
    />
  );
}

type DetailHeader = {
  readonly form: true;
  readonly contentGap: number;
  readonly title: string;
  readonly onBack: () => void;
  readonly inTabs: true;
  readonly testID: string;
};

function DetailReady({
  header,
  details,
  sessions,
  evidence,
  items,
}: {
  header: DetailHeader;
  details: OrderDetails;
  sessions: readonly PackingSession[];
  evidence: OrderEvidenceSummary;
  items: readonly OrderEvidenceItem[];
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const [copied, setCopied] = useState<'trackingCode' | 'failed' | null>(null);
  const { order, lines, packages } = details;
  const activeSession = sessions.find(isSessionActive) ?? null; // mới nhất trước; cùng quy tắc với danh sách
  const { start, recordNow } = useRecordOrder(order.id, activeSession);
  const record = canRecordNow(evidence);
  const copyTracking = async (text: string) => {
    setCopied((await copyText(text)) ? 'trackingCode' : 'failed');
  };

  const history = [
    { key: 'created', at: order.createdAtDevice, text: t('screens:orderDetail.historyCreated') },
    ...[...sessions].reverse().map((s) => ({
      key: s.id,
      at: s.startedAtDevice,
      text: t('screens:orderDetail.historySession', { index: s.snapshot.packageIndex }),
    })),
  ].sort((a, b) => a.at - b.at);

  return (
    <Screen
      {...header}
      footer={
        <>
          {start.error ? (
            <Card compact tone="danger" testID="order-detail-start-error">
              <Text variant="formBody" accessibilityRole="alert">
                {t(`errors:${start.error}`)}
              </Text>
            </Card>
          ) : null}
          {record ? (
            <Button
              size="compact"
              testID="order-detail-record"
              label={t('screens:orderDetail.recordPack')}
              loading={start.busy}
              onPress={recordNow}
            />
          ) : null}
          <Button
            size="compact"
            variant={record ? 'secondary' : 'primary'}
            testID="order-detail-view-evidence"
            label={t('screens:orderDetail.viewEvidence')}
            onPress={() => navigation.push(ROUTES.orderEvidence, { orderId: order.id })}
          />
        </>
      }
    >
      <Card compact>
        <View style={{ gap: tokens.space.sm }}>
          <CopyableOrderCode orderCode={order.orderCode} />
          <View style={styles.row}>
            <SourceIcon source={order.source} size={tokens.component.tile.sm} />
            <View style={styles.flex}>
              <Text variant="formLabel" color="inkMuted">
                {t('screens:orderDetail.source')}
              </Text>
              <Text variant="formButton" color="ink" testID="detail-source">
                {t(`common:sources.${order.source}`)}
              </Text>
            </View>
          </View>
          {order.trackingCode ? (
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text variant="formLabel" color="inkMuted">
                  {t('screens:orderDetail.trackingCode')}
                </Text>
                <Text variant="formButton" color="ink" testID="detail-tracking-code">
                  {order.trackingCode}
                </Text>
              </View>
              <CopyButton
                testID="copy-tracking-code"
                label={t('screens:orderDetail.copyTrackingCode')}
                onPress={() => void copyTracking(order.trackingCode ?? '')}
              />
            </View>
          ) : (
            <Text variant="formBody" color="inkMuted" testID="detail-no-tracking">
              {t('screens:orderDetail.noTracking')}
            </Text>
          )}
          {copied ? (
            <Text
              testID="copy-feedback"
              variant="caption"
              color={copied === 'failed' ? 'danger' : 'success'}
              accessibilityLiveRegion="polite"
            >
              {t(copied === 'failed' ? 'screens:preview.copyFailed' : 'screens:preview.copied')}
            </Text>
          ) : null}
          <View>
            <Text variant="formLabel" color="inkMuted">
              {t('screens:orderDetail.createdAt')}
            </Text>
            <Text variant="formBody" color="ink" testID="detail-created-at">
              {formatDeviceDateTime(order.createdAtDevice)}
            </Text>
            <Text variant="caption" color="textMuted">
              {t('screens:orderDetail.deviceTime')}
            </Text>
          </View>
          <Text variant="caption" color="textMuted">
            {t('screens:orderDetail.enteredByYou')}
          </Text>
          {sessions.length === 0 ? (
            <Button
              size="slim"
              variant="secondary"
              testID="order-detail-edit"
              label={t('screens:orderDetail.edit')}
              onPress={() => navigation.push(ROUTES.orderEdit, { orderId: order.id })}
            />
          ) : (
            // Đơn đã bắt đầu quay: chưa sửa được (chưa có lịch sử thay đổi; bất biến 7, Q-22ah).
            <Text variant="caption" color="textMuted" testID="detail-edit-locked">
              {t('screens:orderEdit.lockedMessage')}
            </Text>
          )}
        </View>
      </Card>

      <EvidenceSummaryCard
        summary={evidence}
        counts={items.length > 0 ? countEvidence(items) : null}
      />
      <Button
        size="slim"
        variant="secondary"
        testID="order-detail-dispute"
        label={t('disputes:list.create')}
        onPress={() => navigation.push(ROUTES.disputeNew, { orderId: order.id })}
      />

      <Card compact>
        <View style={{ gap: tokens.space.sm }}>
          <Text variant="formButton" color="ink" accessibilityRole="header">
            {t('screens:orderDetail.products')}
          </Text>
          <ProductLineList
            compact
            lines={lines.map((l) => ({
              id: l.id,
              name: l.name,
              ...(l.variant ? { variant: l.variant } : {}),
              quantity: l.quantity,
            }))}
          />
          {lines.length === 0 ? (
            <Text variant="formBody" color="inkMuted" testID="detail-undeclared-hint">
              {t('screens:orderDetail.undeclaredHint')}
            </Text>
          ) : null}
        </View>
      </Card>

      <Card compact>
        <View style={{ gap: tokens.space.sm }}>
          <Text variant="formButton" color="ink" accessibilityRole="header">
            {t('screens:orderDetail.packages')}
          </Text>
          {packages.map((pkg) => {
            const session = sessions.find((s) => s.packageId === pkg.id);
            return (
              <View key={pkg.id} testID={`detail-package-${pkg.id}`}>
                <Text variant="formButton" color="ink">
                  {t('screens:orderDetail.package', { index: pkg.index })}
                </Text>
                <Text variant="formBody" color="inkMuted">
                  {session
                    ? t('screens:orderDetail.packageActiveSession', {
                        time: formatDeviceDateTime(session.startedAtDevice),
                      })
                    : t('screens:orderDetail.packageNoSession')}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Card compact>
        <View style={{ gap: tokens.space.sm }}>
          <Text variant="formButton" color="ink" accessibilityRole="header">
            {t('screens:orderDetail.history')}
          </Text>
          {history.map((event) => (
            <View key={event.key} style={styles.row} testID="detail-history-item">
              <View style={[styles.dot, { backgroundColor: tokens.color.brand.primary }]} />
              <View style={styles.flex}>
                <Text variant="formBody" color="ink">
                  {event.text}
                </Text>
                <Text variant="caption" color="textMuted">
                  {formatDeviceDateTime(event.at)}
                </Text>
              </View>
            </View>
          ))}
          <Text variant="caption" color="textMuted">
            {t('screens:orderDetail.historyNote')}
          </Text>
        </View>
      </Card>
      {start.permissionSheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: layout.space.sm },
  // token-exception: chấm trạng thái nhỏ 8dp trong dòng chi tiết, kích thước riêng của hàng này
  dot: { width: 8, height: 8, borderRadius: layout.radius.full },
});
