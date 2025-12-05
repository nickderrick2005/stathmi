import './assets/main.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import naive from './plugins/naive';

import App from './App.vue';
import router from './router';

// 小屏设备自动缩放，提供 450px 宽度的阅读体验
const MIN_VIEWPORT_WIDTH = 450;
const screenWidth = window.screen.width;

if (screenWidth < MIN_VIEWPORT_WIDTH) {
  const scale = screenWidth / MIN_VIEWPORT_WIDTH;
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute(
      'content',
      `width=${MIN_VIEWPORT_WIDTH}, initial-scale=${scale}, maximum-scale=${scale}, user-scalable=no`
    );
  }
}

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(naive);

app.mount('#app');
