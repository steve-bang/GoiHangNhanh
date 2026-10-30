import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { RECORDER_ENABLED } from '@/core/config/recorder';
import type { IconName } from '@/shared/ui';

import {
  findHelpArticle,
  HELP_ARTICLES,
  type HelpArticleDef,
  type HelpCategoryId,
  type HelpSearchEntry,
} from '../domain/help-content';

/** Biểu tượng của danh mục (Ionicons gần nghĩa với board 07 khung 15). */
export const HELP_CATEGORY_ICONS: Record<HelpCategoryId, IconName> = {
  guide: 'info',
  troubleshooting: 'alert-triangle',
  faq: 'help',
};

/**
 * Gốc khóa i18n của bài: `help.articlesPreview.<id>` khi bài có bản "chưa ghi video" và bộ ghi còn tắt,
 * ngược lại `help.articles.<id>` (decisions.md Q-29 / V1-18).
 */
export function helpArticleKey(id: string, recorderEnabled: boolean = RECORDER_ENABLED): string {
  const usePreview = findHelpArticle(id)?.previewVariant === true && !recorderEnabled;
  return `personal:help.${usePreview ? 'articlesPreview' : 'articles'}.${id}`;
}

export function helpArticleTitle(t: TFunction, id: string): string {
  return t(`${helpArticleKey(id)}.title`);
}

export function helpArticleSummary(t: TFunction, id: string): string {
  return t(`${helpArticleKey(id)}.summary`);
}

export function helpCategoryTitle(t: TFunction, id: HelpCategoryId): string {
  return t(`personal:help.categoryTitle.${id}`);
}

export function helpArticleSteps(t: TFunction, article: HelpArticleDef): string[] {
  return Array.from({ length: article.stepCount }, (_, index) =>
    t(`${helpArticleKey(article.id)}.step.${index + 1}`),
  );
}

/** Chữ tìm được của từng bài: tiêu đề, tóm tắt, các bước, từ khóa (tất cả từ i18n, tĩnh trong app). */
export function useHelpSearchEntries(): readonly HelpSearchEntry[] {
  const { t } = useTranslation();
  return useMemo(
    () =>
      HELP_ARTICLES.map((article) => ({
        id: article.id,
        text: [
          helpArticleTitle(t, article.id),
          helpArticleSummary(t, article.id),
          ...helpArticleSteps(t, article),
          t(`${helpArticleKey(article.id)}.keywords`),
        ].join(' '),
      })),
    [t],
  );
}
