import type { Firestore } from 'firebase-admin/firestore';

import {
  deleteAccountForUser,
  planAccountDeletion,
  type AuthUserDeleter,
  type DeletionPlan,
} from '../account';

/**
 * Script cho nhân viên hỗ trợ xử lý yêu cầu xóa tài khoản gửi qua email (trang web `/xoa-tai-khoan/`,
 * Google Play yêu cầu kênh web). Dùng CHUNG `deleteAccountForUser` với callable `deleteAccount`, nên kết
 * quả giống hệt xóa trong app (khóa shop, hẹn xóa hẳn sau 30 ngày, bản ghi `accountDeletions`).
 *
 * Mặc định là chạy thử (dry-run): chỉ in kế hoạch, không ghi gì. Thêm `--execute` mới xóa. Chỉ chạy SAU khi
 * đã xác minh người gửi là chủ tài khoản (thư hỏi lại theo trang web). Không in email ra màn hình/nhật ký.
 *
 * Cách chạy (firebase-setup.md mục 5): `npm --prefix firebase/functions run build` rồi
 * `GOOGLE_CLOUD_PROJECT=<dự án> node firebase/functions/lib/admin/delete-account-cli.js --email <email>`
 * (hoặc `--uid <uid>`), thêm `--execute` khi đã kiểm kế hoạch. Cần quyền Admin SDK
 * (`gcloud auth application-default login` bằng tài khoản có vai trò Firebase Admin).
 */

export interface CliArgs {
  readonly email?: string;
  readonly uid?: string;
  readonly execute: boolean;
}

export class CliUsageError extends Error {}

export const USAGE =
  'Dùng: delete-account-cli (--email <email> | --uid <uid>) [--execute]  (mặc định chạy thử, không ghi)';

export function parseCliArgs(argv: readonly string[]): CliArgs {
  let email: string | undefined;
  let uid: string | undefined;
  let execute = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--execute') execute = true;
    else if (arg === '--email' || arg === '--uid') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new CliUsageError(USAGE);
      if (arg === '--email') email = value.trim();
      else uid = value.trim();
      i += 1;
    } else throw new CliUsageError(USAGE);
  }
  if ((email ? 1 : 0) + (uid ? 1 : 0) !== 1) throw new CliUsageError(USAGE);
  return { ...(email ? { email } : {}), ...(uid ? { uid } : {}), execute };
}

export interface CliDeps {
  readonly db: Firestore;
  readonly auth: AuthUserDeleter & {
    /** uid theo email; null nếu không có tài khoản. */
    findUidByEmail(email: string): Promise<string | null>;
  };
  readonly print: (line: string) => void;
  readonly nowMs: () => number;
}

function describePlan(plan: DeletionPlan): string[] {
  const lines = [`uid: ${plan.uid}`];
  if (plan.shops.length === 0) lines.push('Không có cửa hàng nào gắn với tài khoản.');
  for (const shop of plan.shops) {
    const action =
      shop.action === 'close'
        ? shop.alreadyDeleting
          ? 'đã khóa từ trước (giữ hạn xóa cũ)'
          : 'khóa và hẹn xóa hẳn sau 30 ngày'
        : shop.action === 'leave'
          ? 'chỉ rời cửa hàng (không phải chủ)'
          : 'không thao tác';
    lines.push(
      `cửa hàng ${shop.shopId}: ${action}; thành viên khác đang hoạt động: ${shop.otherActiveMembers}`,
    );
  }
  if (plan.existingRecord) {
    lines.push(`đã có bản ghi xóa, trạng thái: ${String(plan.existingRecord.status)}`);
  }
  if (plan.blockedBy) lines.push('KHÔNG xóa được: cửa hàng còn thành viên khác đang hoạt động.');
  return lines;
}

/** Trả mã thoát: 0 thành công (hoặc chạy thử), 1 không xóa được, 2 sai cách dùng. */
export async function runDeleteAccountCli(argv: readonly string[], deps: CliDeps): Promise<number> {
  let args: CliArgs;
  try {
    args = parseCliArgs(argv);
  } catch (error) {
    if (error instanceof CliUsageError) {
      deps.print(error.message);
      return 2;
    }
    throw error;
  }
  const uid = args.uid ?? (await deps.auth.findUidByEmail(args.email ?? ''));
  if (!uid) {
    // Không nhắc lại email đã nhập.
    deps.print('Không tìm thấy tài khoản với email này.');
    return 1;
  }
  const plan = await planAccountDeletion(deps.db, uid);
  for (const line of describePlan(plan)) deps.print(line);
  if (plan.blockedBy) return 1;
  if (!args.execute) {
    deps.print('Chạy thử: chưa ghi gì. Thêm --execute để xóa.');
    return 0;
  }
  const result = await deleteAccountForUser(deps.db, deps.auth, uid, {
    nowMs: deps.nowMs(),
    channel: 'support',
  });
  const purge =
    result.purgeAfterMs === null ? 'không có' : new Date(result.purgeAfterMs).toISOString();
  deps.print(
    `Đã xóa tài khoản. Trạng thái: ${result.status}. Hạn xóa hẳn dữ liệu máy chủ: ${purge}.`,
  );
  return 0;
}

/* istanbul ignore next -- điểm vào thật, cần Admin SDK và dự án Firebase. */
async function main(): Promise<void> {
  const { initializeApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp();
  const auth = getAuth();
  const code = await runDeleteAccountCli(process.argv.slice(2), {
    db: getFirestore(),
    auth: {
      deleteUser: async (uid) => {
        await auth.deleteUser(uid);
      },
      findUidByEmail: async (email) => {
        try {
          return (await auth.getUserByEmail(email)).uid;
        } catch (error) {
          if ((error as { code?: unknown } | null)?.code === 'auth/user-not-found') return null;
          throw error;
        }
      },
    },
    // Script dòng lệnh cho nhân viên, chạy ngoài app: in ra stdout là mục đích.
    print: (line) => process.stdout.write(`${line}\n`),
    nowMs: () => Date.now(),
  });
  process.exitCode = code;
}

if (require.main === module) {
  void main();
}
