import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { EmptyState, ListGroup, ListItem, Screen, SearchField, Text, useTheme } from '@/shared/ui';

import {
  HELP_ARTICLES,
  articlesOfCategory,
  featuredArticles,
  findHelpArticle,
  nonEmptyHelpCategories,
  searchHelpArticles,
} from '../domain/help-content';
import {
  HELP_CATEGORY_ICONS,
  helpArticleTitle,
  helpCategoryTitle,
  useHelpSearchEntries,
} from './help-text';

/**
 * Trung tâm trợ giúp (UI-I06; board 07 khung 15). Nội dung TĨNH trong app (i18n), viết theo tính năng đang
 * có; không tải từ máy chủ nên không có trạng thái lỗi mạng. Ô tìm lọc cục bộ không phân biệt dấu; không có
 * kết quả thì hiện trạng thái rỗng kèm lối "Liên hệ hỗ trợ" (không trang trắng). Danh mục không có bài không
 * hiện (board có "Cập nhật sản phẩm", chưa có bài thật). Hàng "Liên hệ hỗ trợ" và "Điều khoản và chính sách"
 * là lối vào khung 17 và 18 (board không vẽ lối vào: Q-21ae).
 */
export function HelpScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const entries = useHelpSearchEntries();
  const [query, setQuery] = useState('');

  const searching = query.trim() !== '';
  const resultIds = searching ? searchHelpArticles(entries, query) : [];

  const openArticle = (articleId: string) => navigation.push(ROUTES.helpArticle, { articleId });

  return (
    <Screen
      title={t('nav:titles.UI-I06')}
      onBack={navigation.back}
      testID="screen-UI-I06"
      contentGap={tokens.space.lg}
    >
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t('personal:help.searchPlaceholder')}
        testID="help-search"
      />
      {searching ? (
        resultIds.length === 0 ? (
          <EmptyState
            icon="search"
            title={t('personal:help.noResultsTitle')}
            message={t('personal:help.noResultsMessage')}
            actionLabel={t('personal:help.noResultsAction')}
            onAction={() => navigation.push(ROUTES.helpContact)}
          />
        ) : (
          <>
            <Text
              variant="caption"
              color="textMuted"
              accessibilityLiveRegion="polite"
              testID="help-result-count"
            >
              {t('personal:help.resultCount', { count: resultIds.length })}
            </Text>
            <ListGroup title={t('personal:help.resultsTitle')} testID="help-results">
              {resultIds.map((id) => {
                const article = findHelpArticle(id);
                return (
                  <ListItem
                    key={id}
                    title={helpArticleTitle(t, id)}
                    titleWeight="regular"
                    {...(article ? { subtitle: helpCategoryTitle(t, article.category) } : {})}
                    onPress={() => openArticle(id)}
                    testID={`help-result-${id}`}
                  />
                );
              })}
            </ListGroup>
          </>
        )
      ) : (
        <>
          {HELP_ARTICLES.length > 0 ? (
            <ListGroup title={t('personal:help.categories')} testID="help-categories">
              {nonEmptyHelpCategories().map((category) => {
                const title = helpCategoryTitle(t, category);
                return (
                  <ListItem
                    key={category}
                    leadingIcon={HELP_CATEGORY_ICONS[category]}
                    title={title}
                    titleWeight="regular"
                    accessibilityLabel={t('personal:help.categoryA11y', {
                      title,
                      count: articlesOfCategory(category).length,
                    })}
                    onPress={() => navigation.push(ROUTES.helpCategory, { categoryId: category })}
                    testID={`help-category-${category}`}
                  />
                );
              })}
            </ListGroup>
          ) : null}
          {featuredArticles().length > 0 ? (
            <ListGroup title={t('personal:help.featured')} testID="help-featured">
              {featuredArticles().map((article) => (
                <ListItem
                  key={article.id}
                  leadingIcon="clipboard"
                  title={helpArticleTitle(t, article.id)}
                  titleWeight="regular"
                  showChevron={false}
                  onPress={() => openArticle(article.id)}
                  testID={`help-featured-${article.id}`}
                />
              ))}
            </ListGroup>
          ) : null}
          <ListGroup title={t('personal:help.more')} testID="help-more">
            <ListItem
              leadingIcon="mail"
              title={t('personal:help.contactRow')}
              titleWeight="regular"
              onPress={() => navigation.push(ROUTES.helpContact)}
              testID="help-contact-row"
            />
            <ListItem
              leadingIcon="clipboard"
              title={t('personal:help.legalRow')}
              titleWeight="regular"
              onPress={() => navigation.push(ROUTES.helpLegal)}
              testID="help-legal-row"
            />
          </ListGroup>
        </>
      )}
    </Screen>
  );
}
