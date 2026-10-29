import { AppError } from '@/core/errors/app-error';
import type { CreatorUidProvider } from '@/features/orders';
import type { SqlDatabase } from '@/platform/sql-database';

import type { ReturnStore } from '../domain/return-store';
import { createMemoryReturnStore } from './memory-return-store';
import { createSqliteReturnStore } from './sqlite-return-store';

/**
 * Kho dùng khi chạy: mở SQLite lần đầu cần tới (lười). `open` trả `null` (web) thì dùng kho bộ nhớ.
 * Mở SQLite LỖI thì mọi thao tác báo `RETURN_SAVE_FAILED`: KHÔNG lặng lẽ chuyển sang bộ nhớ vì sẽ
 * mất hồ sơ khi đóng app mà người dùng tưởng đã lưu (bất biến 3, 11).
 */
export function createLocalReturnStore(
  open: () => Promise<SqlDatabase | null>,
  options: { creatorUid?: CreatorUidProvider } = {},
): ReturnStore {
  let resolved: Promise<ReturnStore> | null = null;
  const get = () => {
    if (!resolved) {
      resolved = open()
        .then((db) =>
          db ? createSqliteReturnStore(db, options) : createMemoryReturnStore(options),
        )
        .catch((error: unknown) => {
          resolved = null; // lần sau thử mở lại
          throw new AppError('RETURN_SAVE_FAILED', {}, { cause: error });
        });
    }
    return resolved;
  };
  return {
    createReturn: async (input) => (await get()).createReturn(input),
    getReturn: async (shop, id) => (await get()).getReturn(shop, id),
    listReturns: async (shop, limit) => (await get()).listReturns(shop, limit),
    findReturns: async (shop, query) => (await get()).findReturns(shop, query),
    saveExterior: async (shop, id, input) => (await get()).saveExterior(shop, id, input),
    saveOpeningVideoMissing: async (shop, id, input) =>
      (await get()).saveOpeningVideoMissing(shop, id, input),
    saveOpeningVideoRecorded: async (shop, id, input) =>
      (await get()).saveOpeningVideoRecorded(shop, id, input),
    saveLines: async (shop, id, input) => (await get()).saveLines(shop, id, input),
    confirmReturn: async (shop, id, input) => (await get()).confirmReturn(shop, id, input),
    linkSourceOrder: async (shop, id, input) => (await get()).linkSourceOrder(shop, id, input),
    createMedia: async (input) => (await get()).createMedia(input),
    applyMediaEvent: async (shop, id, event, at, patch) =>
      (await get()).applyMediaEvent(shop, id, event, at, patch),
    setMediaLocation: async (shop, id, location) =>
      (await get()).setMediaLocation(shop, id, location),
    checkMediaDeletable: async (shop, id) => (await get()).checkMediaDeletable(shop, id),
    deleteMedia: async (shop, id, at, eventId) => (await get()).deleteMedia(shop, id, at, eventId),
    listReturnsPendingRemote: async (shop, limit, uid) =>
      (await get()).listReturnsPendingRemote(shop, limit, uid),
    markReturnPublished: async (shop, id, at) => (await get()).markReturnPublished(shop, id, at),
    listMediaForUpload: async (shop, states, uid) =>
      (await get()).listMediaForUpload(shop, states, uid),
    listUnfinishedMedia: async () => (await get()).listUnfinishedMedia(),
    listMedia: async (shop, returnId) => (await get()).listMedia(shop, returnId),
  };
}
