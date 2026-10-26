import common from './locales/vi/common.json';
import errors from './locales/vi/errors.json';
import evidence from './locales/vi/evidence.json';

export const DEFAULT_LANGUAGE = 'vi';
export const NAMESPACES = ['common', 'errors', 'evidence'] as const;

/** Tiếng Việt là ngôn ngữ mặc định và duy nhất ở bản đầu (O-17 chưa chốt ngôn ngữ khác). */
export const resources = {
  vi: { common, errors, evidence },
} as const;
