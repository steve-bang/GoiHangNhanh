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
];
