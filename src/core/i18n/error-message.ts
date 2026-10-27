import type { TFunction } from 'i18next';

import type { ErrorCode } from '@/core/errors/codes';

/** Thông báo lỗi: `title` là câu đầu (in đậm), `hint` là câu sau (có thể không có). */
export interface ErrorMessage {
  title: string;
  hint?: string;
}

/** Nối câu đầu + câu sau thành một chuỗi (lỗi dưới ô nhập không in đậm). */
export function errorText(message: ErrorMessage): string {
  return message.hint ? `${message.title} ${message.hint}` : message.title;
}

/** Lấy chữ của mã lỗi từ `errors:<mã>`: chuỗi đơn (một câu) hoặc `{ title, hint }` (hai câu). */
export function resolveErrorMessage(t: TFunction, code: ErrorCode): ErrorMessage {
  const raw: unknown = t(`errors:${code}`, { returnObjects: true });
  if (raw && typeof raw === 'object') {
    const { title, hint } = raw as { title?: unknown; hint?: unknown };
    return {
      title: typeof title === 'string' ? title : code,
      ...(typeof hint === 'string' ? { hint } : {}),
    };
  }
  return { title: typeof raw === 'string' ? raw : code };
}
