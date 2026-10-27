import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { EVIDENCE_STATUS_PRESENTATION, type EvidenceStatusLabel } from '@/core/theme';

import { EvidenceStatusBadge } from './EvidenceStatusBadge';
import { ICON_GLYPHS } from './Icon';

const EXPECTED_LABELS: Record<EvidenceStatusLabel, string> = {
  saved_on_device: 'Đã lưu trên máy',
  waiting_upload: 'Chờ tải lên',
  uploading: 'Đang tải lên',
  uploaded: 'Đã tải lên',
  verified: 'Đã xác minh',
  error: 'Lỗi – cần xử lý',
};

const STATUSES = Object.keys(EXPECTED_LABELS) as EvidenceStatusLabel[];

describe('EvidenceStatusBadge (docs/09 mục 3)', () => {
  it('có đúng 6 nhãn', () => {
    expect(STATUSES).toHaveLength(6);
    expect(Object.keys(EVIDENCE_STATUS_PRESENTATION).sort()).toEqual([...STATUSES].sort());
  });

  it.each(STATUSES)('%s hiển thị đúng nhãn chữ và có biểu tượng', async (status) => {
    await renderWithProviders(<EvidenceStatusBadge status={status} testID="badge" />);
    expect(screen.getByText(EXPECTED_LABELS[status])).toBeOnTheScreen();
    // Biểu tượng riêng của nhãn thật sự được vẽ (jest.setup.js thay font icon bằng tên glyph).
    const glyph = ICON_GLYPHS[EVIDENCE_STATUS_PRESENTATION[status].icon];
    expect(screen.getByTestId(`icon-${glyph}`)).toBeOnTheScreen();
    expect(screen.getByLabelText(EXPECTED_LABELS[status])).toBeOnTheScreen();
  });

  it('mỗi nhãn dùng glyph khác nhau (màu không là tín hiệu duy nhất)', () => {
    const glyphs = STATUSES.map((s) => ICON_GLYPHS[EVIDENCE_STATUS_PRESENTATION[s].icon]);
    expect(new Set(glyphs).size).toBe(6);
  });

  it('Đã lưu trên máy không dùng tick/đã xong và không dùng màu thành công', async () => {
    await renderWithProviders(<EvidenceStatusBadge status="saved_on_device" />);
    const presentation = EVIDENCE_STATUS_PRESENTATION.saved_on_device;
    const glyph = ICON_GLYPHS[presentation.icon];
    expect(glyph).not.toMatch(/check|done|tick/);
    expect(screen.getByTestId(`icon-${glyph}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(/icon-.*(check|done)/)).toBeNull();
    expect(presentation.statusToken).not.toBe('uploaded');
    expect(presentation.statusToken).not.toBe('verified');
  });

  it('Đã tải lên và Đã xác minh khác chữ và khác glyph', () => {
    expect(EXPECTED_LABELS.uploaded).not.toBe(EXPECTED_LABELS.verified);
    expect(ICON_GLYPHS[EVIDENCE_STATUS_PRESENTATION.uploaded.icon]).not.toBe(
      ICON_GLYPHS[EVIDENCE_STATUS_PRESENTATION.verified.icon],
    );
  });

  it('Chờ tải lên hiển thị lý do khi có', async () => {
    await renderWithProviders(
      <EvidenceStatusBadge status="waiting_upload" reason="Đang chờ mạng" />,
    );
    expect(screen.getByText('Đang chờ mạng')).toBeOnTheScreen();
  });

  it('chỉ hiển thị phần trăm khi đang tải lên và có số đo', async () => {
    await renderWithProviders(<EvidenceStatusBadge status="uploading" progressPercent={45} />);
    expect(screen.getByText('Đang tải lên 45%')).toBeOnTheScreen();
  });

  it('không hiển thị phần trăm cho trạng thái khác dù được truyền', async () => {
    await renderWithProviders(<EvidenceStatusBadge status="uploaded" progressPercent={100} />);
    expect(screen.queryByText(/100%/)).toBeNull();
  });

  it('chỉ Đã xác minh dùng cụm "an toàn trên máy chủ" (đọc từ gợi ý i18n)', () => {
    // Nhãn hiển thị không chứa "an toàn"; cụm đó chỉ ở statusHint.verified (kiểm tra ở i18n.test).
    for (const status of STATUSES) {
      expect(EXPECTED_LABELS[status]).not.toMatch(/an toàn/i);
    }
  });
});
