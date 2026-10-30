import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { LEGAL_LINKS } from '@/core/config/legal-links';
import { resources } from '@/core/i18n/resources';
import { ROUTES } from '@/core/navigation';
import { openExternalLink } from '@/platform/external-link';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { createUnavailablePersonalGateways } from '../data/unavailable-personal-gateways';
import { HELP_ARTICLES, HELP_CATEGORY_IDS } from '../domain/help-content';
import { HelpArticleScreen } from './HelpArticleScreen';
import { HelpCategoryScreen } from './HelpCategoryScreen';
import { HelpScreen } from './HelpScreen';
import { helpArticleKey } from './help-text';
import { LegalScreen } from './LegalScreen';
import { SupportContactScreen } from './SupportContactScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock('@/platform/external-link', () => ({
  openExternalLink: jest.fn(),
  openAppSettings: jest.fn(),
}));
const mockSupportEmail = jest.fn<string | null, []>(() => null);
jest.mock('@/core/config/support-contact', () => ({
  getSupportEmail: () => mockSupportEmail(),
}));
// LEGAL_LINKS là hằng `as const` nhưng không bị đóng băng lúc chạy: test đặt URL thật rồi khôi phục.
const legal = LEGAL_LINKS as { terms: string; privacy: string };
const ORIGINAL_LEGAL = { ...LEGAL_LINKS };
const open = openExternalLink as jest.MockedFunction<typeof openExternalLink>;

beforeEach(() => {
  resetMockNavigation();
  open.mockReset();
  mockSupportEmail.mockReturnValue(null);
  legal.terms = ORIGINAL_LEGAL.terms;
  legal.privacy = ORIGINAL_LEGAL.privacy;
});

const help = resources.vi.personal.help;

