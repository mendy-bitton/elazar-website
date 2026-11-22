import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // host: true lets a phone on the same Wi-Fi open the dev server (http://<this computer's IP>:5178)
  server: { host: true, port: 5178, strictPort: true },
  preview: { host: true, port: 5178 },
  // three.js (the tile wall) is its own chunk, loaded only when "מהבמה" is near; it's expected to be large
  build: { chunkSizeWarningLimit: 700 }
});
