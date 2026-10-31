import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { logger } from '@/core/logging/logger';
import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useRouteParams } from '@/platform';
import { Button, Card, Checkbox, Screen, Text, TextField, useTheme } from '@/shared/ui';

import {
  EXTERIOR_SIGNS,
  hasDamageSign,
  isExteriorChosen,
  toggleExteriorSign,
  type ExteriorSign,
  type ReturnDetails,
} from '../domain';
import { ReturnLoadState } from './ReturnLoadState';
import { ReturnPhotosSection } from './ReturnPhotosSection';
import { resumeRoute } from './return-routes';
import { useReturnCase } from './use-return-case';
import { useReturnOps } from './use-return-ops';

const MAX_NOTE = 500;
const MAX_REASON = 200;

/**
 * UI-D03 Tình trạng kiện bên ngoài (đặc tả B03 + ngoại lệ B04). Chọn NHIỀU dấu hiệu quan sát được;
 * KHÔNG mặc định "nguyên vẹn" (chưa chọn gì thì chưa xác nhận được); "Chưa xác định" là giá trị hợp lệ;
 * lưu như quan sát của nhân viên, không diễn giải thành nguyên nhân. Kiện đã mở trước khi quay: ghi lý
 * do, hồ sơ đánh dấu thiếu bằng chứng quá trình mở. Ảnh kiện là TÙY CHỌN (R2a): chụp trong màn này, chỉ lưu trên máy; chưa chụp thì hồ sơ nói rõ
 * là chưa có ảnh, không giả vờ có ảnh (bất biến 6). Hồ sơ đã xác nhận mở màn này thì chuyển sang màn xem.
 */
export function ReturnExteriorScreen() {
  const params = useRouteParams();
  const { state, reload } = useReturnCase(params.returnId);
  if (state.kind !== 'ready') {
    return <ReturnLoadState uiCode="UI-D03" state={state} onRetry={reload} />;
  }
  return <ExteriorForm details={state.details} />;
}

function ExteriorForm({ details }: { details: ReturnDetails }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const ops = useReturnOps();
  const { returnCase } = details;
  const [signs, setSigns] = useState<readonly ExteriorSign[]>(returnCase.exterior?.signs ?? []);
  const [note, setNote] = useState(returnCase.exterior?.note ?? '');
  const [openedBefore, setOpenedBefore] = useState(returnCase.openedBefore !== null);
  const [reason, setReason] = useState(returnCase.openedBefore?.reason ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ErrorCode | null>(null);
  const confirmed = returnCase.status === 'confirmed';

  // Hồ sơ đã xác nhận không sửa được: sang màn xem (không để người dùng gõ rồi mới báo lỗi).
  useEffect(() => {
    if (confirmed) navigation.replace(ROUTES.returnDone, { returnId: returnCase.id });
  }, [confirmed, navigation, returnCase.id]);

  const chosen = isExteriorChosen(signs);
  const reasonMissing = openedBefore && reason.trim() === '';

  const submit = async () => {
    setShowErrors(true);
    if (!chosen || reasonMissing) return;
    setBusy(true);
    setFailure(null);
    try {
      const saved = await ops.saveExterior(returnCase.id, {
        signs,
        note,
        openedBeforeReason: openedBefore ? reason : null,
      });
      navigation.replace(resumeRoute('opening'), { returnId: saved.returnCase.id });
    } catch (error) {
      logger.warn('returns.exterior_save_failed', {
        reason: isAppError(error) ? error.code : 'unknown',
      });
      setFailure(isAppError(error) ? error.code : 'RETURN_SAVE_FAILED');
      setBusy(false);
    }
  };

  return (
    <Screen
      form
      title={t('nav:titles.UI-D03')}
      onBack={navigation.back}
      testID="screen-UI-D03"
      footer={
        <Button
          testID="return-exterior-continue"
          label={t('returns:exterior.continue')}
          loading={busy}
          disabled={busy || confirmed}
          onPress={() => void submit()}
        />
      }
    >
      <Text variant="formBody" color="inkMuted">
        {t('returns:exterior.intro')}
      </Text>
      <View style={{ gap: tokens.space.xs }}>
        <Text variant="formButton" accessibilityRole="header">
          {t('returns:exterior.signsTitle')}
        </Text>
        <Card compact flush>
          <View>
            {EXTERIOR_SIGNS.map((sign) => (
              <Checkbox
                key={sign}
                testID={`return-sign-${sign}`}
                label={t(`returns:exterior.signs.${sign}`)}
                checked={signs.includes(sign)}
                onChange={() => setSigns((current) => toggleExteriorSign(current, sign))}
                error={showErrors && !chosen}
              />
            ))}
          </View>
        </Card>
        {showErrors && !chosen ? (
          <Text
            variant="formBody"
            accessibilityRole="alert"
            testID="return-sign-error"
            style={{ color: tokens.color.feedback.danger.fg }}
          >
            {t('returns:exterior.notChosen')}
          </Text>
        ) : null}
        {hasDamageSign(signs) ? (
          <Text
            variant="caption"
            bold
            style={{ color: tokens.status.interrupted.fg }}
            testID="return-damage-hint"
          >
            {t('returns:exterior.damageHint')}
          </Text>
        ) : null}
      </View>
      <TextField
        compact
        multiline
        testID="return-exterior-note"
        label={t('returns:exterior.noteLabel')}
        placeholder={t('returns:exterior.notePlaceholder')}
        value={note}
        onChangeText={setNote}
        maxLength={MAX_NOTE}
        counterMax={MAX_NOTE}
      />
      <Card compact tone="default">
        <View style={{ gap: tokens.space.sm }}>
          <Checkbox
            testID="return-opened-before"
            label={t('returns:exterior.openedBeforeLabel')}
            checked={openedBefore}
            onChange={setOpenedBefore}
          />
          {openedBefore ? (
            <>
              <TextField
                compact
                required
                testID="return-opened-reason"
                label={t('returns:exterior.openedBeforeReasonLabel')}
                placeholder={t('returns:exterior.openedBeforePlaceholder')}
                value={reason}
                onChangeText={setReason}
                maxLength={MAX_REASON}
                {...(showErrors && reasonMissing
                  ? { error: t('returns:exterior.reasonRequired') }
                  : {})}
              />
              <Text variant="caption" color="textMuted">
                {t('returns:exterior.openedBeforeNotice')}
              </Text>
            </>
          ) : null}
        </View>
      </Card>
      <ReturnPhotosSection
        returnId={returnCase.id}
        returnCase={returnCase}
        emphasize={hasDamageSign(signs)}
        locked={confirmed}
      />
      {failure ? (
        <Text
          variant="formBody"
          accessibilityRole="alert"
          testID="return-exterior-error"
          style={{ color: tokens.color.feedback.danger.fg }}
        >
          {errorText(resolveErrorMessage(t, failure))}
        </Text>
      ) : null}
    </Screen>
  );
}