describe('Trung tâm trợ giúp (UI-I06, khung 15)', () => {
  it('hiện ô tìm, ba danh mục có bài (không "Cập nhật sản phẩm"), bài đề xuất và lối liên hệ/điều khoản', async () => {
    await renderWithProviders(<HelpScreen />);
    expect(screen.getByTestId('screen-UI-I06')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Tìm hướng dẫn, ví dụ: tải lên')).toBeOnTheScreen();
    for (const category of HELP_CATEGORY_IDS) {
      expect(screen.getByTestId(`help-category-${category}`)).toBeOnTheScreen();
    }
    expect(screen.queryByText('Cập nhật sản phẩm')).toBeNull();
    expect(screen.getByText('Bài viết đề xuất')).toBeOnTheScreen();
    expect(screen.getByTestId('help-featured-recordPack')).toBeOnTheScreen();
    expect(screen.getByTestId('help-contact-row')).toBeOnTheScreen();
    expect(screen.getByTestId('help-legal-row')).toBeOnTheScreen();
  });

  it('danh mục đọc kèm số bài; bấm mở danh mục, bài đề xuất, liên hệ, điều khoản', async () => {
    await renderWithProviders(<HelpScreen />);
    const row = screen.getByTestId('help-category-guide');
    expect(row.props.accessibilityLabel).toBe('Hướng dẫn sử dụng, 4 bài');
    await fireEvent.press(row);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.helpCategory, {
      categoryId: 'guide',
    });
    await fireEvent.press(screen.getByTestId('help-featured-unsynced'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.helpArticle, {
      articleId: 'unsynced',
    });
    await fireEvent.press(screen.getByTestId('help-contact-row'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.helpContact);
    await fireEvent.press(screen.getByTestId('help-legal-row'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.helpLegal);
  });

  it('tìm không dấu có kết quả: thay danh mục bằng danh sách kết quả, đếm kết quả, bấm mở bài', async () => {
    await renderWithProviders(<HelpScreen />);
    await fireEvent.changeText(screen.getByTestId('help-search'), 'nhan trang thai');
    expect(screen.getByTestId('help-results')).toBeOnTheScreen();
    expect(screen.getByTestId('help-result-unsynced')).toBeOnTheScreen();
    expect(screen.getByTestId('help-result-count')).toHaveTextContent('Có 1 hướng dẫn phù hợp');
    expect(screen.queryByTestId('help-categories')).toBeNull();
    await fireEvent.press(screen.getByTestId('help-result-unsynced'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.helpArticle, {
      articleId: 'unsynced',
    });
  });

  it('tìm không có kết quả: trạng thái rỗng đúng chữ, có lối Liên hệ hỗ trợ, không trang trắng', async () => {
    await renderWithProviders(<HelpScreen />);
    await fireEvent.changeText(screen.getByTestId('help-search'), 'thanh toan visa');
    expect(screen.getByText('Chưa tìm thấy hướng dẫn phù hợp.')).toBeOnTheScreen();
    expect(screen.getByText('Thử từ khóa khác nhé.')).toBeOnTheScreen();
    expect(screen.queryByTestId('help-results')).toBeNull();
    await fireEvent.press(screen.getByText('Liên hệ hỗ trợ'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.helpContact);
  });

  it('xóa ô tìm (hoặc chỉ khoảng trắng) quay về danh mục', async () => {
    await renderWithProviders(<HelpScreen />);
    await fireEvent.changeText(screen.getByTestId('help-search'), 'zzzz');
    expect(screen.queryByTestId('help-categories')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('help-search'), '   ');
    expect(screen.getByTestId('help-categories')).toBeOnTheScreen();
  });

  it('mọi bài khai báo đều tìm được bằng chính tiêu đề của nó', async () => {
    await renderWithProviders(<HelpScreen />);
    for (const article of HELP_ARTICLES) {
      const title =
        resources.vi.personal.help.articles[article.id as keyof typeof help.articles].title;
      await fireEvent.changeText(screen.getByTestId('help-search'), title);
      expect(screen.getByTestId(`help-result-${article.id}`)).toBeOnTheScreen();
    }
  });
});

describe('Danh mục trợ giúp', () => {
  it('hiện tiêu đề danh mục và các bài; bấm mở bài', async () => {
    mockNavigation.params = { categoryId: 'faq' };
    await renderWithProviders(<HelpCategoryScreen />);
    expect(screen.getAllByText('Câu hỏi thường gặp').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('help-article-row-scope'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.helpArticle, {
      articleId: 'scope',
    });
  });

  it('danh mục lạ: trạng thái rỗng, nút về Trung tâm trợ giúp', async () => {
    mockNavigation.params = { categoryId: 'cap-nhat-san-pham' };
    await renderWithProviders(<HelpCategoryScreen />);
    expect(screen.getByText('Không tìm thấy bài này')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Về Trung tâm trợ giúp'));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.help);
  });
});

describe('Chi tiết bài hướng dẫn (khung 16)', () => {
  it('hiện tiêu đề, mô tả, các bước đánh số; tiêu đề header là tên danh mục; không ảnh/nút phát/phản hồi', async () => {
    mockNavigation.params = { articleId: 'createOrder' };
    await renderWithProviders(<HelpArticleScreen />);
    expect(screen.getByTestId('help-article-title')).toHaveTextContent(
      'Tạo đơn bằng cách quét hoặc nhập mã',
    );
    expect(screen.getAllByText('Hướng dẫn sử dụng').length).toBeGreaterThan(0);
    expect(screen.getByText('Các bước thực hiện')).toBeOnTheScreen();
    expect(screen.getByTestId('help-article-step-3')).toHaveTextContent(/^3\./);
    expect(screen.getByTestId('help-article-step-1').props.accessibilityLabel).toMatch(/^Bước 1: /);
    expect(screen.queryByLabelText(/phát|play/i)).toBeNull();
    expect(screen.queryByText(/hữu ích/i)).toBeNull();
  });

  it('"Tiếp theo" chỉ có khi có bài kế tiếp thật và mở bài đó', async () => {
    mockNavigation.params = { articleId: 'createOrder' };
    await renderWithProviders(<HelpArticleScreen />);
    const next = screen.getByTestId('help-article-next');
    expect(next.props.accessibilityHint).toBe('Mở bài: Tìm và xem lại đơn hàng');
    await fireEvent.press(next);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.helpArticle, {
      articleId: 'findOrder',
    });
  });

  it('bài cuối của danh mục: không có "Tiếp theo"; bài hỏi đáp không có phần các bước', async () => {
    mockNavigation.params = { articleId: 'deleteAccount' };
    await renderWithProviders(<HelpArticleScreen />);
    expect(screen.queryByTestId('help-article-next')).toBeNull();
    expect(screen.queryByText('Các bước thực hiện')).toBeNull();
    expect(screen.getByTestId('help-article-summary')).toBeOnTheScreen();
  });

  it('bài giới hạn khi quay (Q-24b): nói đoạn đang quay có thể mất khi app bị tắt, không hứa quay tiếp', async () => {
    mockNavigation.params = { articleId: 'recordingLimits' };
    await renderWithProviders(<HelpArticleScreen />);
    const summary = screen.getByTestId('help-article-summary');
    expect(summary).toHaveTextContent(/bị tắt giữa chừng, đoạn đang quay có thể mất/);
    expect(summary).toHaveTextContent(/không tự quay tiếp/);
  });

  it('bài "chưa ghi video" nói thẳng điều đó, không hướng dẫn như đã quay được', async () => {
    mockNavigation.params = { articleId: 'recordPack' };
    await renderWithProviders(<HelpArticleScreen />);
    expect(screen.getByTestId('help-article-summary')).toHaveTextContent(/chưa ghi/);
    expect(screen.getByTestId('help-article-title')).toHaveTextContent(/chưa ghi video/);
  });

  it('bài "camera bị tắt" nhắc cả màn quay; bài "chưa đồng bộ" nói đúng giới hạn mã băm, không hứa giữ bản trên máy', async () => {
    mockNavigation.params = { articleId: 'cameraOff' };
    await renderWithProviders(<HelpArticleScreen />);
    expect(screen.getByTestId('help-article-summary')).toHaveTextContent(/xem trước ở màn quay/);
    expect(screen.getByTestId('help-article-summary')).not.toHaveTextContent(/chỉ dùng camera/);
    mockNavigation.params = { articleId: 'unsynced' };
    await renderWithProviders(<HelpArticleScreen />);
    const step3 = screen.getAllByTestId('help-article-step-3').at(-1);
    expect(step3).toHaveTextContent(/máy chủ tính lại mã băm và thấy khớp/);
    expect(step3).toHaveTextContent(/không cho biết video quay lúc nào hay có chân thực không/);
    expect(step3).not.toHaveTextContent(/vẫn được giữ/);
  });

  it('bài Wi‑Fi (V1-18): chỉ đường tới công tắc; điểm phát Wi‑Fi từ máy khác vẫn tốn dữ liệu di động', async () => {
    mockNavigation.params = { articleId: 'wifiOnly' };
    await renderWithProviders(<HelpArticleScreen />);
    expect(screen.getByTestId('help-article-title')).toHaveTextContent('Chỉ tải khi có Wi‑Fi');
    expect(screen.getByTestId('help-article-summary')).toHaveTextContent(/Mặc định .* 4G\/5G/);
    expect(screen.getByTestId('help-article-step-1')).toHaveTextContent(/Trung tâm đồng bộ/);
    expect(screen.getByTestId('help-article-step-3')).toHaveTextContent(
      /Phát Wi‑Fi từ một điện thoại khác vẫn được coi là Wi‑Fi, nên vẫn tốn dữ liệu di động/,
    );
  });

  it('bài tải lên (V1-18): chỉ tải khi app mở, tắt thì dừng, mở lại thì tiếp; không hứa tải nền', async () => {
    mockNavigation.params = { articleId: 'uploadWhenOpen' };
    await renderWithProviders(<HelpArticleScreen />);
    const summary = screen.getByTestId('help-article-summary');
    expect(summary).toHaveTextContent(/chỉ tải lên khi đang mở/);
    expect(summary).toHaveTextContent(/Tắt ứng dụng thì việc tải dừng lại, mở lại thì tải tiếp/);
    expect(summary).not.toHaveTextContent(/nền/);
  });

  it('bài đổi máy, thời hạn lưu, xóa tài khoản, mã băm: đúng câu v1 (Q-24a, mục 1.2, R-4)', async () => {
    const summaryOf = async (articleId: string) => {
      mockNavigation.params = { articleId };
      await renderWithProviders(<HelpArticleScreen />);
      return screen.getAllByTestId('help-article-summary').at(-1);
    };
    const change = await summaryOf('changeDevice');
    expect(change).toHaveTextContent(/Tệp trên máy này sẽ mất nếu bạn gỡ ứng dụng\./);
    expect(change).toHaveTextContent(/máy mới sẽ không thấy đơn và video của máy cũ/);
    expect(await summaryOf('retention')).toHaveTextContent(
      'Hiện ứng dụng chưa tự động xóa bằng chứng đã tải lên và chưa áp dụng thời hạn lưu. Nếu có thay đổi, bạn sẽ được báo trước trong ứng dụng. Tệp trên máy này sẽ mất nếu bạn gỡ ứng dụng.',
    );
    expect(await summaryOf('deleteAccount')).toHaveTextContent(/xóa hẳn sau 30 ngày/);
    const hash = await summaryOf('hashMeaning');
    expect(hash).toHaveTextContent(/tệp không đổi kể từ lúc tính/);
    expect(hash).toHaveTextContent(/không cho biết video quay lúc nào hay có chân thực không/);
    expect(await summaryOf('whereData')).toHaveTextContent(/một tài khoản trên một máy/);
  });

  it('bài tìm đơn nói đúng giới hạn sửa đơn (R-6, QA-13 một phần): đơn đã quay chưa sửa được sản phẩm', async () => {
    mockNavigation.params = { articleId: 'findOrder' };
    await renderWithProviders(<HelpArticleScreen />);
    expect(screen.getByTestId('help-article-step-3')).toHaveTextContent(
      /Đơn chưa quay thì sửa được\. Đơn đã quay thì bản này chưa cho sửa sản phẩm\./,
    );
  });

  it('bài lạ: trạng thái rỗng, nút về Trung tâm trợ giúp (không trang trắng)', async () => {
    mockNavigation.params = { articleId: 'khong-co' };
    await renderWithProviders(<HelpArticleScreen />);
    expect(screen.getByText('Không tìm thấy bài này')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Về Trung tâm trợ giúp'));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.help);
  });
});

describe('Liên hệ hỗ trợ (khung 17)', () => {
  const fill = async (
    over: Partial<Record<'name' | 'subject' | 'order' | 'message', string>> = {},
  ) => {
    if (over.name !== undefined)
      await fireEvent.changeText(screen.getByTestId('support-name'), over.name);
    await fireEvent.changeText(
      screen.getByTestId('support-subject'),
      over.subject ?? 'Không quét được',
    );
    if (over.order)
      await fireEvent.changeText(screen.getByTestId('support-order-code'), over.order);
    await fireEvent.changeText(
      screen.getByTestId('support-message'),
      over.message ?? 'Camera không đọc mã',
    );
  };

  it('chưa có địa chỉ hỗ trợ: nói rõ chưa gửi được, nút khóa, bấm không mở gì và không báo "đã gửi"', async () => {
    await renderWithProviders(<SupportContactScreen />);
    expect(screen.getByTestId('support-no-channel')).toHaveTextContent(
      /Kênh nhận hỗ trợ chưa mở nên chưa gửi được từ ứng dụng\./,
    );
    const send = screen.getByTestId('support-send');
    expect(send.props.accessibilityState).toMatchObject({ disabled: true });
    expect(send.props.accessibilityHint).toBe('Chưa dùng được. Kênh nhận hỗ trợ sắp có.');
    await fireEvent.press(send);
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByText(/đã gửi|đã mở/i)).toBeNull();
  });

  it('họ tên điền sẵn từ hồ sơ; chưa có tên thì để trống; không có ô số điện thoại', async () => {
    await renderWithProviders(<SupportContactScreen />, {
      personalGateways: createFakePersonalGateways({ profile: { displayName: 'Trần Văn Minh' } }),
    });
    await waitFor(() =>
      expect(screen.getByTestId('support-name').props.value).toBe('Trần Văn Minh'),
    );
    expect(screen.queryByText(/Số điện thoại/)).toBeNull();
  });

  it('hồ sơ chưa có họ tên hoặc không tải được: ô họ tên trống, vẫn dùng được', async () => {
    await renderWithProviders(<SupportContactScreen />, {
      personalGateways: createFakePersonalGateways({ profile: { displayName: null } }),
    });
    await waitFor(() => expect(screen.getByTestId('support-name')).toBeOnTheScreen());
    expect(screen.getByTestId('support-name').props.value).toBe('');
    await renderWithProviders(<SupportContactScreen />, {
      personalGateways: createUnavailablePersonalGateways() as never,
    });
    expect(screen.getAllByTestId('support-name').at(-1)?.props.value).toBe('');
  });

  it('có địa chỉ: bấm Gửi khi thiếu thông tin hiện lỗi từng ô, không mở email', async () => {
    mockSupportEmail.mockReturnValue('ho-tro@example.com');
    await renderWithProviders(<SupportContactScreen />, {
      personalGateways: createFakePersonalGateways({ profile: { displayName: null } }),
    });
    await fireEvent.press(screen.getByTestId('support-send'));
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByText('Hãy nhập họ và tên.')).toBeOnTheScreen();
    expect(screen.getByText('Hãy nhập chủ đề.')).toBeOnTheScreen();
    expect(screen.getByText('Hãy nhập nội dung cần hỗ trợ.')).toBeOnTheScreen();
  });

  it('mã đơn quá dài: ô nhập giới hạn 65 ký tự, quá 64 thì báo lỗi và không mở email (không cắt âm thầm)', async () => {
    mockSupportEmail.mockReturnValue('ho-tro@example.com');
    await renderWithProviders(<SupportContactScreen />, {
      personalGateways: createFakePersonalGateways({ profile: { displayName: 'Minh' } }),
    });
    await waitFor(() => expect(screen.getByTestId('support-name').props.value).toBe('Minh'));
    expect(screen.getByTestId('support-order-code').props.maxLength).toBe(65);
    await fill({ order: 'D'.repeat(65) });
    await fireEvent.press(screen.getByTestId('support-send'));
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByText('Mã đơn quá dài (tối đa 64 ký tự).')).toBeOnTheScreen();
  });

  it('có địa chỉ: mở email soạn sẵn; chỉ báo "đã mở", KHÔNG báo "đã gửi"; không đính kèm dữ liệu khác', async () => {
    mockSupportEmail.mockReturnValue('ho-tro@example.com');
    open.mockResolvedValue(true);
    await renderWithProviders(<SupportContactScreen />, {
      personalGateways: createFakePersonalGateways({ profile: { displayName: 'Minh' } }),
    });
    await waitFor(() => expect(screen.getByTestId('support-name').props.value).toBe('Minh'));
    await fill({ order: 'DH01' });
    await fireEvent.press(screen.getByTestId('support-send'));
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    const url = open.mock.calls[0]?.[0] ?? '';
    expect(url.startsWith('mailto:ho-tro@example.com?')).toBe(true);
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    expect(params.get('subject')).toBe('Không quét được');
    expect(params.get('body')).toBe('Họ và tên: Minh\r\nMã đơn: DH01\r\n\r\nCamera không đọc mã');
    expect(
      await screen.findByText('Đã mở ứng dụng email. Hãy bấm Gửi trong email để hoàn tất.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/đã gửi yêu cầu|gửi thành công/i)).toBeNull();
    // Nội dung người dùng vẫn còn (email có thể chưa được gửi).
    expect(screen.getByTestId('support-message').props.value).toBe('Camera không đọc mã');
  });

  it('không mở được ứng dụng email: báo lỗi đúng chữ, giữ nội dung, không báo đã mở', async () => {
    mockSupportEmail.mockReturnValue('ho-tro@example.com');
    open.mockResolvedValue(false);
    await renderWithProviders(<SupportContactScreen />);
    await fill({ name: 'Minh' });
    await fireEvent.press(screen.getByTestId('support-send'));
    expect(await screen.findByTestId('support-open-error')).toHaveTextContent(
      'Chưa mở được ứng dụng email. Bạn thử lại nhé.',
    );
    expect(screen.queryByText(/Đã mở ứng dụng email/)).toBeNull();
    expect(screen.getByTestId('support-message').props.value).toBe('Camera không đọc mã');
  });

  it('chống gửi lặp: bấm liên tiếp khi đang mở chỉ mở một lần', async () => {
    mockSupportEmail.mockReturnValue('ho-tro@example.com');
    let finish!: (value: boolean) => void;
    open.mockReturnValue(new Promise<boolean>((resolve) => (finish = resolve)));
    await renderWithProviders(<SupportContactScreen />);
    await fill({ name: 'Minh' });
    await fireEvent.press(screen.getByTestId('support-send'));
    await fireEvent.press(screen.getByTestId('support-send'));
    await fireEvent.press(screen.getByTestId('support-send'));
    expect(open).toHaveBeenCalledTimes(1);
    await act(async () => finish(true));
    await fireEvent.press(screen.getByTestId('support-send'));
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('rời màn trong lúc mở email: không hiện thông báo thay người dùng', async () => {
    mockSupportEmail.mockReturnValue('ho-tro@example.com');
    let finish!: (value: boolean) => void;
    open.mockReturnValue(new Promise<boolean>((resolve) => (finish = resolve)));
    await renderWithProviders(<SupportContactScreen />);
    await fill({ name: 'Minh' });
    await fireEvent.press(screen.getByTestId('support-send'));
    mockNavigation.screenActive = false;
    await act(async () => finish(true));
    expect(screen.queryByText(/Đã mở ứng dụng email/)).toBeNull();
  });
});

describe('Điều khoản và chính sách (khung 18)', () => {
  it('URL giữ chỗ: hai hàng khóa "Sắp có", đọc là không dùng được, bấm không mở gì; có thẻ giải thích', async () => {
    await renderWithProviders(<LegalScreen />);
    expect(screen.getByTestId('legal-note')).toBeOnTheScreen();
    for (const id of ['terms', 'privacy']) {
      const row = screen.getByTestId(`legal-${id}`);
      expect(row).toHaveTextContent(/Sắp có/);
      expect(row.props.accessibilityState).toMatchObject({ disabled: true });
      expect(row.props.accessibilityLabel).toMatch(/\. Sắp có$/);
      expect(row.props.accessibilityHint).toBe('Chưa dùng được. Trang này sắp có.');
      await fireEvent.press(row);
    }
    expect(open).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('không dựng "Chính sách đổi trả" (D20) và không bịa "Chính sách dữ liệu"', async () => {
    await renderWithProviders(<LegalScreen />);
    expect(screen.getByText('Điều khoản sử dụng')).toBeOnTheScreen();
    expect(screen.getByText('Chính sách quyền riêng tư')).toBeOnTheScreen();
    expect(screen.queryByText(/đổi trả/i)).toBeNull();
    expect(screen.queryByText(/chính sách dữ liệu/i)).toBeNull();
  });

  it('có URL thật: hàng mở được và mở đúng URL; mở lỗi hiện thông báo', async () => {
    legal.terms = 'https://doncung.vn/terms';
    legal.privacy = 'https://doncung.vn/privacy';
    open.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await renderWithProviders(<LegalScreen />);
    expect(screen.queryByTestId('legal-note')).toBeNull();
    expect(screen.getByTestId('legal-terms')).not.toHaveTextContent(/Sắp có/);
    await fireEvent.press(screen.getByTestId('legal-terms'));
    expect(open).toHaveBeenLastCalledWith('https://doncung.vn/terms');
    await waitFor(() => expect(screen.queryByTestId('legal-open-error')).toBeNull());
    await fireEvent.press(screen.getByTestId('legal-privacy'));
    expect(open).toHaveBeenLastCalledWith('https://doncung.vn/privacy');
    expect(await screen.findByTestId('legal-open-error')).toHaveTextContent(
      'Chưa mở được trang này. Bạn thử lại nhé.',
    );
  });
});

describe('bản bài theo cờ ghi video (V1-18)', () => {
  it('cờ tắt: bài quay/đồng bộ dùng bản "chưa ghi video"; cờ bật: bản quay thật; bài khác không đổi', () => {
    expect(helpArticleKey('recordPack', false)).toBe('personal:help.articlesPreview.recordPack');
    expect(helpArticleKey('recordPack', true)).toBe('personal:help.articles.recordPack');
    expect(helpArticleKey('unsynced', false)).toBe('personal:help.articlesPreview.unsynced');
    expect(helpArticleKey('unsynced', true)).toBe('personal:help.articles.unsynced');
    expect(helpArticleKey('wifiOnly', false)).toBe('personal:help.articles.wifiOnly');
  });

  it('bản cờ bật không nói "chưa ghi video"; hai bản cùng số bước khai báo', () => {
    for (const article of HELP_ARTICLES.filter((a) => a.previewVariant)) {
      const live = help.articles[article.id as keyof typeof help.articles] as {
        title: string;
        summary: string;
        step?: Record<string, string>;
      };
      const preview = help.articlesPreview[article.id as keyof typeof help.articlesPreview] as {
        title: string;
        summary: string;
        keywords: string;
        step?: Record<string, string>;
      };
      expect(`${live.title} ${live.summary}`).not.toMatch(/chưa ghi/);
      expect(preview.keywords).toBeTruthy();
      expect(Object.keys(preview.step ?? {})).toHaveLength(article.stepCount);
    }
    expect(help.articles.recordPack.step['3']).toMatch(/chưa phải bản trên máy chủ/);
  });
});

describe('câu chữ Trợ giúp (bất biến 6, 11)', () => {
  const FORBIDDEN =
    /vui lòng|bảo vệ|an toàn|tuyệt đối|24\/7|pháp lý|đảm bảo|mã hóa|luôn sẵn sàng|chắc chắn|thắng/i;
  const flatten = (value: unknown): string[] =>
    typeof value === 'string'
      ? [value]
      : Object.values(value as Record<string, unknown>).flatMap(flatten);

  it('không có cụm hứa quá mức hay cụm cấm trong nội dung trợ giúp', () => {
    for (const text of flatten(help)) expect(text).not.toMatch(FORBIDDEN);
  });

  it('mỗi bài có tiêu đề, tóm tắt, từ khóa, đủ số bước khai báo; câu thông báo ngắn', () => {
    for (const article of HELP_ARTICLES) {
      const copy = help.articles[article.id as keyof typeof help.articles] as {
        title: string;
        summary: string;
        keywords: string;
        step?: Record<string, string>;
      };
      expect(copy.title).toBeTruthy();
      expect(copy.summary).toBeTruthy();
      expect(copy.keywords).toBeTruthy();
      expect(Object.keys(copy.step ?? {})).toHaveLength(article.stepCount);
    }
    for (const group of Object.values(help.contact.validation)) {
      for (const text of Object.values(group)) {
        expect(text.split(/\s+/).length).toBeLessThan(20);
      }
    }
  });
});
