export { getInputResetStyle, getKeyboardAvoidingBehavior, getMinTouchTarget } from './layout';
export { getAppVersion } from './app-info';
export { useIsOffline } from './connectivity';
export {
  useAppNavigation,
  useConfirmBeforeLeave,
  useIsScreenActive,
  useRouteParams,
  useScreenFocused,
} from './navigation';
export type { AppNavigation, RouteParams } from './navigation';
export { openAppSettings, openExternalLink } from './external-link';
export { BarcodeScannerView, useScannerPermission } from './barcode-scanner';
export type { ScannerPermission } from './barcode-scanner';
export { hideNativeSplash, holdNativeSplash } from './native-splash';
export { CameraPreview } from './camera-preview';
export { copyText } from './clipboard';
export {
  newEvidenceId,
  newOrderId,
  newOrderLineId,
  newPackageId,
  newDisputeId,
  newDisputeRecordId,
  newReturnCaseId,
  newReturnRecordId,
  newSessionId,
} from './ids';
export { shareText } from './share-text';
export { openLocalDatabase } from './local-db';
export type { SqlDatabase, SqlParam } from './sql-database';
export { subscribeAppActive } from './app-state';
export { monotonicNow } from './monotonic-clock';
export { hashFile, HASH_CHUNK_BYTES } from './file-hasher';
export type { HashFileResult } from './file-hasher';
export {
  deleteRecording,
  excludeEvidenceDirFromBackup,
  findPersistedRecording,
  getAvailableDiskBytes,
  persistRecording,
  probeEvidenceDirWritable,
  recordingExists,
  resolveRecordingUri,
} from './recording-files';
export type { DeleteRecordingResult, PersistResult } from './recording-files';
export { classifyUploadStatus, uploadFileResumable } from './resumable-upload';
export type { UploadFileResult, UploadSessionRequest } from './resumable-upload';
export { CameraPhoto, usePhotoPermission } from './camera-photo';
export type { CameraPhotoHandle, PhotoPermission, PhotoResult } from './camera-photo';
export { CameraRecorder } from './camera-recorder';
export type { CameraRecorderHandle, RecorderResult } from './camera-recorder';
export { readDeviceCondition, UNKNOWN_DEVICE_CONDITION } from './device-condition';
export type { DeviceCondition, ThermalLevel } from '@/core/device';
export {
  getDeviceLocation,
  getLocationPermission,
  LOCATION_TIMEOUT_MS,
  requestLocationPermission,
} from './location';
export type { DeviceLocationOutcome, LocationPermissionStatus } from './location';
