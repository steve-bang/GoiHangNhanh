import { useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ROUTES } from '@/core/navigation';
import {
  BarcodeScannerView,
  getMinTouchTarget,
  openAppSettings,
  useAppNavigation,
  useScannerPermission,
  useScreenFocused,
} from '@/platform';
import { BottomSheet, Button, Icon, Text, TextField, useTheme } from '@/shared/ui';

/** Cùng một mã đọc lại trong khoảng này (mili giây) bị bỏ qua: camera đọc liên tục cùng một mã. */
const REPEAT_SCAN_WINDOW_MS = 2000;
const FRAME_MAX = 260;
const FRAME_RATIO = 0.64;
const CORNER = 34;
const CORNER_THICKNESS = 4;

/**
 * UI-B02 Quét mã đơn hàng (đặc tả A02; mockup docs/assets/ui/02-home-and-scan.png). Camera thật
 * qua adapter `@/platform` (ADR-016). Quét xong TỰ tra cứu (không nút "Tìm"); chống quét lặp; mã
 * vừa quét hiện lên. Chưa có tra cứu thật: đi sang tạo đơn nhanh với mã đã quét (UI-B04) - không
 * tự chọn kết quả nào (bất biến 5). Ngoại lệ: chưa cấp/bị chặn quyền camera, camera không mở được
 * -> vẫn nhập tay được.
 */
