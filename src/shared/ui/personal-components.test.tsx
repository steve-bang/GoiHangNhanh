import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { useState } from 'react';

import { getMinTouchTarget } from '@/platform';
import { renderWithProviders } from '@/test-utils/render';

import { Avatar } from './Avatar';
import { ErrorState } from './ErrorState';
import { FormField, PasswordField } from './FormField';
import { ListItem } from './ListItem';
import { StatusBadge } from './StatusBadge';
import { Switch } from './Switch';
import { useToast } from './Toast';

function minHeightOf(node: unknown): number {
  const flat = ([] as unknown[]).concat(
    ...[(node as { props: { style: unknown } }).props.style].flat(Infinity as 1),
  ) as ({ minHeight?: number } | false | null | undefined)[];
  return Math.max(0, ...flat.map((s) => (s && typeof s === 'object' ? (s.minHeight ?? 0) : 0)));
}

describe('ListItem', () => {
  it('là nút có nhãn gồm tiêu đề + phụ đề, bấm được và đủ vùng chạm', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<ListItem title="Cửa hàng" subtitle="Tên shop" onPress={onPress} />);
    const row = screen.getByRole('button', { name: 'Cửa hàng. Tên shop' });
    expect(minHeightOf(row)).toBeGreaterThanOrEqual(getMinTouchTarget());
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('không có onPress thì không phải nút', async () => {
    await renderWithProviders(<ListItem title="Phiên bản" subtitle="1.0.0" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Phiên bản. 1.0.0')).toBeOnTheScreen();
  });

  it('khóa khi disabled', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<ListItem title="Gói" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Gói' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Gói' })).toBeDisabled();
  });
});

