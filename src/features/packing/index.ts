// Public API của feature packing. Feature khác chỉ import từ đây (@/features/packing).
export * from './ui';
export {
  ACTIVE_RECORDING_POLICY,
  RECORDER_ENABLED,
  WARN_BEFORE_LIMIT_SECONDS,
  formatElapsed,
  maxRecordSeconds,
  requiredFreeBytes,
} from './domain';
