'use strict';
/**
 * Liên kết công khai app <-> web phải khớp từng giá trị (decisions.md Q-29 / V1-18; release-checklist D-4).
 * App: `src/core/config/public-links.ts` (nguồn duy nhất của app). Web: `web/src/config/site.ts`
 * (`publicLinks()`). Hai tệp TS được babel-jest (babel-preset-expo) chuyển khi `require`.
 */
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = require(path.join(root, 'src/core/config/public-links.ts'));
const web = require(path.join(root, 'web/src/config/site.ts'));

describe('liên kết công khai: app khớp web', () => {
  const webLinks = web.publicLinks();

  it('cùng gốc web', () => {
    expect(app.PUBLIC_SITE_URL).toBe(web.site.url);
  });

  it('cùng bộ khóa', () => {
    expect(Object.keys(app.PUBLIC_LINKS).sort()).toEqual(Object.keys(webLinks).sort());
  });

  it.each(['terms', 'privacy', 'support', 'accountDeletionRequest', 'supportEmail'])(
    '%s khớp từng ký tự',
    (key) => {
      expect(app.PUBLIC_LINKS[key]).toBe(webLinks[key]);
    },
  );

  it('còn giữ chỗ thì app coi là giữ chỗ (khóa/ẩn liên kết); email null thì không soạn email', () => {
    const placeholderSite = /\.invalid$/i.test(new URL(web.site.url).hostname);
    for (const key of ['terms', 'privacy', 'support', 'accountDeletionRequest']) {
      expect(app.isPlaceholderLink(app.PUBLIC_LINKS[key])).toBe(placeholderSite);
    }
    if (webLinks.supportEmail === null) expect(app.getSupportEmail()).toBeNull();
  });
});
