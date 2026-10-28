import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { EVIDENCE_STATUS_PRESENTATION, semantic, type EvidenceStatusLabel } from '@/core/theme';
import { renderWithProviders } from '@/test-utils/render';

import { StatusCard } from './StatusCard';

/**
 * Khung 21 của board 07 (dải trạng thái): chỉ là minh họa trạng thái, KHÔNG có màn trong tab Cá nhân (PR-F,
 * Q-21z). Dữ liệu dưới đây CHỈ có trong test; app thật không hiển thị `StatusCard` khi chưa có dữ liệu thật
 * (Q-21i), và test cuối khóa điều đó.
 */
const flat = (node: { props: { style?: unknown } }): Record<string, unknown> =>
  StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const { color, status } = semantic;

/** Thẻ board -> trạng thái bằng chứng chuẩn của docs/09 mục 3 (nhãn chuẩn, không dùng chữ board). */
const EVIDENCE_CARDS: {
  board: string;
  status: Exclude<EvidenceStatusLabel, 'uploading'>;
  label: string;
  token: keyof typeof status;
  description: string;
}[] = [
  {
    board: 'Lưu trên thiết bị',
    status: 'saved_on_device',
    label: 'Đã lưu trên máy',
    token: 'savedOnDevice',
    description: 'Chỉ lưu trên thiết bị',
  },
  {
    board: 'Chờ tải lên',
    status: 'waiting_upload',
    label: 'Chờ tải lên',
    token: 'waitingUpload',
    description: 'Đang chờ mạng',
  },
  {
    board: 'Đã đồng bộ / Lưu trên đám mây',
    status: 'uploaded',
    label: 'Đã tải lên',
    token: 'uploaded',
    description: 'Máy chủ đã nhận đủ tệp',
  },
  {
    board: 'Đã xác minh',
    status: 'verified',
    label: 'Đã xác minh',
    token: 'verified',
    description: 'Mã băm khớp trên máy chủ',
  },
  {
    board: 'Lỗi đồng bộ',
    status: 'error',
    label: 'Lỗi – cần xử lý',
    token: 'error',
    description: 'Không thể đồng bộ',
  },
];

describe('StatusCard: các trạng thái của khung 21', () => {
  it.each(EVIDENCE_CARDS)(
    '$board -> nhãn chuẩn "$label", màu mô tả từ semantic.status.$token',
    async ({ status: s, label, token, description }) => {
      await renderWithProviders(<StatusCard status={s} description={description} testID="card" />);
      expect(screen.getByText(label)).toBeOnTheScreen();
      expect(screen.getByLabelText(`${label}. ${description}`)).toBeOnTheScreen();
      expect(flat(screen.getByText(description)).color).toBe(status[token].fg);
      // Nhãn lấy đúng từ bảng chuẩn, và có biểu tượng riêng (màu không là tín hiệu duy nhất).
      expect(EVIDENCE_STATUS_PRESENTATION[s].statusToken).toBe(token);
    },
  );

  it('Đang tải lên 70%: nhãn chuẩn, thanh tiến độ 70, màu vạch từ status.uploading', async () => {
    await renderWithProviders(<StatusCard status="uploading" progress={70} />);
    expect(screen.getByText('Đang tải lên')).toBeOnTheScreen();
    const bar = screen.getByRole('progressbar', { includeHiddenElements: true });
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 70 });
    expect(flat(screen.getByText('70%')).color).toBe(status.uploading.fg);
  });

  it('Sắp hết thời hạn lưu (cam) và Đã hết thời hạn lưu (đỏ): thẻ theo tông, chữ + biểu tượng', async () => {
    const { rerender } = await renderWithProviders(
      <StatusCard
        tone="warning"
        icon="clock"
        title="Sắp hết thời hạn lưu"
        description="Còn 3 ngày"
      />,
    );
    expect(screen.getByLabelText('Sắp hết thời hạn lưu. Còn 3 ngày')).toBeOnTheScreen();
    expect(flat(screen.getByText('Còn 3 ngày')).color).toBe(color.feedback.warning.fg);
    await rerender(
      <StatusCard
        tone="danger"
        icon="alert"
        title="Đã hết thời hạn lưu"
        description="Đã hết hạn"
      />,
    );
    expect(screen.getByLabelText('Đã hết thời hạn lưu. Đã hết hạn')).toBeOnTheScreen();
    expect(flat(screen.getByText('Đã hết hạn')).color).toBe(color.feedback.danger.fg);
  });

  it('không nói mạnh hơn trạng thái thật: chỉ "Đã xác minh" mới mang nghĩa đã lưu an toàn trên máy chủ', async () => {
    for (const s of ['saved_on_device', 'waiting_upload', 'uploaded', 'error'] as const) {
      await renderWithProviders(<StatusCard status={s} />);
      expect(screen.queryByText(/an toàn|đồng bộ thành công|trên đám mây/i)).toBeNull();
    }
  });
});

describe('StatusCard không hiển thị ở app thật khi chưa có dữ liệu (Q-21i)', () => {
  const SRC = join(__dirname, '..', '..');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });

  it('chỉ shared/ui và test mới dùng StatusCard', () => {
    const files = walk(SRC)
      .map((f) => f.split(sep).join('/'))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    // Sai đường dẫn SRC sẽ quét rỗng và pass giả: phải quét được mã nguồn thật.
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith('/shared/ui/StatusCard.tsx'))).toBe(true);
    const users = files
      .filter((f) => !f.includes('/shared/ui/'))
      .filter((f) => /\bStatusCard\b/.test(readFileSync(f, 'utf8')));
    expect(users).toEqual([]);
  });
});
