import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { IconName } from '@/shared/ui';

import {
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

export function helpArticleTitle(t: TFunction, id: string): string {
  return t(`personal:help.articles.${id}.title`);
}

export function helpCategoryTitle(t: TFunction, id: HelpCategoryId): string {
  return t(`personal:help.categoryTitle.${id}`);
}

export function helpArticleSteps(t: TFunction, article: HelpArticleDef): string[] {
  return Array.from({ length: article.stepCount }, (_, index) =>
    t(`personal:help.articles.${article.id}.step.${index + 1}`),
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
          t(`personal:help.articles.${article.id}.summary`),
          ...helpArticleSteps(t, article),
          t(`personal:help.articles.${article.id}.keywords`),
        ].join(' '),
      })),
    [t],
  );
}
