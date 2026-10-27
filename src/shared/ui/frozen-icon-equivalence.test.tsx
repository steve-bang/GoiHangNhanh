import Ionicons from '@expo/vector-icons/Ionicons';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Icon } from './Icon';
import { SourceIcon } from './SourceIcon';

// Mock ghi lại props thật gửi cho Ionicons (mock chung ở jest.setup.ts không giữ `size`).
jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
const ionicons = jest.mocked(Ionicons) as unknown as jest.Mock<null, [Record<string, unknown>]>;
const lastProps = (i = -1) => ionicons.mock.calls.at(i)?.[0] ?? {};

/**
 * `Icon` và `SourceIcon` còn được các màn đã được khách hàng xác nhận (Chào mừng, đăng ký...) dùng.
 * Các giá trị dưới đây là giá trị TRƯỚC khi có token (đối chiếu `git show origin/main:<tệp>`): đổi một
 * giá trị ở đây = đổi giao diện màn đã verify, cần khách hàng duyệt (docs/design-token-spec.md mục 7).
 */
const HIDDEN = { includeHiddenElements: true } as const;

function flat(testID: string): Record<string, unknown> {
  const node = screen.getByTestId(testID, HIDDEN);
  return StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
}

beforeEach(() => ionicons.mockClear());

describe('Icon giữ nguyên so với trước khi có token', () => {
  it('cỡ mặc định 22, màu chữ #1B1B1B, ẩn khỏi trình đọc màn hình', async () => {
    await render(<Icon name="home" />);
    expect(lastProps()).toMatchObject({
      size: 22,
      color: '#1B1B1B',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no',
    });
  });

  it('cỡ và màu truyền vào được giữ nguyên', async () => {
    await render(<Icon name="home" size={30} color="#FFFFFF" />);
    expect(lastProps()).toMatchObject({ size: 30, color: '#FFFFFF' });
  });
});

describe('SourceIcon giữ nguyên so với trước khi có token', () => {
  it('ô logo: nền #FFFFFF, viền mảnh #D5DDD9, bo 0.28 cạnh, đệm 10% (tối thiểu 2)', async () => {
    await render(
      <>
        <SourceIcon source="shopee" />
        <SourceIcon source="tiktok_shop" size={10} />
      </>,
    );
    expect(flat('source-icon-shopee')).toMatchObject({
      width: 36,
      height: 36,
      borderRadius: 10,
      padding: 4,
      backgroundColor: '#FFFFFF',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#D5DDD9',
      alignItems: 'center',
      justifyContent: 'center',
    });
    expect(flat('source-icon-tiktok_shop')).toMatchObject({ borderRadius: 3, padding: 2 });
  });

  it('ô dự phòng: Lazada #4B3FD8 + tim, Khác #8FA3B8 + cửa hàng, biểu tượng trắng cỡ 0.55', async () => {
    await render(
      <>
        <SourceIcon source="lazada" />
        <SourceIcon source="other" size={40} />
      </>,
    );
    expect(flat('source-icon-lazada')).toMatchObject({
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#4B3FD8',
    });
    expect(flat('source-icon-other')).toMatchObject({
      width: 40,
      borderRadius: 11,
      backgroundColor: '#8FA3B8',
    });
    const icons = ionicons.mock.calls.map((c) => c[0]);
    expect(icons[0]).toMatchObject({ name: 'heart', size: 20, color: '#FFFFFF' });
    expect(icons[1]).toMatchObject({ name: 'storefront', size: 22, color: '#FFFFFF' });
  });
});
