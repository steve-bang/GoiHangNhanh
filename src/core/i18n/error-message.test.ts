import { createInstance } from 'i18next';

import { errorText, resolveErrorMessage } from './error-message';
import { resources } from './resources';

function makeT() {
  const i18n = createInstance();
  void i18n.init({
    resources,
    lng: 'vi',
    defaultNS: 'common',
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  return i18n.t.bind(i18n);
}

describe('resolveErrorMessage', () => {
  const t = makeT();

  it('mã một câu trả về title, không có hint', () => {
    expect(resolveErrorMessage(t, 'AUTH_EMAIL_IN_USE')).toEqual({
      title: 'Email này đã có tài khoản.',
    });
  });

  it('mã hai câu tách title và hint; errorText nối lại', () => {
    const message = resolveErrorMessage(t, 'AUTH_NETWORK_ERROR');
    expect(message.title).toBe('Mất kết nối mạng.');
    expect(message.hint).toBe('Bạn kiểm tra mạng rồi thử lại nhé.');
    expect(errorText(message)).toBe('Mất kết nối mạng. Bạn kiểm tra mạng rồi thử lại nhé.');
  });
});
