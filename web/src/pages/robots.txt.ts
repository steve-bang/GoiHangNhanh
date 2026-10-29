import type { APIRoute } from 'astro';
import { site } from '../config/site';

// robots.txt sinh từ cấu hình site để URL và cờ indexable chỉ nằm một nơi.
export const GET: APIRoute = () => {
  const lines = site.indexable
    ? ['User-agent: *', 'Allow: /', '', `Sitemap: ${new URL('/sitemap-index.xml', site.url)}`]
    : [
        '# Site chưa mở cho công cụ tìm kiếm (site.indexable = false).',
        'User-agent: *',
        'Disallow: /',
      ];
  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
