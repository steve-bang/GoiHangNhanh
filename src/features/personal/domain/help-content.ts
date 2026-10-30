import { foldForSearch } from './shop-list';

/**
 * Cấu trúc nội dung Trợ giúp (UI-I06; board 07 khung 15-16). TypeScript thuần: chỉ có ID và thứ tự; câu chữ
 * nằm ở `personal.json` mục `help` (khóa `help.articles.<id>.{title,summary,step.N,keywords}`), để chữ qua
 * i18n và test cụm cấm quét được. Bài viết viết theo tính năng ĐANG có; thêm bài khi tính năng có thật.
 *
 * Board còn một danh mục "Cập nhật sản phẩm" nhưng chưa có nhật ký thay đổi thật nên KHÔNG khai báo
 * (danh mục không có bài không được hiện, không trang trắng).
 */
export const HELP_CATEGORY_IDS = ['guide', 'troubleshooting', 'faq'] as const;
export type HelpCategoryId = (typeof HELP_CATEGORY_IDS)[number];

export interface HelpArticleDef {
  readonly id: string;
  readonly category: HelpCategoryId;
  /** Số bước đánh số của bài (0: bài hỏi đáp chỉ có đoạn trả lời). Khóa i18n `step.1` … `step.N`. */
  readonly stepCount: number;
  /** Có trong "Bài viết đề xuất" ở Trung tâm trợ giúp. */
  readonly featured: boolean;
}

/** Thứ tự khai báo = thứ tự hiển thị trong danh mục. */
export const HELP_ARTICLES: readonly HelpArticleDef[] = [
  { id: 'createOrder', category: 'guide', stepCount: 3, featured: false },
  { id: 'findOrder', category: 'guide', stepCount: 3, featured: false },
  { id: 'recordPack', category: 'guide', stepCount: 3, featured: true },
  { id: 'scanFail', category: 'troubleshooting', stepCount: 3, featured: false },
  { id: 'cameraOff', category: 'troubleshooting', stepCount: 3, featured: false },
  { id: 'unsynced', category: 'troubleshooting', stepCount: 3, featured: true },
  { id: 'codes', category: 'faq', stepCount: 0, featured: false },
  { id: 'scope', category: 'faq', stepCount: 0, featured: false },
  { id: 'whereData', category: 'faq', stepCount: 0, featured: false },
  { id: 'recordingLimits', category: 'faq', stepCount: 0, featured: false },
];

export function findHelpArticle(id: string | undefined): HelpArticleDef | null {
  return HELP_ARTICLES.find((article) => article.id === id) ?? null;
}

export function isHelpCategoryId(id: string | undefined): id is HelpCategoryId {
  return (HELP_CATEGORY_IDS as readonly string[]).includes(id ?? '');
}

/** Danh mục có ít nhất một bài (danh mục rỗng không được hiện). */
export function nonEmptyHelpCategories(): readonly HelpCategoryId[] {
  return HELP_CATEGORY_IDS.filter((category) =>
    HELP_ARTICLES.some((article) => article.category === category),
  );
}

export function articlesOfCategory(category: HelpCategoryId): readonly HelpArticleDef[] {
  return HELP_ARTICLES.filter((article) => article.category === category);
}

export function featuredArticles(): readonly HelpArticleDef[] {
  return HELP_ARTICLES.filter((article) => article.featured);
}

/**
 * Bài kế tiếp TRONG CÙNG danh mục theo thứ tự khai báo; `null` ở bài cuối (nút "Tiếp theo" chỉ hiện khi có
 * bài kế tiếp thật, không vòng lại bài đầu).
 */
export function nextHelpArticle(id: string): HelpArticleDef | null {
  const current = findHelpArticle(id);
  if (!current) return null;
  const siblings = articlesOfCategory(current.category);
  const index = siblings.findIndex((article) => article.id === id);
  return siblings[index + 1] ?? null;
}

export interface HelpSearchEntry {
  readonly id: string;
  /** Toàn bộ chữ tìm được của bài (tiêu đề, tóm tắt, các bước, từ khóa). */
  readonly text: string;
}

/** Chữ không dấu, chỉ còn chữ-số ngăn cách bằng đúng một dấu cách, bao hai đầu bằng dấu cách (để so khớp đầu từ). */
function wordsOf(text: string): string {
  return ` ${foldForSearch(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

/**
 * Tìm cục bộ, không phân biệt dấu/hoa thường: MỌI từ của câu tìm phải khớp NGUYÊN từ trong chữ của bài; riêng
 * từ cuối được khớp đầu từ (người dùng còn đang gõ dở). "video chua dong bo" khớp bài "Video chưa đồng bộ";
 * "ma don" không khớp "máy ... đồng" vì "ma" không phải nguyên từ. Câu tìm rỗng: trả danh sách rỗng (màn
 * hiện trạng thái không tìm; không nhầm với "không có kết quả"). Giữ thứ tự khai báo của bài.
 */
export function searchHelpArticles(
  entries: readonly HelpSearchEntry[],
  query: string,
): readonly string[] {
  const words = wordsOf(query)
    .split(' ')
    .filter((word) => word !== '');
  if (words.length === 0) return [];
  return entries
    .filter((entry) => {
      const haystack = wordsOf(entry.text);
      return words.every((word, index) =>
        haystack.includes(index === words.length - 1 ? ` ${word}` : ` ${word} `),
      );
    })
    .map((entry) => entry.id);
}
