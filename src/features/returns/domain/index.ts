export * from './types';
export * from './return-store';
export { EXTERIOR_SIGNS, hasDamageSign, isExteriorChosen, toggleExteriorSign } from './exterior';
export { compareLine, isLineComplete, suggestDiscrepancyKinds } from './compare';
export type { LineComparison } from './compare';
export { evidenceLimits, hasOpeningEvidenceLimit } from './evidence-limits';
export type { EvidenceLimit } from './evidence-limits';
export { matchesFilter, stageOf } from './return-stage';
export type { ReturnFilter, ReturnStage } from './return-stage';
export { blankReceivedLine, buildNewReturn, expectedLinesFromOrder } from './build-return';
export type { BuildNewReturnParams, RecordIdFactory } from './build-return';
export {
  assertCanConfirm,
  assertEditable,
  formatReturnCode,
  statusAfterExterior,
  statusAfterLines,
  statusAfterVideoStep,
} from './return-rules';
export {
  applyMediaEvent,
  applyMediaLocation,
  assertMediaDeletable,
  describeLocation,
  isMediaSavedLocally,
  LOCATION_STATUSES,
  summarizeMediaSync,
  MAX_RETURN_PHOTOS,
} from './media';
export { capturePhoto } from './photo-controller';
export { deletePhoto } from './photo-delete';
export type {
  PhotoDeleteFailure,
  PhotoDeleteOutcome,
  PhotoDeletePorts,
  RemoveFileOutcome,
} from './photo-delete';
export type { LocateOutcome, PhotoFailure, PhotoOutcome, PhotoPorts } from './photo-controller';
export type {
  DeleteMediaResult,
  LocationDisplay,
  LocationStatus,
  MediaEventError,
  MediaEventResult,
  MediaSyncSummary,
  MediaLocation,
  NewReturnMedia,
  ReturnMedia,
  ReturnMediaPatch,
} from './media';
export { returnAnchorWrite } from './remote-documents';
export type { RemoteValues, RemoteWrite } from './remote-documents';
export { createReturnSync } from './return-sync';
export type {
  RemoteReturnWriter,
  ReturnSync,
  ReturnSyncDeps,
  ReturnSyncSummary,
} from './return-sync';
export { startOpeningVideo, findUnrecordedVideo } from './video-controller';
export type {
  ActiveVideo,
  VideoFailure,
  VideoHashOutcome,
  VideoOutcome,
  VideoPersistOutcome,
  VideoPorts,
  VideoRecordResult,
  VideoRecorder,
  VideoRecordingHandle,
  VideoStartFailure,
} from './video-controller';
export { recoverInterruptedMedia } from './media-recovery';
export type { MediaRecoveryPorts, MediaRecoveryResult } from './media-recovery';
export { returnMediaUploader } from './media-uploader';
