import common from './locales/vi/common.json';
import errors from './locales/vi/errors.json';
import evidence from './locales/vi/evidence.json';
import nav from './locales/vi/nav.json';
import screens from './locales/vi/screens.json';

export const DEFAULT_LANGUAGE = 'vi';
export const NAMESPACES = ['common', 'errors', 'evidence', 'nav', 'screens'] as const;

/** Tiếng Việt là ngôn ngữ mặc định và duy nhất ở bản đầu (O-17 chưa chốt ngôn ngữ khác). */
export const resources = {
  vi: { common, errors, evidence, nav, screens },
} as const;
