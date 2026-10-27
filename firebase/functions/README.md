# Cloud Functions

TypeScript, region `asia-southeast1` (Singapore, Q-08). Phần MÁY CHỦ của hiện thực Firebase (`src/api/firebase`
ở app); đổi backend thì phần này làm lại riêng.

| Function                | Việc                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `createShop` (callable) | Tạo shop + thành viên `owner` + chỉ mục `userShops/{uid}` + kiểm toán, trong MỘT transaction; idempotent theo tài khoản |
| `updateShop` (callable) | Sửa tên/nguồn bán; chỉ thành viên `owner`/`manager` đang hoạt động; ghi kiểm toán trước/sau                             |

Logic nằm ở `src/shop.ts` (nhận `Firestore`, test được trên emulator); `src/index.ts` chỉ nối callable.

- Cài: `npm --prefix firebase/functions ci`. Build: `npm --prefix firebase/functions run build`.
- Test: `npm run test:rules` (cùng Firestore Emulator; test ở `firebase/tests/functions/`).
- Deploy lên dự án dev (`ghn-test-67b39`; truyền `--project` rõ vì `.firebaserc` nằm trong `firebase/`, không phải gốc repo): `npx firebase deploy --config firebase/firebase.json --project ghn-test-67b39 --only functions,firestore:rules,firestore:indexes` (cần `firebase login` và gói Blaze).
