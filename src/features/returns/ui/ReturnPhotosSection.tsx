import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import type { ErrorCode } from '@/core/errors/codes';
import type { ReturnCaseId } from '@/core/ids';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { mayHaveReachedServer, toDisplayStatus } from '@/features/evidence';
import { formatDeviceDateTime } from '@/features/orders';
import {
  CameraPhoto,
  getMinTouchTarget,
  openAppSettings,
  requestLocationPermission,
  resolveRecordingUri,
  usePhotoPermission,
  type CameraPhotoHandle,
} from '@/platform';
import {
  AppThemeScope,
  Button,
  Card,
  ConfirmDialog,
  EvidenceStatusBadge,
  Icon,
  Text,
  useTheme,
  useToast,
} from '@/shared/ui';

import {
  describeLocation,
  isMediaSavedLocally,
  MAX_RETURN_PHOTOS,
  type PhotoDeleteFailure,
  type PhotoFailure,
  type ReturnMedia,
} from '../domain';
import { useCaptureReturnPhoto, useDeleteReturnPhoto, useReturnMedia } from './use-return-photos';

const FAILURE_CODE: Record<Exclude<PhotoFailure, 'LIMIT_REACHED'>, ErrorCode> = {
  ALREADY_CONFIRMED: 'RETURN_ALREADY_CONFIRMED',
  CAPTURE_FAILED: 'RETURN_PHOTO_FAILED',
  STORAGE_FULL: 'RETURN_PHOTO_STORAGE_FULL',
  FILE_UNREADABLE: 'RETURN_PHOTO_FAILED',
  SAVE_FAILED: 'RETURN_PHOTO_FAILED',
};

const DELETE_FAILURE_CODE: Record<Exclude<PhotoDeleteFailure, 'NOT_FOUND'>, ErrorCode> = {
  ALREADY_CONFIRMED: 'RETURN_ALREADY_CONFIRMED',
  IN_USE: 'RETURN_PHOTO_IN_USE',
  RECORD_DELETE_FAILED: 'RETURN_PHOTO_DELETE_FAILED',
};

interface ReturnPhotosSectionProps {
  returnId: ReturnCaseId;
  /** Có dấu hiệu hư hỏng: nút chụp nổi bật hơn (vẫn là tùy chọn). */
  emphasize: boolean;
  /** Hồ sơ đã xác nhận: không chụp thêm. */
  locked: boolean;
}

/**
 * Ảnh kiện hàng ở D03 (R2a). TÙY CHỌN, tối đa `MAX_RETURN_PHOTOS`. Có nút Xóa cho ảnh chụp nhầm khi hồ sơ chưa xác nhận (NGOẠI LỆ
 * của bất biến 4, Q-26j): có hộp thoại xác nhận; ảnh đang trong hồ sơ tranh chấp thì bị từ chối.
 * Mỗi ảnh hiện nhãn theo trạng thái tệp THẬT (Đã lưu trên máy -> Đang tải lên -> Đã tải lên -> Đã xác
 * minh, hoặc Lỗi); chỉ video/ảnh nào máy chủ xác nhận mới được nói đã tải lên/xác minh. Giờ hiển thị là giờ
 * máy; mã băm chỉ chứng minh tệp không đổi, không chứng minh thời điểm chụp.
 */
