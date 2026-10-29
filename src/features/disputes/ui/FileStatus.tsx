import { useTranslation } from 'react-i18next';

import { toDisplayStatus, type FileState } from '@/features/evidence';
import { EvidenceStatusBadge, StatusBadge } from '@/shared/ui';

/** Nhãn trạng thái TỆP (bất biến 3): 6 nhãn chuẩn, hoặc "đang ghi/đang lưu" khi tệp chưa đóng. */
export function FileStatus({ state, testID }: { state: FileState; testID?: string }) {
  const { t } = useTranslation();
  const display = toDisplayStatus(state);
  if (display.kind === 'label') {
    return <EvidenceStatusBadge compact status={display.label} {...(testID ? { testID } : {})} />;
  }
  return <StatusBadge label={t(`evidence:capture.${display.phase}`)} tone="info" />;
}

/** Chữ trạng thái tệp (dùng trong bản tóm tắt văn bản). */
export function useFileStatusText(): (state: FileState) => string {
  const { t } = useTranslation();
  return (state) => {
    const display = toDisplayStatus(state);
    return display.kind === 'label'
      ? t(`evidence:status.${display.label}`)
      : t(`evidence:capture.${display.phase}`);
  };
}