export function ScanScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useAppNavigation();
  const focused = useScreenFocused();
  const touch = getMinTouchTarget();
  const permission = useScannerPermission();

  const [torch, setTorch] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [code, setCode] = useState('');
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const lastScan = useRef<{ code: string; at: number } | null>(null);
  const handled = useRef(false);

  const frame = Math.min(FRAME_MAX, Math.round(width * FRAME_RATIO));
  const trimmed = code.trim();
  const cameraReady = permission.status === 'granted' && !cameraFailed;

  const lookup = (value: string) => {
    setManualOpen(false);
    navigation.push(ROUTES.quickOrder, { code: value });
  };

  const onScan = (scanned: string) => {
    const now = Date.now();
    const previous = lastScan.current;
    if (
      handled.current ||
      (previous && previous.code === scanned && now - previous.at < REPEAT_SCAN_WINDOW_MS)
    ) {
      return;
    }
    lastScan.current = { code: scanned, at: now };
    handled.current = true;
    setLastCode(scanned);
    lookup(scanned);
    // Mở khóa sau khoảng chống lặp: quay lại màn quét thì quét được mã tiếp theo.
    setTimeout(() => {
      handled.current = false;
    }, REPEAT_SCAN_WINDOW_MS);
  };

  const headerButton = {
    minWidth: touch,
    minHeight: touch,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  return (
    <View
      testID="screen-UI-B02"
      style={[styles.root, { backgroundColor: colors.cameraBackground }]}
    >
      {cameraReady && focused ? (
        <BarcodeScannerView
          testID="scan-camera"
          torch={torch}
          onScan={onScan}
          onError={() => setCameraFailed(true)}
        />
      ) : null}

      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common:actions.back')}
          onPress={navigation.back}
          style={headerButton}
        >
          <Icon name="back" size={26} color={colors.onCamera} />
        </Pressable>
        <Text
          variant="sectionTitle"
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.title, { color: colors.onCamera }]}
        >
          {t('nav:titles.UI-B02')}
        </Text>
        <View style={styles.headerRight}>
          {cameraReady ? (
            <Pressable
              testID="scan-torch"
              accessibilityRole="button"
              accessibilityState={{ selected: torch }}
              accessibilityLabel={t(
                torch ? 'screens:scan.flashlightOff' : 'screens:scan.flashlightOn',
              )}
              onPress={() => setTorch((value) => !value)}
              style={headerButton}
            >
              <Icon name={torch ? 'flash' : 'flash-off'} size={24} color={colors.onCamera} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('screens:scan.help')}
            onPress={() => navigation.push(ROUTES.help)}
            style={headerButton}
          >
            <Icon name="help" size={26} color={colors.onCamera} />
          </Pressable>
        </View>
      </View>

      <View style={styles.middle}>
        {cameraReady ? (
          <>
            <View
              testID="scan-frame"
              style={{ width: frame, height: frame }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                <View
                  key={corner}
                  style={[
                    styles.corner,
                    { borderColor: colors.scanAccent },
                    corner === 'tl' && styles.tl,
                    corner === 'tr' && styles.tr,
                    corner === 'bl' && styles.bl,
                    corner === 'br' && styles.br,
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.hint, { color: colors.onCamera }]}>{t('screens:scan.hint')}</Text>
            {lastCode ? (
              <Text variant="caption" bold style={{ color: colors.scanAccent }}>
                {t('screens:scan.lastScanned', { code: lastCode })}
              </Text>
            ) : null}
          </>
        ) : (
          <ScanUnavailable
            status={permission.status}
            cameraFailed={cameraFailed}
            onRequest={() => void permission.request()}
            onOpenSettings={() => void openAppSettings()}
          />
        )}
      </View>

      <Pressable
        testID="scan-manual-open"
        accessibilityRole="button"
        accessibilityLabel={t('screens:scan.manualButton')}
        onPress={() => setManualOpen(true)}
        style={[
          styles.manual,
          {
            backgroundColor: colors.cameraControl,
            borderRadius: radius.lg,
            minHeight: Math.max(touch, 52),
            marginHorizontal: spacing.lg,
          },
        ]}
      >
        <Icon name="keyboard" size={22} color={colors.onCamera} />
        <Text bold style={[styles.manualLabel, { color: colors.onCamera }]}>
          {t('screens:scan.manualButton')}
        </Text>
        <Icon name="forward" size={20} color={colors.onCamera} />
      </Pressable>

      <View
        style={[
          styles.tips,
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing.lg,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            gap: spacing.sm,
          },
        ]}
      >
        <View
          style={[
            styles.tipsBox,
            {
              backgroundColor: colors.brandSoft,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: spacing.sm,
            },
          ]}
        >
          <View style={styles.tipRow}>
            <Icon name="bulb" size={20} color={colors.warning} />
            <Text bold>{t('screens:scan.tips.title')}</Text>
          </View>
          {(['one', 'two', 'three'] as const).map((key) => (
            <View key={key} style={styles.tipRow}>
              <Icon name="check-circle" size={18} color={colors.success} />
              <Text style={styles.tipText}>{t(`screens:scan.tips.${key}`)}</Text>
            </View>
          ))}
        </View>
      </View>

      <BottomSheet
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
        title={t('screens:scan.manualTitle')}
      >
        <View style={{ gap: spacing.md }}>
          <TextField
            testID="scan-manual-code"
            label={t('screens:scan.manualLabel')}
            placeholder={t('screens:scan.manualPlaceholder')}
            value={code}
            onChangeText={setCode}
            returnKeyType="search"
            autoCapitalize="characters"
            onSubmitEditing={() => {
              if (trimmed.length > 0) lookup(trimmed);
            }}
          />
          <Button
            testID="scan-manual-lookup"
            label={t('screens:scan.lookup')}
            disabled={trimmed.length === 0}
            onPress={() => lookup(trimmed)}
          />
          <Button
            variant="secondary"
            icon="search"
            label={t('screens:scan.savedOrders')}
            onPress={() => {
              setManualOpen(false);
              navigation.push(ROUTES.search);
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

function ScanUnavailable({
  status,
  cameraFailed,
  onRequest,
  onOpenSettings,
}: {
  status: 'checking' | 'granted' | 'askable' | 'blocked';
  cameraFailed: boolean;
  onRequest: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  let title: string;
  let message: string;
  let action: { label: string; onPress: () => void } | null = null;
  if (cameraFailed) {
    title = t('screens:scan.cameraError.title');
    message = t('screens:scan.cameraError.message');
  } else if (status === 'blocked') {
    title = t('screens:scan.permission.blockedTitle');
    message = t('screens:scan.permission.blockedMessage');
    action = { label: t('screens:scan.permission.blockedAction'), onPress: onOpenSettings };
  } else if (status === 'askable') {
    title = t('screens:scan.permission.askTitle');
    message = t('screens:scan.permission.askMessage');
    action = { label: t('screens:scan.permission.askAction'), onPress: onRequest };
  } else {
    title = t('screens:scan.permission.checking');
    message = '';
  }
  return (
    <View testID="scan-unavailable" style={[styles.unavailable, { gap: spacing.md }]}>
      <Icon name="scan" size={56} color={colors.onCamera} />
      <Text variant="sectionTitle" style={[styles.center, { color: colors.onCamera }]}>
        {title}
      </Text>
      {message ? (
        <Text style={[styles.center, { color: colors.onCameraMuted }]}>{message}</Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const corner = { position: 'absolute', width: CORNER, height: CORNER } as const;
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { flex: 1, textAlign: 'center' },
  headerRight: { flexDirection: 'row' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 },
  hint: { textAlign: 'center' },
  center: { textAlign: 'center' },
  unavailable: { alignItems: 'center', maxWidth: 320 },
  corner: { ...corner, borderWidth: 0 },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 14,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 14,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 14,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 14,
  },
  manual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  manualLabel: { flex: 1 },
  tips: {},
  tipsBox: {},
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipText: { flex: 1 },
});
