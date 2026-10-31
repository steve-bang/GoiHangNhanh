import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDeviceSetting } from '@/features/orders';
import { useConnectivity } from '@/platform';
import { Switch, useToast } from '@/shared/ui';

import { UPLOAD_WIFI_ONLY, uploadNetworkGate, type UploadNetworkGate } from '../domain';

/**
 * Hàng đợi tải lên có được dùng mạng hiện tại không, cho màn hình (V1-09). Lúc cài đặt chưa nạp xong
 * (vài mili giây khi mở màn) coi như công tắc tắt để không nháy câu "Đang chờ Wi‑Fi"; hàng đợi thì
 * vẫn chờ tới khi nạp xong (`UploadRunner`).
 */
export function useUploadNetworkGate(): UploadNetworkGate {
  const network = useConnectivity();
  const { value, loaded } = useDeviceSetting(UPLOAD_WIFI_ONLY);
  return uploadNetworkGate(network, loaded ? value : false);
}

/**
 * Công tắc "Chỉ tải khi có Wi‑Fi" (Q-24c = B): mặc định tắt = luôn tải, kể cả 4G/5G. Lưu trên máy
 * (`device_settings`); ghi lỗi thì báo và giữ giá trị cũ. Dùng ở UI-F01 và màn Dữ liệu bằng chứng.
 */
export function WifiOnlySwitch({ testID = 'wifi-only-switch' }: { testID?: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { value, loaded, setValue } = useDeviceSetting(UPLOAD_WIFI_ONLY);
  const [saving, setSaving] = useState(false);
  const change = async (next: boolean) => {
    setSaving(true);
    try {
      await setValue(next);
    } catch {
      toast.show(t('screens:sync.wifiOnly.saveFailed'), { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Switch
      label={t('screens:sync.wifiOnly.label')}
      description={t('screens:sync.wifiOnly.description')}
      icon="wifi"
      value={value}
      onValueChange={(next) => void change(next)}
      disabled={!loaded || saving}
      testID={testID}
    />
  );
}
