import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isPlaceholderLink, LEGAL_LINKS } from '@/core/config/legal-links';
import { openExternalLink, useAppNavigation } from '@/platform';
import { ListGroup, ListItem, Screen, StatusBadge, Text, useTheme } from '@/shared/ui';

import { Notice } from './Notice';

/**
 * Điều khoản và chính sách (UI-I06 route con; board 07 khung 18). Mở trang bằng trình duyệt qua `LEGAL_LINKS`.
 * Hôm nay cả hai URL là GIỮ CHỖ (`.invalid`, `isPlaceholderLink`) nên hàng bị khóa "Sắp có", không điều hướng
 * và có thẻ giải thích; hàng tự mở được khi URL thật được điền. Lệch board: KHÔNG dựng "Chính sách đổi trả"
 * (D20: Đơn Chứng không bán hàng) và KHÔNG có "Chính sách dữ liệu" (chưa có URL thật; Q-21ae). Không ghi
 * phiên bản hay ngày hiệu lực vì chưa có.
 */
export function LegalScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const [openFailed, setOpenFailed] = useState(false);
  // Đọc URL khi render (không ở mức module) để đổi cấu hình/test có hiệu lực.
  const LEGAL_ROWS = [
    { id: 'terms', url: LEGAL_LINKS.terms },
    { id: 'privacy', url: LEGAL_LINKS.privacy },
  ] as const;
  const anyLocked = LEGAL_ROWS.some((row) => isPlaceholderLink(row.url));

  return (
    <Screen
      title={t('nav:subTitles.helpLegal')}
      onBack={navigation.back}
      testID="screen-UI-I06-legal"
      contentGap={tokens.space.lg}
    >
      {anyLocked ? <Notice testID="legal-note">{t('personal:help.legal.note')}</Notice> : null}
      <ListGroup testID="legal-group">
        {LEGAL_ROWS.map((row) => {
          const label = t(`personal:help.legal.${row.id}`);
          if (isPlaceholderLink(row.url)) {
            const soon = t('personal:status.comingSoon');
            return (
              <ListItem
                key={row.id}
                leadingIcon="clipboard"
                title={label}
                titleWeight="regular"
                // Hàng khóa vẫn là nút (vô hiệu) để trình đọc màn hình đọc "không dùng được" kèm gợi ý.
                onPress={() => undefined}
                disabled
                showChevron={false}
                trailing={<StatusBadge label={soon} />}
                accessibilityLabel={`${label}. ${soon}`}
                accessibilityHint={t('personal:help.legal.lockedHint')}
                testID={`legal-${row.id}`}
              />
            );
          }
          return (
            <ListItem
              key={row.id}
              leadingIcon="clipboard"
              title={label}
              titleWeight="regular"
              onPress={() => {
                setOpenFailed(false);
                void openExternalLink(row.url).then((opened) => setOpenFailed(!opened));
              }}
              testID={`legal-${row.id}`}
            />
          );
        })}
      </ListGroup>
      {openFailed ? (
        <Text color="danger" accessibilityRole="alert" testID="legal-open-error">
          {t('personal:help.legal.openFailed')}
        </Text>
      ) : null}
    </Screen>
  );
}
