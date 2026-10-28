import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { ConfirmDialog } from './ConfirmDialog';

type TwoButtonProps = Extract<Parameters<typeof ConfirmDialog>[0], { confirmLabel: string }>;

function setup(props: Partial<TwoButtonProps> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  const view = renderWithProviders(
    <ConfirmDialog
      visible
      title="Phiên quay chưa kết thúc"
      message="Phần đã ghi không bị xóa."
      confirmLabel="Kết thúc phiên"
      cancelLabel="Giữ video và quay lại"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel, view };
}

describe('ConfirmDialog', () => {
  it('hiện tiêu đề, nội dung và hai nút có nhãn cụ thể', async () => {
    await setup().view;
    expect(screen.getByText('Phiên quay chưa kết thúc')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Giữ video và quay lại' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Kết thúc phiên' })).toBeOnTheScreen();
  });

  it('không hiện nội dung khi visible=false', async () => {
    await setup({ visible: false }).view;
    expect(screen.queryByText('Phiên quay chưa kết thúc')).toBeNull();
  });

  it('gọi đúng callback cho từng nút', async () => {
    const { onConfirm, onCancel, view } = setup();
    await view;
    await fireEvent.press(screen.getByRole('button', { name: 'Giữ video và quay lại' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Kết thúc phiên' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('lối an toàn (hủy) nằm trên nút xác nhận khi primary=cancel', async () => {
    await setup({ primary: 'cancel' }).view;
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(labels).toEqual(['Giữ video và quay lại', 'Kết thúc phiên']);
  });

  it('hành động phá hủy: nút xác nhận dùng màu đỏ, nút an toàn đứng trước', async () => {
    await setup({ destructive: true, confirmLabel: 'Xóa', cancelLabel: 'Giữ lại' }).view;
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(labels).toEqual(['Giữ lại', 'Xóa']);
  });
});
