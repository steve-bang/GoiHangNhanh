import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { BottomSheet, Button, ErrorState, IconTile, Skeleton, Text, useTheme } from '@/shared/ui';

import { OrderResultRow } from './OrderResultRow';
import type { LookupRow, LookupState } from './use-order-lookup';

/**
 * Hộp xác định đơn sau khi quét/nhập/tìm một mã (ORD-04 + ORD-14; docs/04 A02). Chỉ HIỂN THỊ kết quả
 * tra cứu và đưa lối đi; KHÔNG tạo đơn, KHÔNG chọn hộ:
 * - đúng một đơn: tóm tắt + *Xem chi tiết đơn*;
 * - không thấy: *Tạo đơn với mã này* (chỉ chuyển sang Tạo đơn nhanh có mã điền sẵn);
 * - nhiều đơn: bắt chọn, mỗi đơn kèm nguồn bán/mã vận đơn/lý do khớp, không hàng nào chọn sẵn;
 * - lỗi đọc: giữ mã, *Thử lại*.
 * "Không thấy" chỉ có nghĩa là không có TRÊN MÁY NÀY (dữ liệu đơn hiện chỉ cục bộ).
 */
export function OrderMatchSheet({
  state,
  onClose,
  onRetry,
  onOpened,
  onCreateAnyway,
  createAnywayLabel,
  duplicateMessage,
}: {
  state: LookupState;
  onClose: () => void;
  onRetry: (code: string) => void;
  /** Gọi ngay trước khi điều hướng sang đơn/tạo đơn (ví dụ ghi lịch sử tìm). */
  onOpened?: (code: string) => void;
  /**
   * Chỉ cho chế độ `duplicate`: người dùng CHỦ ĐỘNG tạo thêm đơn dù trùng (khôi phục hành vi cũ, ADR-011;
   * ví dụ kiện gộp hai đơn chung mã vận đơn). Không gộp, không gắn gì vào đơn cũ. Bỏ trống = không có nút.
   */
  onCreateAnyway?: () => void;
  /** Đổi nhãn nút phụ (mặc định *Vẫn tạo đơn mới*; màn Sửa đơn dùng *Vẫn lưu thay đổi*). */
  createAnywayLabel?: string;
  /** Đổi câu giải thích của chế độ `duplicate`. */
  duplicateMessage?: string;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const visible = state.kind !== 'idle';

  const openOrder = (code: string, row: LookupRow) => {
    onOpened?.(code);
    onClose();
    navigation.push(ROUTES.orderDetail, { orderId: row.order.id });
  };
  const createWithCode = (code: string) => {
    onOpened?.(code);
    onClose();
    navigation.push(ROUTES.quickOrder, { code });
  };

  const title =
    state.kind === 'one'
      ? t('screens:orderMatch.oneTitle')
      : state.kind === 'many'
        ? t('screens:orderMatch.manyTitle')
        : state.kind === 'duplicate'
          ? t('screens:orderMatch.duplicateTitle')
          : state.kind === 'none'
            ? t('screens:orderMatch.noneTitle')
            : t('screens:orderMatch.title');

  return (
    <BottomSheet compact visible={visible} onClose={onClose} title={title}>
      <View testID="order-match-sheet" style={{ gap: tokens.space.md }}>
        {state.kind !== 'idle' ? (
          <Text variant="formBody" color="inkMuted" testID="order-match-code">
            {t('screens:orderMatch.code', { code: state.code })}
          </Text>
        ) : null}
        {state.kind === 'loading' ? (
          <View testID="order-match-loading" style={{ gap: tokens.space.sm }}>
            <Text variant="formBody" accessibilityLiveRegion="polite" color="inkMuted">
              {t('screens:orderMatch.loading')}
            </Text>
            <Skeleton height={tokens.component.tile.md} />
          </View>
        ) : null}
        {state.kind === 'one' ? (
          <>
            <View style={{ alignItems: 'center' }}>
              <IconTile icon="package" tone="brand" size="lg" shape="circle" />
            </View>
            <Text variant="formBody" color="inkMuted" style={{ textAlign: 'center' }}>
              {t('screens:orderMatch.oneNote')}
            </Text>
            <OrderResultRow
              testID="order-match-one"
              order={state.row.order}
              firstLine={state.row.firstLine}
              lineCount={state.row.lineCount}
              evidence={state.row.evidence}
              onPress={() => openOrder(state.code, state.row)}
            />
            <Button
              size="compact"
              testID="order-match-open"
              label={t('screens:orderMatch.openDetail')}
              onPress={() => openOrder(state.code, state.row)}
            />
          </>
        ) : null}
        {state.kind === 'many' ? (
          <>
            <Text variant="formBody" color="ink">
              {t('screens:orderMatch.manyMessage')}
            </Text>
            <View style={{ gap: tokens.space.sm }}>
              {state.rows.map((row) => (
                <OrderResultRow
                  key={row.order.id}
                  testID={`order-match-${row.order.id}`}
                  order={row.order}
                  firstLine={row.firstLine}
                  lineCount={row.lineCount}
                  evidence={row.evidence}
                  reasons={row.reasons}
                  onPress={() => openOrder(state.code, row)}
                />
              ))}
            </View>
            <Button
              size="slim"
              variant="secondary"
              testID="order-match-create"
              label={t('screens:orderMatch.createInstead')}
              onPress={() => createWithCode(state.code)}
            />
          </>
        ) : null}
        {state.kind === 'duplicate' ? (
          <>
            <Text variant="formBody" color="ink">
              {duplicateMessage ?? t('screens:orderMatch.duplicateMessage')}
            </Text>
            <View style={{ gap: tokens.space.sm }}>
              {state.rows.map((row) => (
                <OrderResultRow
                  key={row.order.id}
                  testID={`order-match-${row.order.id}`}
                  order={row.order}
                  firstLine={row.firstLine}
                  lineCount={row.lineCount}
                  evidence={row.evidence}
                  reasons={row.reasons}
                  onPress={() => openOrder(state.code, row)}
                />
              ))}
            </View>
            {onCreateAnyway ? (
              <Button
                size="slim"
                variant="secondary"
                testID="order-match-create-anyway"
                label={createAnywayLabel ?? t('screens:orderMatch.createAnyway')}
                onPress={onCreateAnyway}
              />
            ) : null}
            <Button
              size="slim"
              variant="secondary"
              testID="order-match-back-edit"
              label={t('screens:orderMatch.backToEdit')}
              onPress={onClose}
            />
          </>
        ) : null}
        {state.kind === 'none' ? (
          <>
            <Text variant="formBody" color="ink">
              {t('screens:orderMatch.noneMessage')}
            </Text>
            <Button
              size="compact"
              testID="order-match-create"
              label={t('screens:orderMatch.createWithCode')}
              onPress={() => createWithCode(state.code)}
            />
            <Button
              size="slim"
              variant="secondary"
              testID="order-match-again"
              label={t('screens:orderMatch.tryAgain')}
              onPress={onClose}
            />
          </>
        ) : null}
        {state.kind === 'error' ? (
          <>
            <ErrorState
              variant="card"
              testID="order-match-error"
              title={t('screens:orderMatch.error')}
              retryLabel={t('common:actions.retry')}
              onRetry={() => onRetry(state.code)}
            />
            <Button
              size="slim"
              variant="secondary"
              label={t('screens:orderMatch.tryAgain')}
              onPress={onClose}
            />
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}