export function ReturnPhotosSection({ returnId, emphasize, locked }: ReturnPhotosSectionProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { photos: media, reload } = useReturnMedia(returnId);
  const capture = useCaptureReturnPhoto(returnId);
  const removePhoto = useDeleteReturnPhoto();
  const toast = useToast();
  const permission = usePhotoPermission();
  const handleRef = useRef<CameraPhotoHandle | null>(null);
  const [open, setOpen] = useState(false);
  const [wantsCamera, setWantsCamera] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ErrorCode | null>(null);
  const [lastSaved, setLastSaved] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ReturnMedia | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailure, setDeleteFailure] = useState<ErrorCode | null>(null);

  const saved = (media ?? []).filter(isMediaSavedLocally);
  const full = saved.length >= MAX_RETURN_PHOTOS;
  const granted = permission.status === 'granted';

  // Người dùng đã bấm "Chụp ảnh" và quyền vừa được cấp: mở camera.
  useEffect(() => {
    if (wantsCamera && granted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mở camera ngay khi quyền được cấp
      setOpen(true);
      setWantsCamera(false);
    }
  }, [wantsCamera, granted]);

  const start = () => {
    setFailure(null);
    setLastSaved(false);
    setReady(false);
    if (granted) setOpen(true);
    else setWantsCamera(true);
  };

  // Camera vừa mở: xin quyền vị trí "khi đang dùng app" (một lần, không chặn chụp). Từ chối vẫn chụp được;
  // ảnh ghi "Không có vị trí" kèm lý do.
  useEffect(() => {
    if (open) void requestLocationPermission();
  }, [open]);

  const close = () => {
    setOpen(false);
    setWantsCamera(false);
    void reload();
  };

  const shoot = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setFailure(null);
    setLastSaved(false);
    const outcome = await capture(handleRef);
    setBusy(false);
    await reload();
    if (outcome.kind === 'saved') {
      setLastSaved(true);
      return;
    }
    const reason = outcome.reason;
    if (reason === 'LIMIT_REACHED') {
      close();
      return;
    }
    setFailure(FAILURE_CODE[reason]);
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    if (!target || deleting) return;
    setDeleting(true);
    const outcome = await removePhoto(target.id);
    setDeleting(false);
    setPendingDelete(null);
    await reload();
    if (outcome.kind === 'deleted') {
      setDeleteFailure(null);
      toast.show(t('returns:photos.deleteDone'), { tone: 'success' });
    } else if (outcome.reason !== 'NOT_FOUND') {
      setDeleteFailure(DELETE_FAILURE_CODE[outcome.reason]);
    }
  };

  const touch = getMinTouchTarget();
  const prompting = wantsCamera && !granted;
  const permissionBlocked = permission.status === 'blocked';

  return (
    <View style={{ gap: tokens.space.xs }} testID="return-photos">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm }}>
        <Text variant="formButton" accessibilityRole="header" style={{ flex: 1 }}>
          {t('returns:photos.title')}
        </Text>
        <Text variant="caption" color="textMuted" testID="return-photos-count">
          {t('returns:photos.count', { count: saved.length, max: MAX_RETURN_PHOTOS })}
        </Text>
      </View>
      <Text variant="caption" color="textMuted">
        {t('returns:photos.hint')}
      </Text>
      <Text variant="caption" color="textMuted" testID="return-photos-location-note">
        {t('returns:photos.locationNote')}
      </Text>
      {emphasize && !full && !locked ? (
        <Text
          variant="caption"
          bold
          style={{ color: tokens.status.interrupted.fg }}
          testID="return-photos-damage-hint"
        >
          {t('returns:photos.damageHint')}
        </Text>
      ) : null}

      {media === null ? null : media.length === 0 ? (
        <Text variant="formBody" color="inkMuted" testID="return-photos-empty">
          {t('returns:photos.empty')}
        </Text>
      ) : (
        <Card compact flush>
          <View>
            {media.map((item) => (
              <PhotoRow
                key={item.id}
                item={item}
                busy={busy}
                // Ảnh đã từng được đưa cho máy chủ thì không xóa được (Q-28): ẩn nút thay vì để bấm rồi lỗi.
                {...(locked || busy || deleting || mayHaveReachedServer(item)
                  ? {}
                  : {
                      onDelete: () => {
                        setDeleteFailure(null);
                        setPendingDelete(item);
                      },
                    })}
              />
            ))}
          </View>
        </Card>
      )}

      {deleteFailure ? (
        <Card compact tone="warning" testID="return-photo-delete-error">
          <Text variant="formBody" accessibilityRole="alert">
            {errorText(resolveErrorMessage(t, deleteFailure))}
          </Text>
        </Card>
      ) : null}

      {locked ? null : full ? (
        <Text variant="caption" color="textMuted" testID="return-photos-full">
          {t('returns:photos.full', { max: MAX_RETURN_PHOTOS })}
        </Text>
      ) : (
        <Button
          testID="return-photo-capture"
          label={t(saved.length === 0 ? 'returns:photos.capture' : 'returns:photos.captureMore')}
          variant={emphasize ? 'primary' : 'secondary'}
          size="compact"
          icon="camera"
          onPress={start}
        />
      )}

      {prompting ? (
        <Card compact tone="warning" testID="return-photo-permission">
          <View style={{ gap: tokens.space.sm }}>
            <Text variant="formBody">
              {t(
                permissionBlocked
                  ? 'returns:photos.permissionBlocked'
                  : 'returns:photos.permissionAsk',
              )}
            </Text>
            <Button
              testID={permissionBlocked ? 'return-photo-open-settings' : 'return-photo-allow'}
              label={t(
                permissionBlocked ? 'returns:photos.openSettings' : 'returns:photos.allowCamera',
              )}
              size="compact"
              variant="secondary"
              onPress={() =>
                permissionBlocked ? void openAppSettings() : void permission.request()
              }
            />
          </View>
        </Card>
      ) : null}

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={t('returns:photos.deleteTitle')}
        message={t('returns:photos.deleteMessage')}
        cancelLabel={t('returns:photos.deleteCancel')}
        confirmLabel={t('returns:photos.deleteConfirm')}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        messageTestID="return-photo-delete-message"
        confirmTestID="return-photo-delete-confirm"
      />

      <Modal visible={open} animationType="slide" onRequestClose={close} statusBarTranslucent>
        <AppThemeScope>
          <View
            testID="return-photo-camera"
            style={[styles.root, { backgroundColor: tokens.color.camera.background }]}
          >
            <CameraPhoto
              handleRef={handleRef}
              onReady={() => setReady(true)}
              onError={() => {
                setReady(false);
                setFailure('RETURN_CAMERA_UNAVAILABLE');
              }}
            />
            <View
              style={[
                styles.overlay,
                { padding: tokens.space.md, paddingBottom: tokens.space.lg, gap: tokens.space.sm },
              ]}
              pointerEvents="box-none"
            >
              <Pressable
                testID="return-photo-close"
                accessibilityRole="button"
                accessibilityLabel={t('returns:photos.closeCamera')}
                onPress={close}
                style={{ minWidth: touch, minHeight: touch, justifyContent: 'center' }}
              >
                <Icon name="close" size={tokens.icon.xl} color={tokens.color.camera.onCamera} />
              </Pressable>
              <View style={styles.spacer} pointerEvents="none" />
              {failure ? (
                <View
                  accessibilityRole="alert"
                  testID="return-photo-error"
                  style={{
                    backgroundColor: tokens.color.camera.control,
                    borderRadius: tokens.radius.md,
                    padding: tokens.space.sm,
                  }}
                >
                  <Text variant="overlay" style={{ color: tokens.color.camera.onCamera }}>
                    {errorText(resolveErrorMessage(t, failure))}
                  </Text>
                </View>
              ) : lastSaved ? (
                <View
                  testID="return-photo-saved"
                  style={{
                    backgroundColor: tokens.color.camera.control,
                    borderRadius: tokens.radius.md,
                    padding: tokens.space.sm,
                  }}
                >
                  <Text variant="overlay" style={{ color: tokens.color.camera.onCamera }}>
                    {t('returns:photos.savedOnDevice', {
                      count: saved.length,
                      max: MAX_RETURN_PHOTOS,
                    })}
                  </Text>
                </View>
              ) : (
                <Text
                  variant="overlay"
                  style={{ color: tokens.color.camera.onCamera, textAlign: 'center' }}
                >
                  {t('returns:photos.guidance')}
                </Text>
              )}
              <View style={styles.shutterRow}>
                <Pressable
                  testID="return-photo-shutter"
                  accessibilityRole="button"
                  accessibilityLabel={t('returns:photos.shutter')}
                  accessibilityState={{ disabled: busy || !ready, busy }}
                  disabled={busy || !ready}
                  onPress={() => void shoot()}
                  style={{
                    width: tokens.component.record.stopOuter,
                    height: tokens.component.record.stopOuter,
                    borderRadius: tokens.radius.full,
                    borderWidth: tokens.component.record.stopRing,
                    borderColor: tokens.color.camera.onCamera,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: busy || !ready ? tokens.opacity.disabled : 1,
                  }}
                >
                  <View
                    style={{
                      width: tokens.component.record.stopInner,
                      height: tokens.component.record.stopInner,
                      borderRadius: tokens.radius.full,
                      backgroundColor: tokens.color.camera.onCamera,
                    }}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        </AppThemeScope>
      </Modal>
    </View>
  );
}

