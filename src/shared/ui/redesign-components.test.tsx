import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useState } from 'react';

import { colors, semantic } from '@/core/theme';
import { getMinTouchTarget } from '@/platform';
import { renderWithProviders } from '@/test-utils/render';

import { Checkbox } from './Checkbox';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { AppThemeScope } from './theme';
import { HeroCard } from './HeroCard';
import { IconTile } from './IconTile';
import { MetricTile } from './MetricTile';
import { ScreenHeader } from './ScreenHeader';
import { StatusBadge } from './StatusBadge';
import { StatusCard } from './StatusCard';
import { TextField } from './TextField';
import type { IconTone } from './tone';

const HIDDEN = { includeHiddenElements: true } as const;
const flat = (node: { props: { style?: unknown } }): Record<string, unknown> =>
  StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const { color, status, component } = {
  color: semantic.color,
  status: semantic.status,
  component: { fieldMulti: 120, checkbox: 24, progress: 6 },
};

describe('IconTile', () => {
  const tones: [IconTone, string, string][] = [
    ['brand', color.action.primary, color.brand.soft],
    ['blue', color.accent.blue.fg, color.accent.blue.bg],
    ['warning', color.feedback.warning.fg, color.feedback.warning.bg],
    ['success', color.feedback.success.fg, color.feedback.success.bg],
    ['danger', color.feedback.danger.fg, color.feedback.danger.bg],
    ['neutral', color.text.secondary, color.surface.muted],
  ];
  it.each(tones)('tông %s dùng đúng token nền', async (tone, _fg, bg) => {
    await renderWithProviders(<IconTile icon="store" tone={tone} testID="tile" />);
    expect(flat(screen.getByTestId('tile', HIDDEN))).toMatchObject({
      backgroundColor: bg,
      width: 44,
      height: 44,
      borderRadius: 12,
    });
  });

  it('cỡ theo token tile và hình tròn; ẩn khỏi trình đọc màn hình', async () => {
    await renderWithProviders(<IconTile icon="check" size="lg" shape="circle" testID="tile" />);
    const tile = screen.getByTestId('tile', HIDDEN);
    expect(flat(tile)).toMatchObject({ width: 52, height: 52, borderRadius: 9999 });
    expect(tile.props.accessibilityElementsHidden).toBe(true);
  });
});

