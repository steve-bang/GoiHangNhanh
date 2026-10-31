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
  // v6: kiện đã đăng lên máy chủ chưa, để đăng phiên không phải đọc lại cả cây đơn (mỗi lần phiên đổi
  // trạng thái) chỉ để biết "kiện thêm sau" đã có chưa (chi phí đọc Firestore). Kiện có trước cột này
  // giữ NULL: lần đăng phiên đầu tiên kiểm tra một lần (idempotent) rồi đánh dấu.
  `
  ALTER TABLE packages ADD COLUMN remote_synced_at_device INTEGER;
  `,
  // v7 (PR3, R6): index cho truy vấn danh sách + cột mốc hoạt động. Chỉ thêm, không mất dữ liệu.
  // - `evidence_files (order_id, kind)`: bộ lọc "Chưa có video" tra theo đơn, không quét cả bảng.
  // - `packing_sessions (shop_id, order_id)`: tra phiên theo đơn (luôn kèm shop_id, bất biến 8).
  // - `orders.last_activity_device` = MAX(created_at_device, started_at_device lớn nhất của các phiên
  //   của đơn): giữ cho danh sách sắp xếp/keyset bằng index thay vì nhóm cả bảng phiên mỗi lần.
  //   Phiên chỉ được thêm (started_at_device không đổi) nên chỉ cần cập nhật khi tạo phiên.
  // Backfill chạy SAU khi có index phiên để truy vấn con không quét cả bảng.
  `
  CREATE INDEX idx_evidence_files_order_kind ON evidence_files (order_id, kind);
  CREATE INDEX idx_sessions_shop_order ON packing_sessions (shop_id, order_id);
  ALTER TABLE orders ADD COLUMN last_activity_device INTEGER NOT NULL DEFAULT 0;
  UPDATE orders SET last_activity_device = MAX(
    created_at_device,
    COALESCE(
      (SELECT MAX(s.started_at_device) FROM packing_sessions s
       WHERE s.shop_id = orders.shop_id AND s.order_id = orders.id),
      0
    )
  );
  CREATE INDEX idx_orders_shop_activity ON orders (shop_id, last_activity_device DESC, id DESC);
  `,
  // v8 (R1 hàng hoàn): hồ sơ hàng hoàn cục bộ (docs/02, 05). Chỉ thêm bảng. Hồ sơ có thể CHƯA liên kết
  // đơn gốc nên `source_order_id` nullable và KHÔNG có khóa ngoại (không bắt buộc đơn tồn tại, không
  // xóa theo đơn). Dòng dự kiến là bản SAO (`expected_*`) nên sửa đơn không làm đổi. `return_events`,
  // `return_link_events` chỉ thêm (bất biến 7). Chưa có bảng tệp bằng chứng cho hàng hoàn: bảng
  // `evidence_files` bắt buộc đơn + kiện + phiên đóng gói nên chưa dùng được cho hồ sơ chưa liên kết (R2).
  `
  CREATE TABLE return_cases (
    id TEXT PRIMARY KEY NOT NULL,
    shop_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    code TEXT NOT NULL,
    status TEXT NOT NULL,
    source_order_id TEXT,
    observed_code TEXT,
    observed_code_key TEXT,
    exterior_json TEXT,
    opened_before_json TEXT,
    opening_video_json TEXT,
    final_note TEXT NOT NULL DEFAULT '',
    confirmed_at_device INTEGER,
    created_at_device INTEGER NOT NULL,
    updated_at_device INTEGER NOT NULL,
    created_by TEXT,
    UNIQUE (shop_id, seq)
  );
  CREATE INDEX idx_return_cases_shop_recent ON return_cases (shop_id, updated_at_device DESC, id DESC);
  CREATE INDEX idx_return_cases_order ON return_cases (shop_id, source_order_id);
  CREATE INDEX idx_return_cases_code ON return_cases (shop_id, observed_code_key);
  CREATE TABLE return_link_events (
    id TEXT PRIMARY KEY NOT NULL,
    return_id TEXT NOT NULL REFERENCES return_cases (id),
    shop_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    basis TEXT NOT NULL,
    at_device INTEGER NOT NULL,
    by_uid TEXT
  );
  CREATE INDEX idx_return_links_return ON return_link_events (return_id, at_device);
  CREATE TABLE return_lines (
    id TEXT PRIMARY KEY NOT NULL,
    return_id TEXT NOT NULL REFERENCES return_cases (id),
    shop_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    variant TEXT,
    received_quantity INTEGER CHECK (received_quantity IS NULL OR received_quantity >= 0),
    condition TEXT,
    note TEXT NOT NULL DEFAULT '',
    expected_order_line_id TEXT,
    expected_name TEXT,
    expected_variant TEXT,
    expected_quantity INTEGER
  );
  CREATE INDEX idx_return_lines_return ON return_lines (return_id, position);
  CREATE TABLE return_discrepancies (
    id TEXT PRIMARY KEY NOT NULL,
    return_id TEXT NOT NULL REFERENCES return_cases (id),
    shop_id TEXT NOT NULL,
    line_id TEXT,
    kind TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    at_device INTEGER NOT NULL,
    by_uid TEXT
  );
  CREATE INDEX idx_return_discrepancies_return ON return_discrepancies (return_id, at_device);
  CREATE TABLE return_events (
    id TEXT PRIMARY KEY NOT NULL,
    return_id TEXT NOT NULL REFERENCES return_cases (id),
    shop_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    at_device INTEGER NOT NULL,
    by_uid TEXT
  );
  CREATE INDEX idx_return_events_return ON return_events (return_id, at_device);
  `,
  // v9 (hồ sơ tranh chấp cục bộ, Q-27). Chỉ thêm bảng. Tham chiếu đơn/hồ sơ hoàn bằng ID, KHÔNG khóa
  // ngoại (đơn/hồ sơ không bị xóa theo). `subject_label` là mã chụp lại để hiển thị. `dispute_evidence`
  // và `dispute_events` chỉ thêm, không xóa (bất biến 7, 9): đóng hồ sơ chỉ đổi `status`.
  `
  CREATE TABLE disputes (
    id TEXT PRIMARY KEY NOT NULL,
    shop_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    code TEXT NOT NULL,
    status TEXT NOT NULL,
    subject_kind TEXT NOT NULL CHECK (subject_kind IN ('order', 'return')),
    order_id TEXT,
    return_id TEXT,
    subject_label TEXT NOT NULL,
    opening_evidence_limit INTEGER NOT NULL DEFAULT 0,
    issue_type TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    close_note TEXT NOT NULL DEFAULT '',
    created_at_device INTEGER NOT NULL,
    updated_at_device INTEGER NOT NULL,
    closed_at_device INTEGER,
    created_by TEXT,
    UNIQUE (shop_id, seq)
  );
  CREATE INDEX idx_disputes_shop_recent ON disputes (shop_id, updated_at_device DESC, id DESC);
  CREATE TABLE dispute_evidence (
    dispute_id TEXT NOT NULL REFERENCES disputes (id),
    shop_id TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    added_at_device INTEGER NOT NULL,
    by_uid TEXT,
    PRIMARY KEY (dispute_id, evidence_id)
  );
  CREATE INDEX idx_dispute_evidence_shop ON dispute_evidence (shop_id, evidence_id);
  CREATE TABLE dispute_events (
    id TEXT PRIMARY KEY NOT NULL,
    dispute_id TEXT NOT NULL REFERENCES disputes (id),
    shop_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    at_device INTEGER NOT NULL,
    by_uid TEXT
  );
  CREATE INDEX idx_dispute_events_dispute ON dispute_events (dispute_id, at_device);
  `,
  // v10 (R2a hàng hoàn): ảnh của hồ sơ hàng hoàn. Bảng riêng vì `evidence_files` bắt buộc đơn + kiện +
  // phiên đóng gói. Dùng chung vòng đời trạng thái tệp; chỉ thêm, không xóa (bản gốc bất biến).
  `
  CREATE TABLE return_media (
    id TEXT PRIMARY KEY NOT NULL,
    return_id TEXT NOT NULL REFERENCES return_cases (id),
    shop_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('photo')),
    state TEXT NOT NULL,
    local_path TEXT,
    size_bytes INTEGER,
    sha256_client TEXT,
    created_at_device INTEGER NOT NULL,
    updated_at_device INTEGER NOT NULL,
    created_by TEXT
  );
  CREATE INDEX idx_return_media_return ON return_media (return_id, created_at_device);
  `,
  // v11 (Q-26k): vị trí thiết bị lúc chụp ảnh hàng hoàn. Chỉ ADD COLUMN nullable (ảnh cũ = NULL = chưa
  // ghi vị trí). Ghi một lần sau khi đóng tệp; là số đọc của máy, không chứng minh nơi chụp thật.
  `
  ALTER TABLE return_media ADD COLUMN lat REAL;
  ALTER TABLE return_media ADD COLUMN lng REAL;
  ALTER TABLE return_media ADD COLUMN accuracy_m REAL;
  ALTER TABLE return_media ADD COLUMN location_at_device INTEGER;
  ALTER TABLE return_media ADD COLUMN location_status TEXT CHECK (location_status IS NULL OR location_status IN ('ok', 'denied', 'unavailable', 'timeout', 'off'));
  `,
  // v12 (R2b, Q-28): hồ sơ hàng hoàn đã đăng bản "neo" lên máy chủ chưa (giờ thiết bị). Chỉ ADD COLUMN
  // nullable; hồ sơ có trước giữ NULL. Đăng một chiều, tạo một lần (không sửa bản neo).
  `
  ALTER TABLE return_cases ADD COLUMN remote_synced_at_device INTEGER;
  `,
  // v13 (R2b, Q-28): trạng thái hàng đợi tải lên của media hàng hoàn, cùng ý nghĩa với `evidence_files`
  // (số lần thử, giờ thử lại sớm nhất, mã lỗi gần nhất). Chỉ ADD COLUMN; ảnh có trước giữ mặc định.
  `
  ALTER TABLE return_media ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE return_media ADD COLUMN next_attempt_at_device INTEGER;
  ALTER TABLE return_media ADD COLUMN last_error_code TEXT;
  `,
  // v14 (R2b, Q-28): `return_media.kind` nhận thêm 'video' (video mở kiện). SQLite không đổi ràng buộc
  // CHECK tại chỗ nên tạo lại bảng TRONG giao dịch của migration: bảng mới -> chép nguyên MỌI dòng và
  // cột (giữ rowid/thứ tự, vị trí v11, hàng đợi v13) -> xóa bảng cũ -> đổi tên -> tạo lại chỉ mục. Không
  // bảng nào tham chiếu `return_media` (tranh chấp tham chiếu bằng ID, không khóa ngoại) nên không mất ràng buộc.
  `
  CREATE TABLE return_media_v14 (
    id TEXT PRIMARY KEY NOT NULL,
    return_id TEXT NOT NULL REFERENCES return_cases (id),
    shop_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
    state TEXT NOT NULL,
    local_path TEXT,
    size_bytes INTEGER,
    sha256_client TEXT,
    created_at_device INTEGER NOT NULL,
    updated_at_device INTEGER NOT NULL,
    created_by TEXT,
    lat REAL,
    lng REAL,
    accuracy_m REAL,
    location_at_device INTEGER,
    location_status TEXT CHECK (location_status IS NULL OR location_status IN ('ok', 'denied', 'unavailable', 'timeout', 'off')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at_device INTEGER,
    last_error_code TEXT
  );
  INSERT INTO return_media_v14 (
    id, return_id, shop_id, kind, state, local_path, size_bytes, sha256_client,
    created_at_device, updated_at_device, created_by, lat, lng, accuracy_m, location_at_device,
    location_status, attempt_count, next_attempt_at_device, last_error_code
  )
  SELECT
    id, return_id, shop_id, kind, state, local_path, size_bytes, sha256_client,
    created_at_device, updated_at_device, created_by, lat, lng, accuracy_m, location_at_device,
    location_status, attempt_count, next_attempt_at_device, last_error_code
  FROM return_media ORDER BY rowid;
  DROP TABLE return_media;
  ALTER TABLE return_media_v14 RENAME TO return_media;
  CREATE INDEX idx_return_media_return ON return_media (return_id, created_at_device);
  `,
  // v15 (V1-09): cài đặt THEO MÁY (khóa/giá trị JSON, ví dụ "Chỉ tải khi có Wi‑Fi"). Chỉ thêm bảng mới;
  // chưa có dòng nào = mọi cài đặt ở giá trị mặc định. Không gắn shop/tài khoản (không phải dữ liệu shop).
  `
  CREATE TABLE device_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at_device INTEGER NOT NULL
  );
  `,
  // v16 (V1-13): (1) dấu tệp đã băm (kích thước + thời điểm sửa đổi, giờ thiết bị ms) để hàng đợi tải lên
  // không băm lại tệp không đổi ở mỗi lần thử; NULL = chưa có dấu, phải băm lại. (2) Cờ gián đoạn BỀN của
  // video mở kiện hàng hoàn (0/1, chỉ bật), ghi ngay khi phát hiện vào nền/camera ngắt sớm. (3) Index từ
  // review V1-10. Chỉ ADD COLUMN nullable/có mặc định và CREATE INDEX: dữ liệu có sẵn giữ nguyên.
  `
  ALTER TABLE evidence_files ADD COLUMN hashed_size_bytes INTEGER;
  ALTER TABLE evidence_files ADD COLUMN hashed_mtime_device INTEGER;
  ALTER TABLE return_media ADD COLUMN hashed_size_bytes INTEGER;
  ALTER TABLE return_media ADD COLUMN hashed_mtime_device INTEGER;
  ALTER TABLE return_media ADD COLUMN interrupted INTEGER NOT NULL DEFAULT 0 CHECK (interrupted IN (0, 1));
  CREATE INDEX idx_sessions_shop_started ON packing_sessions (shop_id, started_at_device);
  CREATE INDEX idx_return_media_shop_state ON return_media (shop_id, state);
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
