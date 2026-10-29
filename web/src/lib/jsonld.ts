import { site } from '../config/site';

/** Kiểu JSON-LD tối thiểu; mỗi helper trả về MỘT đối tượng, layout gom lại. */
export type JsonLd = Record<string, unknown>;

export const absoluteUrl = (path: string): string => new URL(path, site.url).toString();

/** Organization: chỉ trường có thật. Không có sameAs, địa chỉ, điện thoại khi chưa có. */
export function organizationLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: absoluteUrl('/'),
    logo: absoluteUrl(site.logo),
    description: site.tagline,
  };
}

export function websiteLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: absoluteUrl('/'),
    inLanguage: site.lang,
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbLd(crumbs: Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

export interface Faq {
  question: string;
  answer: string;
}

/** Chỉ dùng khi chính các câu hỏi/đáp này hiển thị nguyên văn trên trang. */
export function faqLd(items: Faq[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export interface ArticleInput {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
}

/** Dùng cho bài hướng dẫn sau này. Không có tác giả/ảnh giả. */
export function articleLd(a: ArticleInput): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.headline,
    description: a.description,
    mainEntityOfPage: absoluteUrl(a.path),
    datePublished: a.datePublished,
    dateModified: a.dateModified ?? a.datePublished,
    inLanguage: site.lang,
    publisher: { '@type': 'Organization', name: site.name, url: absoluteUrl('/') },
  };
}

/**
 * SoftwareApplication: CHƯA dùng ở trang nào vì ứng dụng chưa phát hành.
 * Khi có liên kết cửa hàng thật mới gọi. Không thêm offers/aggregateRating nếu không có thật.
 */
export function softwareApplicationLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: site.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'iOS, Android',
    description: site.tagline,
    url: absoluteUrl('/'),
  };
}

/** Chuỗi an toàn để nhúng trong <script type="application/ld+json">. */
export function serializeLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
