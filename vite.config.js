import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [cesium()],
  server: {
    port: 5173,
  },
});
