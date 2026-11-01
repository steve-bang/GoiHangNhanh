import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { RemoteDocuments } from '@/api/contract';
import type { EvidenceId, ShopId } from '@/core/ids';

/** URL ký chỉ đọc do Function `getEvidenceReadUrl` cấp. Chỉ giữ trong bộ nhớ, không lưu, không log. */
export interface EvidenceReadUrl {
  readonly url: string;
  readonly expiresAtMs: number;
}

export interface EvidenceReadUrlApi {
  get(shopId: ShopId, evidenceId: EvidenceId): Promise<EvidenceReadUrl>;
}

/**
 * Lý do không lấy được URL, để UI chọn câu mà không đọc `message`:
 * `network` mất mạng/hết giờ (thử lại được), `unavailable` máy chủ không cho xem (không phải thành viên,
 * chưa xác nhận có bản, không tìm thấy) hoặc lỗi máy chủ.
 */
export class EvidenceReadUrlError extends Error {
  constructor(readonly reason: 'network' | 'unavailable') {
    super(reason);
  }
}

const NETWORK_CODES = ['unavailable', 'deadline-exceeded'];

function isNetworkError(error: unknown): boolean {
  const raw = (error as { code?: unknown } | null)?.code;
  const code = typeof raw === 'string' ? raw.replace(/^functions\//, '') : '';
  if (NETWORK_CODES.includes(code)) return true;
  // `internal`/`unknown` KHÔNG kèm `details` = SDK không tới được máy chủ (cùng quy tắc với tải lên).
  const details = (error as { details?: unknown } | null)?.details;
  return (code === 'internal' || code === 'unknown') && (details === undefined || details === null);
}

/** Gọi Function qua cổng `RemoteDocuments` (cùng đường với `createUploadSession`, không qua `ApiClient`). */
export function createEvidenceReadUrlApi(docs: RemoteDocuments): EvidenceReadUrlApi {
  return {
    async get(shopId, evidenceId) {
      let result: { url?: unknown; expiresAtMs?: unknown };
      try {
        result = await docs.callFunction('getEvidenceReadUrl', { shopId, evidenceId });
      } catch (error) {
        throw new EvidenceReadUrlError(isNetworkError(error) ? 'network' : 'unavailable');
      }
      // Chỉ nhận https: không phát URL lạ (bất biến 8: URL ký của Storage luôn là https).
      if (
        typeof result?.url !== 'string' ||
        !result.url.startsWith('https://') ||
        typeof result.expiresAtMs !== 'number'
      ) {
        throw new EvidenceReadUrlError('unavailable');
      }
      return { url: result.url, expiresAtMs: result.expiresAtMs };
    },
  };
}

const EvidenceReadUrlContext = createContext<EvidenceReadUrlApi | null>(null);

/**
 * `docs` = `null` (cổng giả/chưa kết nối): không có cổng xem từ máy chủ, UI báo "không xem được".
 * `api` (test) thay thế cổng dựng từ `docs`.
 */
export function EvidenceReadUrlProvider({
  docs = null,
  api,
  children,
}: {
  docs?: RemoteDocuments | null;
  api?: EvidenceReadUrlApi | null;
  children: ReactNode;
}) {
  const built = useMemo(() => (docs ? createEvidenceReadUrlApi(docs) : null), [docs]);
  return (
    <EvidenceReadUrlContext.Provider value={api === undefined ? built : api}>
      {children}
    </EvidenceReadUrlContext.Provider>
  );
}

export const useEvidenceReadUrlApi = (): EvidenceReadUrlApi | null =>
  useContext(EvidenceReadUrlContext);
