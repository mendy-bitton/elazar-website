import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES, headHtml, adminHeadHtml, bodyHtml, sitemapXml, robotsTxt } from './src/lib/seo.js';

// on this computer, serve the Netlify function at the same address it has on Netlify,
// so the admin panel's scan works in `npm run dev` too
const netlifyFunctionsDev = () => ({
  name: 'netlify-functions-dev',
  configureServer(server) {
    server.middlewares.use('/.netlify/functions/youtube-feed', async (req, res) => {
      try {
        const { default: handler } = await server.ssrLoadModule('/netlify/functions/youtube-feed.mjs');
        const out = await handler(new Request('http://localhost' + req.originalUrl));
        res.statusCode = out.status;
        out.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await out.arrayBuffer()));
      } catch (e) {
        res.statusCode = 500;
        res.end(String(e));
      }
    });
  }
});

// SEO: every page gets its own HTML file with its own title, description, canonical link,
// link-preview card and structured data (src/lib/seo.js), so Google and WhatsApp/Facebook
// read the right ones without running the site. Plus sitemap.xml and robots.txt.
// Google Analytics goes in only on a real build, so working locally never counts as visits.
const SEO_BLOCK = /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/;
const BODY_BLOCK = /<!-- body:start -->[\s\S]*?<!-- body:end -->/;
const seoPages = () => {
  let build = false;
  const block = path => `<!-- seo:start -->\n${headHtml(path, { analytics: build })}\n<!-- seo:end -->`;
  const body = path => `<!-- body:start -->${path ? bodyHtml(path) : ''}<!-- body:end -->`;
  const page = (html, path) => html.replace(SEO_BLOCK, () => block(path)).replace(BODY_BLOCK, () => body(path));
  return {
    name: 'seo-pages',
    configResolved(config) { build = config.command === 'build'; },
    transformIndexHtml(html) { return page(html, '/'); },
    writeBundle(options) {
      const dir = options.dir;
      const html = readFileSync(join(dir, 'index.html'), 'utf8');
      for (const p of PAGES) if (p.file !== 'index.html') writeFileSync(join(dir, p.file), page(html, p.path));
      writeFileSync(join(dir, 'admin.html'), html.replace(SEO_BLOCK, () => `<!-- seo:start -->\n${adminHeadHtml()}\n<!-- seo:end -->`).replace(BODY_BLOCK, () => body('')));
      writeFileSync(join(dir, 'sitemap.xml'), sitemapXml());
      writeFileSync(join(dir, 'robots.txt'), robotsTxt());
      // Netlify: /weddings is served from weddings.html, /admin from admin.html (before netlify.toml's catch-all)
      const rules = [...PAGES.filter(p => p.file !== 'index.html').map(p => `${p.path} /${p.file} 200`), '/admin /admin.html 200', '/admin/* /admin.html 200'];
      writeFileSync(join(dir, '_redirects'), rules.join('\n') + '\n');
    }
  };
};

export default defineConfig({
  plugins: [react(), netlifyFunctionsDev(), seoPages()],
  // host: true lets a phone on the same Wi-Fi open the dev server (http://<this computer's IP>:5178)
  server: { host: true, port: 5178, strictPort: true },
  preview: { host: true, port: 5178 },
  // three.js (the tile wall) is its own chunk, loaded only when "מהבמה" is near; it's expected to be large
  build: { chunkSizeWarningLimit: 700 }
});
