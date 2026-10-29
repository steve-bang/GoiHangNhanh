// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site } from './src/config/site.ts';

export default defineConfig({
  // URL gốc lấy từ một nơi duy nhất: src/config/site.ts
  site: site.url,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      // Trang 404 và mọi trang noindex không vào sitemap.
      filter: (page) => !page.includes('/404'),
    }),
  ],
});