describe('HeroCard', () => {
  it('nền brand.deep, chữ onAction / onBrandMuted, huy hiệu hiện, không phải nút khi không có onPress', async () => {
    await renderWithProviders(
      <HeroCard
        eyebrow="Gói dịch vụ"
        title="Chưa có thông tin"
        subtitle="Thời hạn lưu: Chưa có thông tin"
        badge={<StatusBadge label="Sắp có" />}
        testID="hero"
      />,
    );
    expect(flat(screen.getByTestId('hero'))).toMatchObject({
      backgroundColor: color.brand.deep,
      borderRadius: 16,
    });
    expect(flat(screen.getByText('Chưa có thông tin'))).toMatchObject({
      color: color.text.onAction,
    });
    expect(flat(screen.getByText('Gói dịch vụ'))).toMatchObject({
      color: color.text.onBrandMuted,
    });
    expect(screen.getByText('Sắp có')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('có onPress thì là nút đủ vùng chạm, đọc eyebrow + tiêu đề + phụ đề, bấm được', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <HeroCard eyebrow="Gói dịch vụ" title="Tiêu chuẩn" subtitle="Hạn lưu" onPress={onPress} />,
    );
    const hero = screen.getByRole('button', { name: 'Gói dịch vụ. Tiêu chuẩn. Hạn lưu' });
    expect(flat(hero).minHeight).toBeGreaterThanOrEqual(getMinTouchTarget());
    await fireEvent.press(hero);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('badgeLabel được nối vào nhãn trợ năng, cả khi không bấm được và khi bấm được', async () => {
    const { rerender } = await renderWithProviders(
      <HeroCard
        eyebrow="Gói dịch vụ"
        title="Chưa có thông tin"
        badge={<StatusBadge label="Sắp có" />}
        badgeLabel="Sắp có"
        testID="hero"
      />,
    );
    expect(screen.getByTestId('hero').props.accessibilityLabel).toBe(
      'Gói dịch vụ. Chưa có thông tin. Sắp có',
    );
    await rerender(<HeroCard title="Tiêu chuẩn" badgeLabel="Sắp có" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Tiêu chuẩn. Sắp có' })).toBeOnTheScreen();
  });

  it('không đặt chiều cao cố định (chữ lớn)', async () => {
    await renderWithProviders(<HeroCard title="Tiêu đề rất dài" testID="hero" />);
    expect(flat(screen.getByTestId('hero')).height).toBeUndefined();
  });
});

describe('MetricTile', () => {
  it('chỉ có nhãn khi chưa có giá trị (không số giả)', async () => {
    await renderWithProviders(<MetricTile label="Trên thiết bị" icon="clipboard" />);
    expect(screen.getByLabelText('Trên thiết bị')).toBeOnTheScreen();
  });

  it('bố cục hàng hiện giá trị chữ và đọc "nhãn: giá trị"; bấm được đủ vùng chạm', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <MetricTile
        label="Đang chờ đồng bộ"
        value="Chưa có thông tin"
        icon="clock"
        tone="warning"
        layout="row"
        onPress={onPress}
      />,
    );
    const tile = screen.getByRole('button', { name: 'Đang chờ đồng bộ: Chưa có thông tin' });
    expect(flat(tile).minHeight).toBeGreaterThanOrEqual(getMinTouchTarget());
    expect(screen.getByText('Chưa có thông tin')).toBeOnTheScreen();
    await fireEvent.press(tile);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('số 0 thật vẫn hiển thị', async () => {
    await renderWithProviders(<MetricTile label="Trên thiết bị" value={0} icon="clipboard" />);
    expect(screen.getByLabelText('Trên thiết bị: 0')).toBeOnTheScreen();
    expect(screen.getByText('0')).toBeOnTheScreen();
  });
});

describe('StatusCard', () => {
  it('trạng thái bằng chứng: nhãn mặc định từ i18n, màu từ semantic.status', async () => {
    await renderWithProviders(<StatusCard status="waiting_upload" description="Đang chờ mạng" />);
    const card = screen.getByLabelText(/Đang chờ mạng/);
    expect(card).toBeOnTheScreen();
    expect(flat(screen.getByText('Đang chờ mạng')).color).toBe(status.waitingUpload.fg);
  });

  it('uploading có tiến độ: thanh progressbar 0-100, cao theo token, kèm %', async () => {
    await renderWithProviders(<StatusCard status="uploading" progress={70} />);
    const bar = screen.getByRole('progressbar', HIDDEN);
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 70 });
    expect(flat(bar).height).toBe(component.progress);
    expect(screen.getByText('70%')).toBeOnTheScreen();
  });

  it('không truyền progress thì không có thanh; giá trị ngoài khoảng được kẹp', async () => {
    const { rerender } = await renderWithProviders(<StatusCard status="saved_on_device" />);
    expect(screen.queryByRole('progressbar', HIDDEN)).toBeNull();
    await rerender(<StatusCard status="uploading" progress={180} />);
    expect(screen.getByRole('progressbar', HIDDEN).props.accessibilityValue.now).toBe(100);
  });

  it('progress NaN/Infinity/âm không hiện "NaN%"; âm kẹp về 0', async () => {
    const { rerender } = await renderWithProviders(
      <StatusCard status="uploading" progress={Number.NaN} />,
    );
    expect(screen.queryByRole('progressbar', HIDDEN)).toBeNull();
    expect(screen.queryByText(/NaN/)).toBeNull();
    await rerender(<StatusCard status="uploading" progress={Number.POSITIVE_INFINITY} />);
    expect(screen.queryByRole('progressbar', HIDDEN)).toBeNull();
    await rerender(<StatusCard status="uploading" progress={-5} />);
    expect(screen.getByRole('progressbar', HIDDEN).props.accessibilityValue.now).toBe(0);
    expect(screen.getByText('0%')).toBeOnTheScreen();
  });

  it('nhãn nhánh status luôn là nhãn chuẩn; title/progress sai kiểu bị TypeScript chặn', async () => {
    const { rerender } = await renderWithProviders(
      // @ts-expect-error title không được ghi đè nhãn chuẩn của trạng thái bằng chứng
      <StatusCard status="verified" title="Đã đồng bộ" />,
    );
    expect(screen.getByText('Đã xác minh')).toBeOnTheScreen();
    expect(screen.queryByText('Đã đồng bộ')).toBeNull();
    // @ts-expect-error progress chỉ hợp lệ khi status là uploading
    await rerender(<StatusCard status="verified" progress={70} />);
    expect(screen.queryByRole('progressbar', HIDDEN)).toBeNull();
    expect(screen.queryByText('70%')).toBeNull();
  });

  it('thẻ theo tông (ví dụ hạn lưu) có chữ + biểu tượng, màu tông cảnh báo', async () => {
    await renderWithProviders(
      <StatusCard
        tone="warning"
        icon="clock"
        title="Sắp hết thời hạn lưu"
        description="Còn 3 ngày"
      />,
    );
    expect(screen.getByLabelText('Sắp hết thời hạn lưu. Còn 3 ngày')).toBeOnTheScreen();
    expect(flat(screen.getByText('Còn 3 ngày')).color).toBe(color.feedback.warning.fg);
  });

  it('Đã lưu trên máy không dùng màu thành công; không chiều cao cố định', async () => {
    await renderWithProviders(<StatusCard status="saved_on_device" testID="card" />);
    const card = screen.getByTestId('card');
    expect(flat(card).height).toBeUndefined();
    expect(flat(card).minHeight).toBeGreaterThanOrEqual(getMinTouchTarget());
    expect(status.savedOnDevice.fg).not.toBe(color.feedback.success.fg);
  });
});

describe('Checkbox', () => {
  function Harness({ error = false }: { error?: boolean }) {
    const [on, setOn] = useState(false);
    return <Checkbox label="Tôi hiểu và đồng ý" checked={on} onChange={setOn} error={error} />;
  }

  it('vai trò checkbox, trạng thái chọn đổi khi bấm cả hàng, đủ vùng chạm', async () => {
    await renderWithProviders(<Harness />);
    const box = screen.getByRole('checkbox', { name: 'Tôi hiểu và đồng ý' });
    expect(box).not.toBeChecked();
    expect(flat(box).minHeight).toBeGreaterThanOrEqual(getMinTouchTarget());
    await fireEvent.press(box);
    expect(screen.getByRole('checkbox', { name: 'Tôi hiểu và đồng ý' })).toBeChecked();
  });

  it('khóa khi disabled; viền đỏ khi error', async () => {
    const onChange = jest.fn();
    const { rerender } = await renderWithProviders(
      <Checkbox label="Đồng ý" checked={false} onChange={onChange} disabled />,
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Đồng ý' }));
    expect(onChange).not.toHaveBeenCalled();
    await rerender(<Checkbox label="Đồng ý" checked={false} onChange={onChange} error />);
    const box = screen.getByRole('checkbox', { name: 'Đồng ý' }).children[0] as unknown as {
      props: { style?: unknown };
    };
    expect(flat(box)).toMatchObject({
      borderColor: color.action.destructive,
      width: component.checkbox,
      height: component.checkbox,
    });
  });
});

describe('ConfirmDialog: icon và bố cục hàng', () => {
  const base = {
    visible: true,
    title: 'Xác nhận đăng xuất',
    message: 'Bạn có chắc chắn muốn đăng xuất?',
    confirmLabel: 'Đăng xuất',
    cancelLabel: 'Ở lại ứng dụng',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  it('không icon: không có ô icon (mặc định giữ nguyên)', async () => {
    await renderWithProviders(<ConfirmDialog {...base} />);
    expect(screen.queryByTestId(/^icon-/, HIDDEN)).toBeNull();
    expect(flat(screen.getByText('Xác nhận đăng xuất')).textAlign).toBeUndefined();
    expect(flat(screen.getByText('Bạn có chắc chắn muốn đăng xuất?')).textAlign).toBeUndefined();
  });

  it('không truyền prop mới: hai nút xếp dọc, nút xác nhận (chính) ở trên như trước', async () => {
    await renderWithProviders(<ConfirmDialog {...base} />);
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(labels).toEqual(['Đăng xuất', 'Ở lại ứng dụng']);
  });

  it('có icon: căn giữa nội dung, tiêu đề vẫn là header, hai nút còn bấm được', async () => {
    await renderWithProviders(<ConfirmDialog {...base} icon="sign-out" iconTone="warning" />);
    expect(screen.getByTestId('icon-log-out-outline', HIDDEN)).toBeOnTheScreen();
    expect(flat(screen.getByText('Xác nhận đăng xuất')).textAlign).toBe('center');
    expect(screen.getByRole('header', { name: 'Xác nhận đăng xuất' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ở lại ứng dụng' }));
    expect(base.onCancel).toHaveBeenCalled();
  });

  it('actionsLayout=row: hủy bên trái, xác nhận bên phải', async () => {
    await renderWithProviders(<ConfirmDialog {...base} actionsLayout="row" primary="confirm" />);
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(labels).toEqual(['Ở lại ứng dụng', 'Đăng xuất']);
  });

  it('messageTestID và confirmTestID gắn đúng phần tử, không đổi nội dung hiển thị', async () => {
    await renderWithProviders(<ConfirmDialog {...base} messageTestID="msg" confirmTestID="ok" />);
    expect(screen.getByTestId('msg')).toHaveTextContent('Bạn có chắc chắn muốn đăng xuất?');
    expect(screen.getByTestId('ok')).toBeOnTheScreen();
  });

  it('hideConfirm: chỉ một nút (nút chính), bấm là hủy; không có nút xác nhận', async () => {
    const onCancel = jest.fn();
    await renderWithProviders(
      <ConfirmDialog
        visible
        hideConfirm
        icon="camera"
        title="Đang quay video"
        message="Hãy dừng quay trước khi đăng xuất."
        cancelLabel="Ở lại ứng dụng"
        onCancel={onCancel}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual(['Ở lại ứng dụng']);
    await fireEvent.press(screen.getByRole('button', { name: 'Ở lại ứng dụng' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('confirmDisabled: nút xác nhận hiện nhưng vô hiệu, bấm không gọi onConfirm; hủy vẫn bấm được', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await renderWithProviders(
      <ConfirmDialog
        {...base}
        onConfirm={onConfirm}
        onCancel={onCancel}
        actionsLayout="row"
        confirmDisabled
        confirmTestID="ok"
      />,
    );
    expect(screen.getByTestId('ok').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId('ok'));
    expect(onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Ở lại ứng dụng' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('mặc định (không truyền confirmDisabled): nút xác nhận bấm được như trước', async () => {
    const onConfirm = jest.fn();
    await renderWithProviders(<ConfirmDialog {...base} onConfirm={onConfirm} confirmTestID="ok" />);
    expect(screen.getByTestId('ok').props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(screen.getByTestId('ok'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('không destructive, primary=confirm: nút xác nhận chính ở trên, nút hủy thứ yếu (hộp thoại cảnh báo có lối đi tiếp)', async () => {
    await renderWithProviders(
      <ConfirmDialog
        {...base}
        confirmLabel="Xem trung tâm đồng bộ"
        icon="alert-triangle"
        iconTone="warning"
      />,
    );
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(labels).toEqual(['Xem trung tâm đồng bộ', 'Ở lại ứng dụng']);
  });
});

describe('TextField: counterMax và multiline', () => {
  it('bộ đếm theo độ dài thật và nhãn đọc được', async () => {
    await renderWithProviders(
      <TextField
        label="Tên cửa hàng"
        value="Shop Thời Trang"
        onChangeText={() => undefined}
        counterMax={50}
      />,
    );
    expect(screen.getByText('15/50')).toBeOnTheScreen();
    expect(screen.getByLabelText('15 trên 50 ký tự')).toBeOnTheScreen();
  });

  it('bộ đếm cùng lúc với lỗi: cả hai hiện', async () => {
    await renderWithProviders(
      <TextField
        label="Tên"
        value="abc"
        onChangeText={() => undefined}
        counterMax={2}
        error="Tên quá dài."
      />,
    );
    expect(screen.getByText('Tên quá dài.')).toBeOnTheScreen();
    expect(screen.getByText('3/2')).toBeOnTheScreen();
  });

  it('không counterMax thì không có bộ đếm', async () => {
    await renderWithProviders(<TextField label="Tên" value="abc" onChangeText={() => undefined} />);
    expect(screen.queryByText('3/50')).toBeNull();
  });

  it('multiline: cao tối thiểu 120, không chiều cao cố định, chữ bắt đầu từ trên', async () => {
    await renderWithProviders(
      <TextField label="Nội dung" value="" onChangeText={() => undefined} multiline testID="in" />,
    );
    const input = screen.getByTestId('in');
    expect(flat(input).minHeight).toBe(component.fieldMulti);
    expect(flat(input).height).toBeUndefined();
    expect(input.props.multiline).toBe(true);
    expect(input.props.textAlignVertical).toBe('top');
  });

  it('một dòng giữ nguyên: cao 52 hoặc vùng chạm, không multiline', async () => {
    await renderWithProviders(
      <TextField label="Tên" value="" onChangeText={() => undefined} testID="in" />,
    );
    expect(flat(screen.getByTestId('in')).minHeight).toBe(Math.max(52, getMinTouchTarget()));
    expect(screen.getByTestId('in').props.multiline).toBeUndefined();
    expect(screen.getByTestId('in').props.textAlignVertical).toBeUndefined();
    expect(screen.queryByText(/\/\d+$/)).toBeNull();
  });
});

describe('TextField: required', () => {
  it('có dấu sao đỏ ẩn khỏi trình đọc và báo aria-required; nhãn truy cập không đổi', async () => {
    await renderWithProviders(
      <TextField label="Họ và tên" value="" onChangeText={() => undefined} required testID="in" />,
    );
    expect(screen.getByText('Họ và tên')).toBeOnTheScreen();
    expect(screen.getByTestId('in-required', HIDDEN)).toHaveTextContent('*');
    expect(screen.getByTestId('in').props['aria-required']).toBe(true);
    expect(screen.getByTestId('in').props.accessibilityLabel).toBe('Họ và tên');
  });

  it('dấu sao màu trung tính (textMuted), không đỏ: đỏ chỉ dành cho lỗi', async () => {
    await renderWithProviders(
      <TextField label="Họ và tên" value="" onChangeText={() => undefined} required testID="in" />,
    );
    const star = flat(screen.getByTestId('in-required', HIDDEN));
    expect(star.color).toBe(colors.textMuted);
    expect(star.color).not.toBe(colors.danger);
  });

  it('mặc định không có dấu sao', async () => {
    await renderWithProviders(
      <TextField label="Họ và tên" value="" onChangeText={() => undefined} testID="in" />,
    );
    expect(screen.queryByText('*', { exact: false, ...HIDDEN })).toBeNull();
    expect(screen.getByTestId('in').props['aria-required']).toBeUndefined();
  });
});

describe('ErrorState variant=card', () => {
  it('nền thẻ lỗi, vẫn là alert và có nút thử lại; mặc định không có nền', async () => {
    const onRetry = jest.fn();
    const { rerender } = await renderWithProviders(
      <AppThemeScope>
        <ErrorState
          title="Không thể tải"
          message="Vui lòng thử lại."
          onRetry={onRetry}
          variant="card"
          testID="es"
        />
      </AppThemeScope>,
    );
    const alert = screen.getByTestId('es');
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải');
    expect(flat(alert).backgroundColor).toBe(color.feedback.danger.bg);
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    // Nút thử lại của thẻ lỗi là nút chính (board 1c); mặc định `inline` vẫn là nút phụ như cũ.
    expect(flat(screen.getByRole('button', { name: 'Thử lại' })).backgroundColor).toBe(
      color.action.primary,
    );
    await rerender(
      <AppThemeScope>
        <ErrorState title="Không thể tải" onRetry={onRetry} />
      </AppThemeScope>,
    );
    expect(flat(screen.getByRole('button', { name: 'Thử lại' })).backgroundColor).not.toBe(
      color.action.primary,
    );
    await rerender(
      <AppThemeScope>
        <ErrorState title="Không thể tải" testID="es" />
      </AppThemeScope>,
    );
    expect(flat(screen.getByTestId('es')).backgroundColor).toBeUndefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('EmptyState: icon, hành động tùy chọn', () => {
  it('không có hành động thì không có nút', async () => {
    await renderWithProviders(
      <EmptyState
        title="Chưa có lịch sử"
        message="Khi có giao dịch sẽ hiện ở đây."
        icon="receipt"
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Chưa có lịch sử')).toBeOnTheScreen();
    expect(screen.getByTestId('icon-receipt-outline', HIDDEN)).toBeOnTheScreen();
  });

  it('không truyền prop mới: icon hộp thư, màu chữ phụ, nút phụ như trước', async () => {
    await renderWithProviders(
      <EmptyState title="Trống" message="Chưa có gì." actionLabel="Tạo" onAction={jest.fn()} />,
    );
    const glyph = screen.getByTestId('icon-file-tray-outline', HIDDEN);
    expect(flat(glyph).color).toBe(color.text.secondary);
    expect(screen.getByRole('button', { name: 'Tạo' })).toBeOnTheScreen();
  });

  it('có hành động chính bấm được', async () => {
    const onAction = jest.fn();
    await renderWithProviders(
      <EmptyState
        title="Đang ngoại tuyến"
        message="Dữ liệu có thể đã cũ."
        icon="disconnect"
        iconTone="blue"
        actionLabel="Thử lại"
        actionVariant="primary"
        onAction={onAction}
      />,
    );
    expect(screen.getByTestId('icon-unlink-outline', HIDDEN)).toBeOnTheScreen();
    expect(flat(screen.getByTestId('icon-unlink-outline', HIDDEN)).color).toBe(
      color.accent.blue.fg,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('ScreenHeader: trailing và kiểu nút quay lại', () => {
  it('hiện trailing và nút quay lại đủ vùng chạm với mũi tên dài', async () => {
    const onBack = jest.fn();
    await renderWithProviders(
      <ScreenHeader
        title="Sửa họ tên"
        onBack={onBack}
        backIcon="arrow"
        trailing={<StatusBadge label="Sắp có" />}
      />,
    );
    const back = screen.getByRole('button', { name: 'Quay lại' });
    expect(flat(back).minHeight).toBeGreaterThanOrEqual(getMinTouchTarget());
    await fireEvent.press(back);
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByText('Sắp có')).toBeOnTheScreen();
  });

  it('backIcon="arrow" đổi glyph so với mặc định (chevron)', async () => {
    const { rerender } = await renderWithProviders(
      <ScreenHeader title="Tiêu đề" onBack={jest.fn()} />,
    );
    expect(screen.getByTestId('icon-chevron-back', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByTestId('icon-arrow-back', HIDDEN)).toBeNull();
    expect(screen.queryByText('Sắp có')).toBeNull();
    await rerender(<ScreenHeader title="Tiêu đề" onBack={jest.fn()} backIcon="arrow" />);
    expect(screen.getByTestId('icon-arrow-back', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByTestId('icon-chevron-back', HIDDEN)).toBeNull();
  });
});
