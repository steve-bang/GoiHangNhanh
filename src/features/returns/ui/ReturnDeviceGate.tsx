import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { runPrecheck, type PrecheckResult } from '@/features/packing';
import {
  readDeviceCondition,
  UNKNOWN_DEVICE_CONDITION,
  useAppNavigation,
  type DeviceCondition,
} from '@/platform';
import { Button, Card, Icon, Screen, Text, useTheme } from '@/shared/ui';

/** Đọc pin treo quá hạn này thì coi là "không biết" (không chặn quay), như UI-C02. */
const DEVICE_READ_TIMEOUT_MS = 3000;

/**
 * Cổng kiểm máy trước khi quay video mở kiện (UI-D04, đặc tả B04: "dùng chung kiểm tra kỹ thuật của A04").
 * Dùng CHUNG `runPrecheck` của đóng gói, nhưng chỉ phần pin/nhiệt độ: quyền camera và dung lượng đã có
 * chỗ xử lý riêng ở màn quay. Pin thấp khi không sạc (hoặc máy quá nóng, khi có nguồn đo) thì CHẶN mở
 * camera, nói rõ cách xử lý. Không đọc được pin thì KHÔNG chặn (không đoán). Bị chặn không làm mất hồ sơ:
 * có "Kiểm tra lại", "Lưu tạm, quay sau" (về danh sách, hồ sơ giữ nguyên) và ghi nhận lý do chưa có video
 * (không ép hủy hồ sơ; không có đường bỏ qua rồi coi như đã kiểm). Câu chữ `BATTERY_LOW`/`DEVICE_OVERHEATED`
 * còn chờ BA duyệt (C-1). Chưa kiểm chứng trên thiết bị.
 */
export function ReturnDeviceGate({
  children,
  onNoteReason,
  toList,
  sheet,
}: {
  children: ReactNode;
  onNoteReason: () => void;
  toList: () => void;
  sheet: ReactNode;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const [round, setRound] = useState(0);
  const [outcome, setOutcome] = useState<{ round: number; result: PrecheckResult } | null>(null);
  // Đã cho qua một lần thì giữ nguyên: tránh gỡ camera đang quay nếu pin tụt sau đó.
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    if (passed) return undefined;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unknown = new Promise<DeviceCondition>((resolve) => {
      timer = setTimeout(() => resolve(UNKNOWN_DEVICE_CONDITION), DEVICE_READ_TIMEOUT_MS);
    });
    void Promise.race([readDeviceCondition(), unknown])
      .catch(() => UNKNOWN_DEVICE_CONDITION)
      .then((device) => {
        clearTimeout(timer);
        if (!alive) return;
        const result = runPrecheck({
          camera: 'granted',
          freeBytes: null,
          canWrite: () => true,
          device,
        });
        if (result.status === 'ready') setPassed(true);
        setOutcome({ round, result });
      });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [passed, round]);

  const result: PrecheckResult = outcome?.round === round ? outcome.result : { status: 'pending' };

  if (passed || result.status === 'ready') return <>{children}</>;

  if (result.status === 'pending') {
    return (
      <Screen title={t('nav:titles.UI-D04')} onBack={navigation.back} testID="screen-UI-D04">
        <Text color="textMuted" testID="return-device-checking">
          {t('screens:precheck.checking')}
        </Text>
      </Screen>
    );
  }

  const issues = result.status === 'blocked' ? result.issues : [];
  return (
    <>
      <Screen
        title={t('nav:titles.UI-D04')}
        onBack={navigation.back}
        testID="screen-UI-D04"
        footer={
          <>
            <Button
              testID="return-device-recheck"
              label={t('screens:precheck.recheck')}
              onPress={() => {
                setOutcome(null);
                setRound((value) => value + 1);
              }}
            />
            <Button
              testID="return-device-later"
              variant="secondary"
              label={t('returns:record.live.saveForLater')}
              onPress={toList}
            />
            <Button
              testID="return-device-note-reason"
              variant="secondary"
              label={t('returns:record.live.noteReason')}
              onPress={onNoteReason}
            />
          </>
        }
      >
        <Text>{t('screens:precheck.intro')}</Text>
        <View style={{ gap: tokens.space.sm }}>
          {issues.map((issue) => (
            <Card key={issue.id} tone="warning" testID={`return-device-issue-${issue.id}`}>
              <View
                style={{ flexDirection: 'row', gap: tokens.space.md, alignItems: 'flex-start' }}
              >
                <Icon name="alert" size={tokens.icon.lg} color={tokens.status.interrupted.fg} />
                <Text accessibilityRole="alert" style={{ flex: 1, flexShrink: 1 }}>
                  {t(`errors:${issue.code}`)}
                </Text>
              </View>
            </Card>
          ))}
        </View>
        <Text variant="caption" color="textMuted">
          {t('returns:record.live.deviceKept')}
        </Text>
      </Screen>
      {sheet}
    </>
  );
}
