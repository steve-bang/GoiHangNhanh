import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useRouteParams } from '@/platform';
import { EmptyState, ListGroup, ListItem, Screen } from '@/shared/ui';

import { articlesOfCategory, isHelpCategoryId } from '../domain/help-content';
import { HELP_CATEGORY_ICONS, helpArticleTitle, helpCategoryTitle } from './help-text';

/**
 * Danh sách bài của một danh mục (lối từ khung 15; board không vẽ màn này nên dựng gọn: danh sách hàng).
 * ID danh mục lạ (liên kết sâu cũ) hoặc danh mục không có bài: trạng thái rỗng có đường về Trung tâm trợ giúp.
 */
export function HelpCategoryScreen() {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const { categoryId } = useRouteParams();
  const category = isHelpCategoryId(categoryId) ? categoryId : null;
  const articles = category ? articlesOfCategory(category) : [];

  if (!category || articles.length === 0) {
    return (
      <Screen
        title={t('nav:subTitles.helpCategory')}
        onBack={navigation.back}
        testID="screen-UI-I06-categoryId"
      >
        <EmptyState
          icon="search"
          title={t('personal:help.notFoundTitle')}
          message={t('personal:help.notFoundMessage')}
          actionLabel={t('personal:help.notFoundAction')}
          onAction={() => navigation.replace(ROUTES.help)}
        />
      </Screen>
    );
  }
  return (
    <Screen
      title={helpCategoryTitle(t, category)}
      onBack={navigation.back}
      testID="screen-UI-I06-categoryId"
    >
      <ListGroup testID="help-category-articles">
        {articles.map((article) => (
          <ListItem
            key={article.id}
            leadingIcon={HELP_CATEGORY_ICONS[category]}
            title={helpArticleTitle(t, article.id)}
            titleWeight="regular"
            onPress={() => navigation.push(ROUTES.helpArticle, { articleId: article.id })}
            testID={`help-article-row-${article.id}`}
          />
        ))}
      </ListGroup>
    </Screen>
  );
}
