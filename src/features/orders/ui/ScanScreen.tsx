import { useEffect, useRef, useState } from 'react';
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
import {
  BottomSheet,
  Button,
  CameraPermissionSheet,
  Icon,
  Text,
  TextField,
  useTheme,
} from '@/shared/ui';
import { layout } from '@/core/theme';

import { validateCode } from '../domain';
import { OrderMatchSheet } from './OrderMatchSheet';
import { useOrderLookup } from './use-order-lookup';

/** Cùng một mã đọc lại trong khoảng này (mili giây) bị bỏ qua: camera đọc liên tục cùng một mã. */
const REPEAT_SCAN_WINDOW_MS = 2000;
const FRAME_MAX = 260;
const FRAME_RATIO = 0.64;
const CORNER = 34;
const CORNER_THICKNESS = 4;

/**
 * UI-B02 Quét mã đơn hàng (đặc tả A02; mockup docs/assets/ui/02-home-and-scan.png). Camera thật
 * qua adapter `@/platform` (ADR-016). Quét/nhập xong TRA CỨU trong kho cục bộ rồi mở `OrderMatchSheet`
 * (một đơn / không thấy / nhiều đơn; Q-22x); không nút "Tìm", không tự tạo hay chọn đơn (bất biến 5).
 * Chống quét lặp; trong lúc hộp kết quả mở, mã mới bị bỏ qua (một mã chỉ một truy vấn). Là route cấp gốc (`/scan`) nên Back về đúng màn đứng trước khi bấm Quét (Q-16a). Ngoại lệ: chưa cấp/bị chặn quyền camera, camera không mở được
 * -> vẫn nhập tay được.
 */
