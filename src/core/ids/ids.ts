/**
 * ID nội bộ có kiểu riêng (branded) để trình biên dịch chặn nhầm ID phiên với ID đơn, hay dùng
 * mã đơn thay ID (CLAUDE.md bất biến #1, #2). Mã đơn/mã vận đơn KHÔNG có kiểu ID: chúng chỉ là
 * chuỗi tìm kiếm.
 *
 * Việc sinh ID (UUID/ULID) do lớp platform đảm nhiệm; tại đây chỉ định nghĩa kiểu.
 */
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type ShopId = Brand<string, 'ShopId'>;
export type UserId = Brand<string, 'UserId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type OrderLineId = Brand<string, 'OrderLineId'>;
export type PackageId = Brand<string, 'PackageId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type EvidenceId = Brand<string, 'EvidenceId'>;
export type ReturnCaseId = Brand<string, 'ReturnCaseId'>;
export type DisputeId = Brand<string, 'DisputeId'>;
export type UploadJobId = Brand<string, 'UploadJobId'>;
