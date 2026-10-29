import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, Text as RNText, View } from 'react-native';
import { createRef } from 'react';

import { appColors, colors, layout, semantic } from '@/core/theme';
import { renderWithProviders } from '@/test-utils/render';

import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { ConfirmDialog } from './ConfirmDialog';
import { FormField } from './FormField';
import type { TextFieldInput } from './TextField';
import { ListGroup } from './ListGroup';
import { ListItem } from './ListItem';
import { Skeleton } from './Skeleton';

function flat(node: { props: { style?: unknown } }): Record<string, unknown> {
  return StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
}

/**
 * Prop tùy chọn mới của component dùng chung (PR 4b). Mặc định phải giữ nguyên để các màn đã được
 * khách hàng xác nhận không đổi (frozen-style-equivalence.test.tsx kiểm tra Button/Text).
 */
describe('Card flush', () => {
  it('mặc định giữ padding 16; flush không padding và cắt nội dung theo bo góc', async () => {
    await renderWithProviders(
      <>
        <Card testID="mac-dinh">
          <RNText>a</RNText>
        </Card>
        <Card testID="flush" flush>
          <RNText>b</RNText>
        </Card>
      </>,
    );
    expect(flat(screen.getByTestId('mac-dinh')).padding).toBe(16);
    expect(flat(screen.getByTestId('mac-dinh')).overflow).toBeUndefined();
    expect(flat(screen.getByTestId('flush'))).toMatchObject({ padding: 0, overflow: 'hidden' });
  });
});

describe('ListItem: leading, titleWeight, actionTitle, disabled', () => {
  it('mặc định: tiêu đề in đậm, màu chữ chính; titleWeight="regular" bỏ in đậm', async () => {
    await renderWithProviders(
      <>
        <ListItem title="Đậm" />
        <ListItem title="Thường" titleWeight="regular" />
      </>,
    );
    expect(flat(screen.getByText('Đậm')).fontWeight).toBe('700');
    expect(flat(screen.getByText('Thường')).fontWeight).not.toBe('700');
  });

  it('actionTitle: tiêu đề màu hành động; leading thay biểu tượng', async () => {
    await renderWithProviders(
      <ListItem
        title="Thêm họ tên"
        actionTitle
        leadingIcon="user"
        leading={<RNText testID="dan-dau">X</RNText>}
        onPress={() => undefined}
      />,
    );
    expect(flat(screen.getByText('Thêm họ tên')).color).toBe(semantic.color.action.link);
    expect(screen.getByTestId('dan-dau')).toBeOnTheScreen();
    expect(screen.queryByTestId('icon-person-circle-outline')).toBeNull();
  });

  it('disabled: không gọi onPress, báo disabled cho trợ năng', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<ListItem title="Khóa" disabled onPress={onPress} />);
    const row = screen.getByRole('button', { name: 'Khóa' });
    expect(row.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(row);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('ListGroup', () => {
  it('có tiêu đề (header), đường kẻ mảnh giữa các hàng, không kẻ thừa khi hàng rỗng', async () => {
    await renderWithProviders(
      <ListGroup title="Cài đặt" testID="nhom">
        <ListItem title="Một" />
        {null}
        <ListItem title="Hai" />
        {false}
        <ListItem title="Ba" />
      </ListGroup>,
    );
    expect(screen.getByRole('header', { name: 'Cài đặt' })).toBeOnTheScreen();
    const card = screen.getByTestId('nhom').children[1] as unknown as { children: unknown[] };
    const dividers = (card.children as { props: { style?: unknown } }[]).filter(
      (child) =>
        flat(child).height === 1 && flat(child).backgroundColor === semantic.color.border.default,
    );
    expect(dividers).toHaveLength(2); // ba hàng => hai đường kẻ
  });
});

describe('Avatar shape, Skeleton circle', () => {
  it('avatar mặc định tròn; square bo góc radius.md', async () => {
    await renderWithProviders(
      <>
        <Avatar name="Lan Anh" testID="tron" />
        <Avatar name="Shop A" shape="square" testID="vuong" />
      </>,
    );
    const size = layout.component.tile.lg;
    expect(flat(screen.getByTestId('tron', { includeHiddenElements: true })).borderRadius).toBe(
      size / 2,
    );
    expect(flat(screen.getByTestId('vuong', { includeHiddenElements: true })).borderRadius).toBe(
      layout.radius.md,
    );
  });

  it('skeleton tròn: rộng bằng cao và bo nửa cạnh', async () => {
    await renderWithProviders(
      <View>
        <Skeleton circle height={40} width="50%" />
      </View>,
    );
    const node = screen.getByLabelText('Đang tải', { includeHiddenElements: true });
    expect(flat(node)).toMatchObject({ width: 40, height: 40, borderRadius: 20 });
  });
});

describe('Button outlined (chỉ destructive)', () => {
  it('mặc định destructive vẫn nền đỏ đặc; outlined là nền trắng, viền và chữ đỏ', async () => {
    await renderWithProviders(
      <>
        <Button label="Đặc" variant="destructive" onPress={() => undefined} />
        <Button label="Viền" variant="destructive" outlined onPress={() => undefined} />
      </>,
    );
    expect(flat(screen.getByRole('button', { name: 'Đặc' }))).toMatchObject({
      backgroundColor: colors.danger,
    });
    expect(flat(screen.getByRole('button', { name: 'Viền' }))).toMatchObject({
      backgroundColor: colors.surface,
      borderColor: colors.danger,
    });
  });
});

describe('ConfirmDialog detail và confirmOutlined', () => {
  it('mặc định giữ nút xác nhận phá hủy nền đỏ đặc và không có dòng phụ', async () => {
    await renderWithProviders(
      <ConfirmDialog
        visible
        destructive
        title="T"
        message="Nội dung"
        confirmLabel="Xóa"
        cancelLabel="Giữ"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(flat(screen.getByRole('button', { name: 'Xóa' }))).toMatchObject({
      backgroundColor: appColors.danger,
    });
    expect(screen.queryByText('Dòng phụ')).toBeNull();
  });

  it('confirmOutlined + detail: nút xác nhận viền đỏ, nút an toàn vẫn là nút chính, có dòng phụ mờ', async () => {
    await renderWithProviders(
      <ConfirmDialog
        visible
        destructive
        confirmOutlined
        title="T"
        message="Nội dung"
        detail="Dòng phụ"
        confirmLabel="Xóa"
        cancelLabel="Giữ"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByText('Dòng phụ')).toBeOnTheScreen();
    expect(flat(screen.getByRole('button', { name: 'Xóa' }))).toMatchObject({
      backgroundColor: appColors.surface,
      borderColor: appColors.danger,
    });
    expect(flat(screen.getByRole('button', { name: 'Giữ' }))).toMatchObject({
      backgroundColor: appColors.brand,
    });
  });
});

describe('TextField inputRef', () => {
  it('truyền được ref tới ô nhập (để đưa focus vào ô lỗi)', async () => {
    const ref = createRef<TextFieldInput>();
    await renderWithProviders(
      <FormField label="Tên" value="" onChangeText={() => undefined} inputRef={ref} />,
    );
    expect(ref.current).not.toBeNull();
  });
});