describe('Switch', () => {
  function Harness({ initial = false }: { initial?: boolean }) {
    const [value, setValue] = useState(initial);
    return <Switch label="Dung lượng sắp đầy" value={value} onValueChange={setValue} />;
  }

  it('có vai trò switch, trạng thái bật/tắt và đổi khi bấm cả hàng', async () => {
    await renderWithProviders(<Harness />);
    const sw = screen.getByRole('switch', { name: 'Dung lượng sắp đầy' });
    expect(sw).not.toBeChecked();
    expect(minHeightOf(sw)).toBeGreaterThanOrEqual(getMinTouchTarget());
    await fireEvent.press(sw);
    expect(screen.getByRole('switch', { name: 'Dung lượng sắp đầy' })).toBeChecked();
  });

  it('khóa khi disabled', async () => {
    const onValueChange = jest.fn();
    await renderWithProviders(
      <Switch label="Đồng bộ" value={false} onValueChange={onValueChange} disabled />,
    );
    await fireEvent.press(screen.getByRole('switch', { name: 'Đồng bộ' }));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('FormField / PasswordField', () => {
  it('hiện nhãn, lỗi (đọc ngay) và gợi ý khi chưa có lỗi', async () => {
    const { rerender } = await renderWithProviders(
      <FormField label="Họ và tên" value="" onChangeText={() => {}} hint="Gợi ý ngắn" />,
    );
    expect(screen.getByText('Họ và tên')).toBeOnTheScreen();
    expect(screen.getByText('Gợi ý ngắn')).toBeOnTheScreen();
    await rerender(
      <FormField
        label="Họ và tên"
        value=""
        onChangeText={() => {}}
        hint="Gợi ý ngắn"
        error="Hãy nhập họ và tên."
      />,
    );
    expect(screen.getByText('Hãy nhập họ và tên.')).toBeOnTheScreen();
    expect(screen.queryByText('Gợi ý ngắn')).toBeNull();
  });

  it('mật khẩu ẩn mặc định, nút Hiện/Ẩn đổi và có nhãn chữ', async () => {
    await renderWithProviders(
      <PasswordField label="Mật khẩu mới" value="abc" onChangeText={() => {}} testID="pw" />,
    );
    expect(screen.getByTestId('pw').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(screen.getByTestId('pw').props.secureTextEntry).toBeFalsy();
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toBeOnTheScreen();
  });

  it('nút Hiện/Ẩn đủ vùng chạm', async () => {
    await renderWithProviders(
      <PasswordField label="Mật khẩu" value="" onChangeText={() => {}} testID="pw" />,
    );
    const toggle = screen.getByRole('button', { name: 'Hiện mật khẩu' });
    const style = ([] as unknown[]).concat(toggle.props.style).flat(Infinity as 1) as {
      minWidth?: number;
      minHeight?: number;
    }[];
    expect(Math.max(...style.map((s) => s?.minHeight ?? 0))).toBeGreaterThanOrEqual(
      getMinTouchTarget(),
    );
    expect(Math.max(...style.map((s) => s?.minWidth ?? 0))).toBeGreaterThanOrEqual(
      getMinTouchTarget(),
    );
  });
});

describe('StatusBadge', () => {
  it('luôn có chữ (không chỉ màu) cho mọi sắc thái', async () => {
    await renderWithProviders(
      <>
        {(['neutral', 'info', 'success', 'warning', 'danger'] as const).map((tone) => (
          <StatusBadge key={tone} tone={tone} label={`Nhãn ${tone}`} />
        ))}
      </>,
    );
    for (const tone of ['neutral', 'info', 'success', 'warning', 'danger']) {
      expect(screen.getByLabelText(`Nhãn ${tone}`)).toBeOnTheScreen();
      expect(screen.getByText(`Nhãn ${tone}`)).toBeOnTheScreen();
    }
  });
});

describe('Avatar', () => {
  it('hiện chữ cái đầu; không có tên thì hiện biểu tượng, không bịa chữ', async () => {
    const { rerender } = await renderWithProviders(<Avatar name="Nguyễn Văn An" />);
    expect(screen.getByText('NA', { includeHiddenElements: true })).toBeOnTheScreen();
    await rerender(<Avatar name={null} />);
    expect(screen.queryByText('NA', { includeHiddenElements: true })).toBeNull();
    expect(
      screen.getByTestId('icon-person-circle-outline', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('mặc định ẩn khỏi trình đọc màn hình; có nhãn thì đọc được', async () => {
    const { rerender } = await renderWithProviders(<Avatar name="An" testID="av" />);
    expect(screen.getByTestId('av', { includeHiddenElements: true }).props.accessible).toBe(false);
    await rerender(<Avatar name="An" testID="av" accessibilityLabel="Ảnh đại diện" />);
    expect(screen.getByLabelText('Ảnh đại diện')).toBeOnTheScreen();
  });
});

describe('ErrorState', () => {
  it('báo lỗi (alert), có nút Thử lại gọi đúng hàm; khóa khi đang thử lại', async () => {
    const onRetry = jest.fn();
    const { rerender } = await renderWithProviders(
      <ErrorState title="Chưa tải được hồ sơ." message="Hãy thử lại." onRetry={onRetry} />,
    );
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await rerender(<ErrorState title="Chưa tải được hồ sơ." onRetry={onRetry} retrying />);
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeBusy();
  });

  it('không có onRetry thì không có nút', async () => {
    await renderWithProviders(<ErrorState title="Chưa khả dụng." />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Toast', () => {
  function Trigger({
    tone,
    durationMs,
  }: {
    tone?: 'info' | 'success' | 'error';
    durationMs?: number;
  }) {
    const toast = useToast();
    return (
      <RNText
        testID="go"
        onPress={() =>
          toast.show('Đã lưu họ tên.', {
            ...(tone ? { tone } : {}),
            ...(durationMs !== undefined ? { durationMs } : {}),
          })
        }
      >
        go
      </RNText>
    );
  }

  it('tự ẩn sau thời gian đã đặt (thông báo thành công)', async () => {
    await renderWithProviders(<Trigger tone="success" durationMs={30} />);
    await fireEvent.press(screen.getByTestId('go'));
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    expect(screen.getByText('Đã lưu họ tên.')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByTestId('toast')).toBeNull());
  });

  it('thông báo lỗi giữ lại tới khi đóng (không tự ẩn)', async () => {
    await renderWithProviders(<Trigger tone="error" />);
    await fireEvent.press(screen.getByTestId('go'));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(screen.getByTestId('toast')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('thông báo mới thay thông báo cũ', async () => {
    function Two() {
      const toast = useToast();
      return (
        <>
          <RNText testID="a" onPress={() => toast.show('Một')}>
            a
          </RNText>
          <RNText testID="b" onPress={() => toast.show('Hai')}>
            b
          </RNText>
        </>
      );
    }
    await renderWithProviders(<Two />);
    await fireEvent.press(screen.getByTestId('a'));
    await fireEvent.press(screen.getByTestId('b'));
    expect(screen.queryByText('Một')).toBeNull();
    expect(screen.getByText('Hai')).toBeOnTheScreen();
  });
});

describe('chữ lớn', () => {
  it('ListItem không đặt height cố định nên nở theo chữ khi cỡ chữ hệ thống lớn', async () => {
    // ListItem/Switch chỉ đặt minHeight (không height cố định) nên nở theo chữ.
    await renderWithProviders(
      <ListItem title="Một tiêu đề khá dài để kiểm tra xuống dòng" onPress={() => {}} />,
    );
    const row = screen.getByRole('button');
    const styles = ([] as unknown[]).concat(row.props.style).flat(Infinity as 1) as {
      height?: number;
    }[];
    expect(styles.some((s) => s && s.height !== undefined)).toBe(false);
  });
});