export function ScanScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useAppNavigation();
  const focused = useScreenFocused();
  const touch = getMinTouchTarget();
  const permission = useScannerPermission();

  const [torch, setTorch] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [permissionDismissed, setPermissionDismissed] = useState(false);
  const lastScan = useRef<{ code: string; at: number } | null>(null);
  const handled = useRef(false);
  const match = useOrderLookup();
  const [scanInvalid, setScanInvalid] = useState(false);

  // Hộp kết quả về trạng thái nghỉ (đóng, hoặc tự ẩn vì đổi shop): lại nhận mã mới từ camera.
  useEffect(() => {
    if (match.state.kind === 'idle') handled.current = false;
  }, [match.state.kind]);

  const frame = Math.min(FRAME_MAX, Math.round(width * FRAME_RATIO));
  const trimmed = code.trim();
  const cameraReady = permission.status === 'granted' && !cameraFailed;
  // Hộp thoại xin quyền tự hiện khi chưa được cấp; đóng thì còn khung hướng dẫn ngay trên màn quét.
  const permissionPromptOpen =
    (permission.status === 'askable' || permission.status === 'blocked') &&
    !permissionDismissed &&
    !manualOpen;

  const lookup = (value: string) => {
    const checked = validateCode(value);
    if (!checked.ok) {
      setCodeError(true);
      return false;
    }
    setCodeError(false);
    setManualOpen(false);
    handled.current = true;
    void match.lookup(checked.code);
    return true;
  };

  // Đóng hộp kết quả: lại nhận mã mới; cùng mã vừa tra vẫn bị chặn trong khoảng chống lặp.
  const closeMatch = () => {
    lastScan.current = lastScan.current ? { ...lastScan.current, at: Date.now() } : null;
    handled.current = false;
    match.reset();
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
    if (!validateCode(scanned).ok) {
      // Mã camera không hợp lệ (quá dài, ký tự điều khiển): không tra cứu, không hiện "Vừa quét".
      setScanInvalid(true);
      return;
    }
    setScanInvalid(false);
    handled.current = true;
    setLastCode(scanned);
    // `handled` giữ true cho tới khi đóng hộp kết quả (closeMatch): không chồng hai hộp, mỗi mã một truy vấn.
    if (!lookup(scanned)) handled.current = false;
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
      style={[styles.root, { backgroundColor: tokens.color.camera.background }]}
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
          { paddingTop: insets.top + tokens.space.sm, paddingHorizontal: tokens.space.md },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common:actions.back')}
          onPress={navigation.back}
          style={headerButton}
        >
          <Icon name="back" size={26} color={tokens.color.camera.onCamera} />
        </Pressable>
        <Text
          variant="sectionTitle"
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.title, { color: tokens.color.camera.onCamera }]}
        >
          {t('nav:titles.UI-B02')}
        </Text>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('screens:scan.help')}
            onPress={() => navigation.push(ROUTES.help)}
            style={headerButton}
          >
            <Icon name="help" size={26} color={tokens.color.camera.onCamera} />
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
                    { borderColor: tokens.color.camera.scanAccent },
                    corner === 'tl' && styles.tl,
                    corner === 'tr' && styles.tr,
                    corner === 'bl' && styles.bl,
                    corner === 'br' && styles.br,
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.hint, { color: tokens.color.camera.onCamera }]}>
              {t('screens:scan.hint')}
            </Text>
            {scanInvalid ? (
              <Text
                testID="scan-invalid"
                variant="caption"
                bold
                accessibilityRole="alert"
                style={{ color: tokens.color.camera.onCamera }}
              >
                {t('errors:INVALID_CODE')}
              </Text>
            ) : null}
            {lastCode ? (
              <Text variant="caption" bold style={{ color: tokens.color.camera.scanAccent }}>
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

      <View style={[styles.bottomRow, { gap: tokens.space.md, marginHorizontal: tokens.space.lg }]}>
        <Pressable
          testID="scan-manual-open"
          accessibilityRole="button"
          accessibilityLabel={t('screens:scan.manualButton')}
          onPress={() => setManualOpen(true)}
          style={[
            styles.manual,
            {
              backgroundColor: tokens.color.camera.control,
              borderRadius: tokens.radius.lg,
              minHeight: Math.max(touch, layout.component.field.minHeight),
              flex: 1,
            },
          ]}
        >
          <Icon name="keyboard" size={22} color={tokens.color.camera.onCamera} />
          <Text bold style={[styles.manualLabel, { color: tokens.color.camera.onCamera }]}>
            {t('screens:scan.manualButton')}
          </Text>
          <Icon name="forward" size={20} color={tokens.color.camera.onCamera} />
        </Pressable>

        {cameraReady ? (
          <Pressable
            testID="scan-torch"
            accessibilityRole="button"
            accessibilityState={{ selected: torch }}
            accessibilityLabel={t(
              torch ? 'screens:scan.flashlightOff' : 'screens:scan.flashlightOn',
            )}
            onPress={() => setTorch((value) => !value)}
            style={[
              styles.torch,
              {
                minWidth: Math.max(touch, layout.component.field.minHeight),
                minHeight: Math.max(touch, layout.component.field.minHeight),
                backgroundColor: torch
                  ? tokens.color.camera.scanAccent
                  : tokens.color.camera.control,
                borderRadius: tokens.radius.full,
              },
            ]}
          >
            <Icon
              name={torch ? 'flash' : 'flash-off'}
              size={24}
              color={tokens.color.camera.onCamera}
            />
          </Pressable>
        ) : null}
      </View>

      <View
        style={[
          styles.tips,
          {
            backgroundColor: tokens.color.surface.raised,
            borderTopLeftRadius: tokens.radius.lg,
            borderTopRightRadius: tokens.radius.lg,
            padding: tokens.space.lg,
            paddingBottom: Math.max(insets.bottom, tokens.space.lg),
            gap: tokens.space.sm,
          },
        ]}
      >
        <View
          style={[
            styles.tipsBox,
            {
              backgroundColor: tokens.color.brand.soft,
              borderRadius: tokens.radius.md,
              padding: tokens.space.md,
              gap: tokens.space.sm,
            },
          ]}
        >
          <View style={styles.tipRow}>
            <Icon name="bulb" size={20} color={tokens.color.feedback.warning.fg} />
            <Text bold>{t('screens:scan.tips.title')}</Text>
          </View>
          {(['one', 'two', 'three'] as const).map((key) => (
            <View key={key} style={styles.tipRow}>
              <Icon name="check-circle" size={18} color={tokens.color.feedback.success.fg} />
              <Text style={styles.tipText}>{t(`screens:scan.tips.${key}`)}</Text>
            </View>
          ))}
        </View>
      </View>

      <CameraPermissionSheet
        visible={permissionPromptOpen}
        status={permission.status === 'blocked' ? 'blocked' : 'askable'}
        onClose={() => setPermissionDismissed(true)}
        onRequest={() => void permission.request()}
        onOpenSettings={() => void openAppSettings()}
        testID="scan-permission-modal"
        allowTestID="scan-permission-allow"
      />

      <OrderMatchSheet
        state={match.state}
        onClose={closeMatch}
        onRetry={(retryCode) => void match.lookup(retryCode)}
      />

      <BottomSheet
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
        title={t('screens:scan.manualTitle')}
      >
        <View style={{ gap: tokens.space.md }}>
          <TextField
            testID="scan-manual-code"
            label={t('screens:scan.manualLabel')}
            placeholder={t('screens:scan.manualPlaceholder')}
            value={code}
            onChangeText={(value) => {
              setCode(value);
              setCodeError(false);
            }}
            {...(codeError ? { error: t('errors:INVALID_CODE') } : {})}
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
  const { tokens } = useTheme();
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
    <View testID="scan-unavailable" style={[styles.unavailable, { gap: tokens.space.md }]}>
      <Icon name="scan" size={56} color={tokens.color.camera.onCamera} />
      <Text variant="sectionTitle" style={[styles.center, { color: tokens.color.camera.onCamera }]}>
        {title}
      </Text>
      {message ? (
        <Text style={[styles.center, { color: tokens.color.camera.onCameraMuted }]}>{message}</Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const corner = { position: 'absolute', width: CORNER, height: CORNER } as const;
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: layout.space.xs },
  title: { flex: 1, textAlign: 'center' },
  headerRight: { flexDirection: 'row' },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.space.lg,
    padding: layout.space.lg,
  },
  hint: { textAlign: 'center' },
  center: { textAlign: 'center' },
  unavailable: {
    alignItems: 'center', // token-exception: độ rộng tối đa của khối thông báo để dòng chữ dễ đọc, không phải kích thước thành phần
    maxWidth: 320,
  },
  corner: { ...corner, borderWidth: 0 },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: layout.component.scanFrame.cornerRadius,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: layout.component.scanFrame.cornerRadius,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: layout.component.scanFrame.cornerRadius,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: layout.component.scanFrame.cornerRadius,
  },
  manual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.space.md,
    paddingHorizontal: layout.space.lg,
  },
  manualLabel: { flex: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginBottom: layout.space.lg },
  torch: { alignItems: 'center', justifyContent: 'center' },
  tips: {},
  tipsBox: {},
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: layout.space.sm },
  tipText: { flex: 1 },
});