function PhotoRow({
  item,
  busy,
  onDelete,
}: {
  item: ReturnMedia;
  busy: boolean;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const side = tokens.component.tile.xl;
  const display = toDisplayStatus(item.state);
  const hasFile = isMediaSavedLocally(item) && item.localPath !== null;
  return (
    <View
      testID={`return-photo-${item.id}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space.sm,
        padding: tokens.space.sm,
      }}
    >
      <View
        style={{
          width: side,
          height: side,
          borderRadius: tokens.radius.sm,
          overflow: 'hidden',
          backgroundColor: tokens.color.surface.muted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {hasFile ? (
          <Image
            testID={`return-photo-thumb-${item.id}`}
            source={{ uri: resolveRecordingUri(item.localPath ?? '') }}
            style={{ width: side, height: side }}
            accessibilityIgnoresInvertColors
            accessibilityLabel={t('returns:photos.thumbLabel')}
          />
        ) : (
          <Icon name="camera" size={tokens.icon.lg} color={tokens.color.text.secondary} />
        )}
      </View>
      <View style={{ flex: 1, gap: tokens.space.xxs }}>
        <Text variant="caption" color="textMuted">
          {t('returns:photos.takenAt', { time: formatDeviceDateTime(item.createdAtDevice) })}
        </Text>
        {display.kind === 'label' ? (
          <EvidenceStatusBadge
            compact
            status={display.label}
            testID={`return-photo-status-${item.id}`}
          />
        ) : (
          <Text variant="caption" testID={`return-photo-status-${item.id}`}>
            {t(busy ? 'returns:photos.saving' : 'returns:photos.unfinished')}
          </Text>
        )}
        {hasFile ? (
          <Text variant="caption" color="textMuted" testID={`return-photo-location-${item.id}`}>
            {locationText(t, item)}
          </Text>
        ) : null}
        {display.kind === 'label' && display.label === 'error' ? (
          <Text variant="caption" color="textMuted">
            {t('returns:photos.failedItem')}
          </Text>
        ) : null}
        {onDelete ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              testID={`return-photo-delete-${item.id}`}
              label={t('returns:photos.delete')}
              variant="destructive"
              outlined
              size="slim"
              onPress={onDelete}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Dòng vị trí của một ảnh: KHÔNG hiện tọa độ thô, không nói "đã xác thực". */
function locationText(t: TFunction, item: ReturnMedia): string {
  const view = describeLocation(item);
  if (view.kind === 'has') {
    return view.accuracyM === null
      ? t('returns:photos.location.hasNoAccuracy')
      : t('returns:photos.location.has', { meters: view.accuracyM });
  }
  return t('returns:photos.location.none', {
    reason: t(`returns:photos.location.reasons.${view.reason}`),
  });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: StyleSheet.absoluteFill,
  spacer: { flex: 1 },
  shutterRow: { alignItems: 'center' },
});
