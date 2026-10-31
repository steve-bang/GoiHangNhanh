import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { logger } from '@/core/logging/logger';
import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useRouteParams } from '@/platform';
import { Button, Screen, Text, TextField, useTheme } from '@/shared/ui';

import type { ReturnDetails } from '../domain';
import { ReturnLoadState } from './ReturnLoadState';
import { ReturnSummaryCards } from './ReturnSummaryCards';
import { resumeRoute } from './return-routes';
import { useLinkedOrderCode } from './use-linked-order';
import { useReturnCase } from './use-return-case';
import { useReturnOps } from './use-return-ops';

/**
 * UI-D06 Xác nhận kết quả kiểm tra (đặc tả B07). Tổng hợp tình trạng kiện, video mở kiện, hàng thực nhận,
 * sai lệch và hạn chế bằng chứng. Xác nhận hồ sơ KHÔNG phải kết luận tranh chấp; có thể xác nhận khi
 * chưa có video nhưng phải nói rõ hạn chế. Sau khi xác nhận hồ sơ không sửa được (chỉ liên kết đơn gốc sau).
 */
export function ReturnReviewScreen() {
  const params = useRouteParams();
  const { state, reload } = useReturnCase(params.returnId);
  if (state.kind !== 'ready') {
    return <ReturnLoadState uiCode="UI-D06" state={state} onRetry={reload} />;
  }
  return <ReviewBody details={state.details} />;
}

function ReviewBody({ details }: { details: ReturnDetails }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const ops = useReturnOps();
  const { returnCase } = details;
  const orderCode = useLinkedOrderCode(returnCase.sourceOrderId);
  const [finalNote, setFinalNote] = useState(returnCase.finalNote);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ErrorCode | null>(null);

  // Chỉ xác nhận được từ bước kiểm tra; hồ sơ ở bước trước quay về đó, đã xác nhận thì sang màn xem.
  const redirect = returnCase.status === 'checking' ? null : resumeRoute(returnCase.status);
  useEffect(() => {
    if (redirect) navigation.replace(redirect, { returnId: returnCase.id });
  }, [redirect, navigation, returnCase.id]);

  const confirm = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await ops.confirm(returnCase.id, finalNote);
      navigation.replace(ROUTES.returnDone, { returnId: returnCase.id });
    } catch (error) {
      logger.warn('returns.confirm_failed', { reason: isAppError(error) ? error.code : 'unknown' });
      setFailure(isAppError(error) ? error.code : 'RETURN_SAVE_FAILED');
      setBusy(false);
    }
  };

  return (
    <Screen
      form
      title={t('nav:titles.UI-D06')}
      onBack={navigation.back}
      testID="screen-UI-D06"
      footer={
        <>
          <Button
            testID="return-confirm"
            label={t('returns:review.confirm')}
            loading={busy}
            disabled={busy}
            onPress={() => void confirm()}
          />
          <Button
            testID="return-edit-items"
            variant="secondary"
            label={t('returns:review.editItems')}
            disabled={busy}
            onPress={navigation.back}
          />
          <Button
            testID="return-save-later"
            variant="secondary"
            size="slim"
            label={t('returns:review.saveLater')}
            disabled={busy}
            onPress={() => navigation.reset(ROUTES.returns)}
          />
        </>
      }
    >
      <Text variant="formBody" color="inkMuted">
        {t('returns:review.intro')}
      </Text>
      <ReturnSummaryCards details={details} orderCode={orderCode} />
      {details.discrepancies.length > 0 ? (
        <Text variant="formBody" testID="return-discrepancy-warning">
          {t('returns:review.discrepancyWarn')}
        </Text>
      ) : null}
      <TextField
        compact
        multiline
        testID="return-final-note"
        label={t('returns:review.finalNoteLabel')}
        value={finalNote}
        onChangeText={setFinalNote}
        maxLength={500}
        counterMax={500}
      />
      {failure ? (
        <View testID="return-confirm-error">
          <Text
            variant="formBody"
            accessibilityRole="alert"
            style={{ color: tokens.color.feedback.danger.fg }}
          >
            {errorText(resolveErrorMessage(t, failure))}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
