import { createInstance, type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LANGUAGE, NAMESPACES, resources } from './resources';

let instance: i18n | undefined;

/** Khởi tạo i18n một lần (đồng bộ vì tài nguyên được đóng gói sẵn). */
export function initI18n(): i18n {
  if (!instance) {
    const created = createInstance();
    void created.use(initReactI18next).init({
      resources,
      lng: DEFAULT_LANGUAGE,
      fallbackLng: DEFAULT_LANGUAGE,
      defaultNS: 'common',
      ns: [...NAMESPACES],
      initAsync: false,
      interpolation: { escapeValue: false }, // React Native tự thoát
    });
    instance = created;
  }
  return instance;
}

export { DEFAULT_LANGUAGE, NAMESPACES, resources } from './resources';
