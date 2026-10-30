import { classifyUploadStatus, uploadFileResumable } from './resumable-upload';

const mockUpload = jest.fn();
const mockCancel = jest.fn(async (): Promise<void> => undefined);
jest.mock('expo-file-system/legacy', () => ({
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  createUploadTask: (...args: unknown[]) => ({
    uploadAsync: () => mockUpload(...args),
    cancelAsync: () => mockCancel(),
  }),
}));

const session = {
  url: 'https://signed',
  method: 'POST' as const,
  headers: { 'x-goog-resumable': 'start' },
};
const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  mockUpload.mockReset();
  mockCancel.mockClear();
});

const stubFetch = (response: Partial<Response> | Error) => {
  global.fetch = jest.fn(async () => {
    if (response instanceof Error) throw response;
    return response as Response;
  }) as typeof fetch;
};

describe('classifyUploadStatus', () => {
  it('2xx thành công; 408/429/502/503/504 chờ mạng; 500/401/403/412 tính lượt; 4xx khác cần xử lý', () => {
    expect(classifyUploadStatus(200)).toEqual({ ok: true });
    expect(classifyUploadStatus(201)).toEqual({ ok: true });
    for (const s of [408, 429, 502, 503, 504])
      expect(classifyUploadStatus(s)).toEqual({ ok: false, kind: 'network', code: `HTTP_${s}` });
    for (const s of [500, 501])
      expect(classifyUploadStatus(s)).toMatchObject({ kind: 'retryable' });
    // Đối tượng đã có (URL tạo-một-lần): lượt sau đối soát, không bắt người dùng xử lý.
    expect(classifyUploadStatus(412)).toEqual({ ok: false, kind: 'retryable', code: 'HTTP_412' });
    for (const s of [401, 403]) {
      expect(classifyUploadStatus(s)).toEqual({
        ok: false,
        kind: 'retryable',
        code: 'SESSION_REJECTED',
      });
    }
    expect(classifyUploadStatus(400)).toEqual({
      ok: false,
      kind: 'attention',
      code: 'UPLOAD_REJECTED_400',
    });
  });
});

describe('uploadFileResumable', () => {
  it('mở phiên rồi PUT tệp tới Location', async () => {
    stubFetch({ ok: true, status: 201, headers: new Headers({ location: 'https://session/1' }) });
    mockUpload.mockResolvedValue({ status: 200 });
    expect(await uploadFileResumable(session, 'file:///a.mp4', 'video/mp4')).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith('https://signed', {
      method: 'POST',
      headers: { 'x-goog-resumable': 'start' },
    });
    expect(mockUpload).toHaveBeenCalledWith('https://session/1', 'file:///a.mp4', {
      httpMethod: 'PUT',
      uploadType: 0,
      headers: { 'Content-Type': 'video/mp4' },
    });
  });

  it('mất mạng ở bước mở phiên hoặc bước gửi: lỗi mạng (không tính lượt)', async () => {
    stubFetch(new Error('offline'));
    expect(await uploadFileResumable(session, 'f', 'video/mp4')).toEqual({
      ok: false,
      kind: 'network',
      code: 'NETWORK',
    });
    stubFetch({ ok: true, status: 201, headers: new Headers({ location: 'https://s' }) });
    mockUpload.mockRejectedValue(new Error('reset'));
    expect(await uploadFileResumable(session, 'f', 'video/mp4')).toEqual({
      ok: false,
      kind: 'network',
      code: 'NETWORK',
    });
  });

  it('mất mạng giữa lúc gửi (signal): hủy lần gửi native, NETWORK_LOST', async () => {
    stubFetch({ ok: true, status: 201, headers: new Headers({ location: 'https://s' }) });
    const controller = new AbortController();
    let finish: (value: unknown) => void = () => undefined;
    mockUpload.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    mockCancel.mockImplementation(async () => finish(undefined)); // native trả rỗng khi bị hủy
    const pending = uploadFileResumable(session, 'f', 'video/mp4', controller.signal);
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    expect(await pending).toEqual({ ok: false, kind: 'network', code: 'NETWORK_LOST' });
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('đã mất mạng trước khi bắt đầu: không gọi gì', async () => {
    stubFetch({ ok: true, status: 201, headers: new Headers({ location: 'https://s' }) });
    const controller = new AbortController();
    controller.abort();
    expect(await uploadFileResumable(session, 'f', 'video/mp4', controller.signal)).toMatchObject({
      code: 'NETWORK_LOST',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('thiếu Location hoặc phiên bị từ chối', async () => {
    stubFetch({ ok: true, status: 201, headers: new Headers() });
    expect(await uploadFileResumable(session, 'f', 'video/mp4')).toMatchObject({
      code: 'NO_SESSION_LOCATION',
    });
    stubFetch({ ok: false, status: 403, headers: new Headers() });
    expect(await uploadFileResumable(session, 'f', 'video/mp4')).toMatchObject({
      code: 'SESSION_REJECTED',
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('máy chủ từ chối nội dung khi PUT: cần xử lý', async () => {
    stubFetch({ ok: true, status: 201, headers: new Headers({ location: 'https://s' }) });
    mockUpload.mockResolvedValue({ status: 400 });
    expect(await uploadFileResumable(session, 'f', 'video/mp4')).toEqual({
      ok: false,
      kind: 'attention',
      code: 'UPLOAD_REJECTED_400',
    });
  });
});
