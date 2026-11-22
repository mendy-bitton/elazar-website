import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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

export default defineConfig({
  plugins: [react(), netlifyFunctionsDev()],
  // host: true lets a phone on the same Wi-Fi open the dev server (http://<this computer's IP>:5178)
  server: { host: true, port: 5178, strictPort: true },
  preview: { host: true, port: 5178 },
  // three.js (the tile wall) is its own chunk, loaded only when "מהבמה" is near; it's expected to be large
  build: { chunkSizeWarningLimit: 700 }
});
