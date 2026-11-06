import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BarcodeScannerView, openAppSettings, useScannerPermission } from '@/platform';
import { Button, Text, useTheme } from '@/shared/ui';

/** Cùng một mã đọc lại trong khoảng này (mili giây) bị bỏ qua: camera đọc liên tục cùng một mã. */
const REPEAT_SCAN_WINDOW_MS = 2000;

/**
 * Khung quét mã trên kiện hoàn của UI-D02 (đặc tả B02). Chỉ ĐỌC mã rồi báo ra ngoài: màn gọi tự tra cứu
 * và hỏi lại người dùng, panel này không tạo, không ghép, không chọn đơn (CLAUDE.md #5). Không có quyền
 * camera hoặc camera không mở được thì báo rõ và luôn có lối "Nhập tay" (đóng panel, ô nhập vẫn còn).
 */
export function ReturnScanPanel({
  onScan,
  onClose,
}: {
  onScan: (code: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const permission = useScannerPermission();
  const [cameraFailed, setCameraFailed] = useState(false);
  const last = useRef<{ code: string; at: number } | null>(null);
  const done = useRef(false);

  const handle = (code: string) => {
    const now = Date.now();
    const previous = last.current;
    if (
      done.current ||
      (previous && previous.code === code && now - previous.at < REPEAT_SCAN_WINDOW_MS)
    )
      return;
    last.current = { code, at: now };
    done.current = true;
    onScan(code);
  };

  const ready = permission.status === 'granted' && !cameraFailed;
  return (
    <View style={{ gap: tokens.space.sm }} testID="return-scan-panel">
      {ready ? (
        <>
          <View
            style={{
              height: tokens.component.scanPanel.height,
              overflow: 'hidden',
              borderRadius: tokens.radius.md,
              backgroundColor: tokens.color.camera.background,
            }}
          >
            <BarcodeScannerView
              testID="return-scan-camera"
              onScan={handle}
              onError={() => setCameraFailed(true)}
            />
          </View>
          <Text variant="caption" color="textMuted">
            {t('returns:find.scanHint')}
          </Text>
        </>
      ) : (
        <View style={{ gap: tokens.space.sm }} testID="return-scan-unavailable">
          <Text variant="formBody" accessibilityRole="alert">
            {cameraFailed
              ? t('screens:scan.cameraError.message')
              : permission.status === 'checking'
                ? t('screens:scan.permission.checking')
                : permission.status === 'blocked'
                  ? t('screens:scan.permission.blockedMessage')
                  : t('screens:scan.permission.askMessage')}
          </Text>
          {!cameraFailed && permission.status === 'askable' ? (
            <Button
              testID="return-scan-allow"
              size="compact"
              label={t('screens:scan.permission.askAction')}
              onPress={() => void permission.request()}
            />
          ) : null}
          {!cameraFailed && permission.status === 'blocked' ? (
            <Button
              testID="return-scan-settings"
              size="compact"
              label={t('screens:scan.permission.blockedAction')}
              onPress={() => void openAppSettings()}
            />
          ) : null}
        </View>
      )}
      <Button
        testID="return-scan-manual"
        variant="secondary"
        size="compact"
        label={t('returns:find.scanManual')}
        onPress={onClose}
      />
    </View>
  );
}
