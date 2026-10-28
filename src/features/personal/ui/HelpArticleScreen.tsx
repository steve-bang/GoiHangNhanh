import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useRouteParams } from '@/platform';
import { Button, EmptyState, Screen, Text, useTheme } from '@/shared/ui';

import { findHelpArticle, nextHelpArticle } from '../domain/help-content';
import { helpArticleSteps, helpArticleTitle, helpCategoryTitle } from './help-text';

/**
 * Chi tiết bài hướng dẫn (UI-I06 route con; board 07 khung 16): tiêu đề, đoạn mô tả, "Các bước thực hiện"
 * đánh số. Nút "Tiếp theo" CHỈ hiện khi có bài kế tiếp thật trong cùng danh mục. KHÔNG có ảnh/video minh họa
 * và nút phát (D26: chưa có tài nguyên hay bản quyền, không dựng khối giả) và KHÔNG có "Bài viết này có hữu
 * ích không?" (chưa có nơi nhận phản hồi). Bài lạ: trạng thái rỗng có đường về Trung tâm trợ giúp.
 */
export function HelpArticleScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { articleId } = useRouteParams();
  const article = findHelpArticle(articleId);

  if (!article) {
    return (
      <Screen
        title={t('nav:subTitles.helpArticle')}
        onBack={navigation.back}
        testID="screen-UI-I06-articleId"
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

  const steps = helpArticleSteps(t, article);
  const next = nextHelpArticle(article.id);
  const nextTitle = next ? helpArticleTitle(t, next.id) : null;
  return (
    <Screen
      title={helpCategoryTitle(t, article.category)}
      onBack={navigation.back}
      testID="screen-UI-I06-articleId"
      contentGap={tokens.space.lg}
      footer={
        next && nextTitle ? (
          <Button
            label={t('personal:help.next')}
            accessibilityHint={t('personal:help.nextHint', { title: nextTitle })}
            onPress={() => navigation.replace(ROUTES.helpArticle, { articleId: next.id })}
            testID="help-article-next"
          />
        ) : undefined
      }
    >
      <View style={{ gap: tokens.space.sm }}>
        <Text variant="sectionTitle" accessibilityRole="header" testID="help-article-title">
          {helpArticleTitle(t, article.id)}
        </Text>
        <Text color="textMuted" testID="help-article-summary">
          {t(`personal:help.articles.${article.id}.summary`)}
        </Text>
      </View>
      {steps.length > 0 ? (
        <View style={{ gap: tokens.space.sm }} testID="help-article-steps">
          <Text variant="sectionTitle" accessibilityRole="header">
            {t('personal:help.stepsTitle')}
          </Text>
          {steps.map((text, index) => (
            <View
              key={index}
              accessible
              accessibilityLabel={t('personal:help.stepA11y', { index: index + 1, text })}
              style={{ flexDirection: 'row', gap: tokens.space.sm }}
              testID={`help-article-step-${index + 1}`}
            >
              <Text bold importantForAccessibility="no">{`${index + 1}.`}</Text>
              <Text style={{ flex: 1, flexShrink: 1 }} importantForAccessibility="no">
                {text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
