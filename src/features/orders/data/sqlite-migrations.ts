/**
 * Migration có phiên bản cho cơ sở dữ liệu cục bộ (PRAGMA user_version). CHỈ thêm phần tử mới ở
 * cuối; không sửa phần tử đã phát hành (người dùng đã chạy chúng). Mỗi migration chạy trong một
 * giao dịch cùng việc tăng `user_version`.
 */
export const MIGRATIONS: readonly string[] = [
  // v1: đơn, dòng sản phẩm, kiện, phiên đóng gói. Thời gian là thời gian THIẾT BỊ (mili giây).
  `
  CREATE TABLE orders (
    id TEXT PRIMARY KEY NOT NULL,
    shop_id TEXT NOT NULL,
    order_code TEXT NOT NULL,
    order_code_key TEXT NOT NULL,
    source TEXT NOT NULL,
    tracking_code TEXT,
    tracking_code_key TEXT,
    data_origin TEXT NOT NULL,
    created_at_device INTEGER NOT NULL
  );
  CREATE INDEX idx_orders_shop_code ON orders (shop_id, order_code_key);
  CREATE INDEX idx_orders_shop_tracking ON orders (shop_id, tracking_code_key);
  CREATE TABLE order_lines (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders (id),
    name TEXT NOT NULL,
    variant TEXT,
    quantity INTEGER NOT NULL CHECK (quantity >= 1),
    position INTEGER NOT NULL,
    data_origin TEXT NOT NULL,
    created_at_device INTEGER NOT NULL
  );
  CREATE INDEX idx_order_lines_order ON order_lines (order_id, position);
  CREATE INDEX idx_order_lines_created ON order_lines (created_at_device);
  CREATE TABLE packages (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders (id),
    idx INTEGER NOT NULL,
    created_at_device INTEGER NOT NULL,
    UNIQUE (order_id, idx)
  );
  CREATE TABLE packing_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    shop_id TEXT NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders (id),
    package_id TEXT NOT NULL REFERENCES packages (id),
    started_at_device INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,
    session_status TEXT NOT NULL
  );
  `,
  // v2: lịch sử tìm kiếm cục bộ theo shop (UI-B03; Q-22u). Không đụng bảng của v1.
  `
  CREATE TABLE search_history (
    shop_id TEXT NOT NULL,
    query_key TEXT NOT NULL,
    query_text TEXT NOT NULL,
    last_used_at_device INTEGER NOT NULL,
    PRIMARY KEY (shop_id, query_key)
  );
  CREATE INDEX idx_search_history_shop_recent ON search_history (shop_id, last_used_at_device DESC);
  `,
  // v3: tệp bằng chứng cục bộ (video/ảnh). Trạng thái TỆP tách khỏi phiên (bất biến 3); gắn với
  // đơn + kiện + phiên tạo trước khi quay (bất biến 2). Chỉ thêm bảng, không đụng bảng cũ.
  `
  CREATE TABLE evidence_files (
    id TEXT PRIMARY KEY NOT NULL,
    shop_id TEXT NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders (id),
    package_id TEXT NOT NULL REFERENCES packages (id),
    session_id TEXT NOT NULL REFERENCES packing_sessions (id),
    file_group TEXT NOT NULL CHECK (file_group IN ('pack', 'return')),
    kind TEXT NOT NULL CHECK (kind IN ('video', 'photo')),
    state TEXT NOT NULL,
    local_path TEXT,
    size_bytes INTEGER,
    duration_ms INTEGER,
    sha256_client TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at_device INTEGER,
    last_error_code TEXT,
    created_at_device INTEGER NOT NULL,
    updated_at_device INTEGER NOT NULL
  );
  CREATE INDEX idx_evidence_files_order ON evidence_files (shop_id, order_id, created_at_device);
  CREATE INDEX idx_evidence_files_session ON evidence_files (shop_id, session_id);
  CREATE INDEX idx_evidence_files_state ON evidence_files (shop_id, state);
  `,
  // v4: dấu đã đẩy lên Firestore (đồng bộ một chiều, không có hàng đợi riêng: việc cần làm suy ra từ
  // dữ liệu). `remote_synced_at_device`: đơn đã đăng lên máy chủ. `remote_status`: trạng thái phiên
  // đã đăng gần nhất.
  `
  ALTER TABLE orders ADD COLUMN remote_synced_at_device INTEGER;
  ALTER TABLE packing_sessions ADD COLUMN remote_status TEXT;
  `,
  // v5: uid người tạo đơn/kiện/phiên (nullable). Rules ép `createdBy == auth.uid` nên chỉ người tạo
  // mới đăng được bản ghi của mình; máy dùng chung không được ghi nhầm người tạo (ADR-019, Q-23g).
  // Bản ghi có trước cột này giữ NULL và KHÔNG bao giờ được đăng.
  `
  ALTER TABLE orders ADD COLUMN created_by TEXT;
  ALTER TABLE packages ADD COLUMN created_by TEXT;
  ALTER TABLE packing_sessions ADD COLUMN created_by TEXT;
  `,
];

/**
 * Cột của `evidence_files` mà bản v3 ĐẦU TIÊN (đã lỡ chạy trên vài máy dev/Expo Go ở các nhánh xếp
 * chồng) chưa có: v3 sau đó được sửa tại chỗ để thêm chúng, nên máy đã chạy v3 cũ có
 * `user_version` = 3 mà thiếu cột. Quy tắc từ nay: không sửa migration đã phát hành; việc sửa schema
 * lệch nằm ở `repairLegacySchema` (sqlite-order-store.ts), chỉ ADD COLUMN nullable/có mặc định
 * (idempotent).
 */
export const LEGACY_EVIDENCE_FILE_COLUMNS: readonly { name: string; ddl: string }[] = [
  { name: 'attempt_count', ddl: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'next_attempt_at_device', ddl: 'INTEGER' },
  { name: 'last_error_code', ddl: 'TEXT' },
];
