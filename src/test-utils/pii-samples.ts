/**
 * Chuỗi mẫu PII cho test báo lỗi ứng dụng (V1-16): không bao giờ được xuất hiện trong dữ liệu gửi đi.
 */
export const PII_SAMPLES: readonly string[] = [
  'nguyenvana@example.com',
  'DH-240915-0001',
  'SPX0123456789VN',
  'uid-7Hk2Qx9LmN',
  'shop-4f9a1c2b',
  '0912345678',
  'evidence/0000-aaaa/original.mp4',
  '/var/mobile/Containers/Data/Application/ABCD-1234/Documents/evidence',
  'file:///data/user/0/vn.doncung.app/files/evidence/e-1.mp4',
  'https://storage.googleapis.com/upload?X-Goog-Signature=abc123',
  'Nguyễn Văn A',
];

export function expectNoPii(value: unknown): void {
  const text = JSON.stringify(value);
  for (const sample of PII_SAMPLES) expect(text).not.toContain(sample);
  expect(text).not.toMatch(/Containers|vn\.doncung|googleapis|@example/);
}
