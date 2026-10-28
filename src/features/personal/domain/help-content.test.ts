import {
  HELP_ARTICLES,
  HELP_CATEGORY_IDS,
  articlesOfCategory,
  featuredArticles,
  findHelpArticle,
  isHelpCategoryId,
  nextHelpArticle,
  nonEmptyHelpCategories,
  searchHelpArticles,
} from './help-content';

describe('nội dung Trợ giúp', () => {
  it('ID bài là duy nhất; mọi danh mục khai báo đều có bài (không danh mục trống)', () => {
    const ids = HELP_ARTICLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(nonEmptyHelpCategories()).toEqual([...HELP_CATEGORY_IDS]);
  });

  it('có bài đề xuất; tra bài theo ID, ID lạ trả null', () => {
    expect(featuredArticles().length).toBeGreaterThan(0);
    expect(findHelpArticle('createOrder')?.category).toBe('guide');
    expect(findHelpArticle('khong-co')).toBeNull();
    expect(findHelpArticle(undefined)).toBeNull();
    expect(isHelpCategoryId('faq')).toBe(true);
    expect(isHelpCategoryId('cap-nhat-san-pham')).toBe(false);
  });

  it('bài kế tiếp chỉ trong cùng danh mục; bài cuối không có (không vòng lại)', () => {
    expect(nextHelpArticle('createOrder')?.id).toBe('findOrder');
    for (const category of HELP_CATEGORY_IDS) {
      const list = articlesOfCategory(category);
      const last = list[list.length - 1];
      expect(last).toBeDefined();
      expect(nextHelpArticle(last?.id ?? '')).toBeNull();
    }
    expect(nextHelpArticle('khong-co')).toBeNull();
  });
});

describe('tìm hướng dẫn cục bộ', () => {
  const entries = [
    { id: 'unsynced', text: 'Video chưa đồng bộ. Trạng thái Đã lưu trên máy' },
    { id: 'scanFail', text: 'Không quét được mã. Nhập mã đơn thủ công' },
    { id: 'codes', text: 'Mã đơn và mã vận đơn khác nhau thế nào?' },
  ];

  it('khớp không dấu, không phân biệt hoa thường, mọi từ đều phải có', () => {
    expect(searchHelpArticles(entries, 'video chua dong bo')).toEqual(['unsynced']);
    expect(searchHelpArticles(entries, 'MÃ ĐƠN')).toEqual(['scanFail', 'codes']);
    expect(searchHelpArticles(entries, 'ma van don')).toEqual(['codes']);
    expect(searchHelpArticles(entries, 'video quet')).toEqual([]);
  });

  it('từ cuối khớp đầu từ (đang gõ dở), các từ trước phải khớp nguyên từ', () => {
    expect(searchHelpArticles(entries, 'vid')).toEqual(['unsynced']);
    expect(searchHelpArticles(entries, 'video chua don')).toEqual(['unsynced']);
    expect(searchHelpArticles(entries, 'vid chua dong')).toEqual([]);
    expect(searchHelpArticles(entries, 'ma')).toEqual(['unsynced', 'scanFail', 'codes']);
  });

  it('không có kết quả trả mảng rỗng; câu tìm rỗng/khoảng trắng cũng rỗng', () => {
    expect(searchHelpArticles(entries, 'thanh toan')).toEqual([]);
    expect(searchHelpArticles(entries, '')).toEqual([]);
    expect(searchHelpArticles(entries, '   ')).toEqual([]);
  });
});
