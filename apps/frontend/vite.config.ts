import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [vue(), mode === 'development' && vueDevTools()].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue-router') || id.includes('pinia') || id.includes('@vueuse') || id.includes('/vue/')) {
              return 'vendor-vue';
            }
            if (id.includes('naive-ui')) {
              // 按 naive-ui 内部模块拆分
              if (id.includes('date-picker') || id.includes('time-picker') || id.includes('calendar')) {
                return 'naive-date';
              }
              if (id.includes('upload') || id.includes('image')) {
                return 'naive-media';
              }
              return 'naive-core';
            }
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['opizontas.org'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
