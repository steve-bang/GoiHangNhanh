import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useEvidenceTotals, WifiOnlySwitch } from '@/features/upload';
import { useAppNavigation } from '@/platform';
import { Button, Card, ListGroup, ListItem, MetricTile, Screen, Text, useTheme } from '@/shared/ui';

/**
 * Quản lý dữ liệu bằng chứng (PER-11; board 07 khung 11), route con của UI-I01 (Q-21b). Số đếm THẬT tệp
 * của cửa hàng đang dùng trên máy này (V1-10; `upload/domain/evidence-stats.ts`); đang đọc/đọc lỗi hiện
 * "–", không số giả (Q-21y). Phần giải thích nói rõ "Trên thiết bị" chưa phải bản sao lưu và "Trên đám
 * mây" chỉ tính tệp máy chủ đã kiểm tra khớp (bất biến 3). Công tắc "Chỉ tải khi có Wi‑Fi" (V1-09) dùng
 * chung cài đặt máy với Trung tâm đồng bộ.
 */
export function EvidenceDataScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { state } = useEvidenceTotals();
  const value = (key: 'total' | 'onDevice' | 'pending' | 'cloud') =>
    state.kind === 'ready' ? state.data[key] : t('personal:evidenceOverview.unknown');
  return (
    <Screen
      title={t('nav:subTitles.evidenceData')}
      onBack={navigation.back}
      testID="screen-UI-I01-evidence"
      contentGap={tokens.space.lg}
    >
      <Card testID="evidence-total">
        <MetricTile
          layout="row"
          icon="clipboard"
          label={t('personal:evidenceData.total')}
          value={value('total')}
          testID="evidence-total-metric"
        />
      </Card>
      <ListGroup>
        <MetricTile
          layout="row"
          icon="device-saved"
          label={t('personal:evidenceOverview.onDevice')}
          value={value('onDevice')}
          testID="evidence-on-device"
        />
        <MetricTile
          layout="row"
          icon="sync"
          tone="warning"
          label={t('personal:evidenceOverview.pendingSync')}
          value={value('pending')}
          testID="evidence-pending-sync"
        />
        <MetricTile
          layout="row"
          icon="cloud"
          tone="blue"
          label={t('personal:evidenceOverview.cloud')}
          value={value('cloud')}
          testID="evidence-cloud"
        />
      </ListGroup>
      <View style={{ gap: tokens.space.xs }} testID="evidence-explain">
        {state.kind === 'error' ? (
          <Text variant="caption" color="textMuted" testID="evidence-load-error">
            {t('personal:evidenceData.loadError')}
          </Text>
        ) : null}
        <Text variant="caption" color="textMuted">
          {t('personal:evidenceData.scope')}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('personal:evidenceData.explainOnDevice')}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('personal:evidenceData.explainPending')}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('personal:evidenceData.explainCloud')}
        </Text>
      </View>
      <ListGroup>
        <WifiOnlySwitch testID="evidence-wifi-only" />
      </ListGroup>
      <ListGroup>
        <ListItem
          leadingIcon="clock"
          title={t('personal:evidenceData.retentionRow')}
          titleWeight="regular"
          onPress={() => navigation.push(ROUTES.retentionDetail)}
          testID="evidence-retention-link"
        />
      </ListGroup>
      <Button
        label={t('personal:evidenceData.openSync')}
        onPress={() => navigation.push(ROUTES.sync)}
        testID="evidence-open-sync"
      />
    </Screen>
  );
}
