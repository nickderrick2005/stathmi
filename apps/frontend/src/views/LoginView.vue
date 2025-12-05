<script setup lang="ts">
import { ref } from 'vue';
import { NModal, NCard, NButton } from 'naive-ui';
import { getDiscordOAuthUrl } from '@/api/auth';
import { renderMarkdown } from '@/utils/markdown-renderer';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';

function startDiscordOAuth() {
  window.location.href = getDiscordOAuthUrl();
}

// 法律文档弹窗
const showLegalModal = ref(false);
const legalModalTitle = ref('');
const legalContent = ref('');
const legalLoading = ref(false);

async function openLegalDoc(type: 'tos' | 'privacy') {
  legalModalTitle.value = type === 'tos' ? '服务条款' : '隐私说明';
  legalContent.value = '';
  legalLoading.value = true;
  showLegalModal.value = true;

  try {
    const fileName = type === 'tos' ? 'TOS.md' : 'PA.md';
    const res = await fetch(`/md-file/${fileName}`);
    const md = await res.text();
    legalContent.value = renderMarkdown(md);
  } catch {
    legalContent.value = '<p>加载失败，请稍后重试</p>';
  } finally {
    legalLoading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-container">
      <!-- 品牌区域 -->
      <div class="brand-section">
        <img src="/default-img/title.png" alt="星图ΣΤΑΘΜΗ" class="brand-logo" />
      </div>

      <!-- 登录卡片 -->
      <div class="login-card">
        <div class="card-header">
          <h2 class="card-title">欢迎回来</h2>
          <p class="card-desc">请使用您在旅程服务器的 Discord 账号登录</p>
        </div>

        <div class="card-body">
          <button type="button" class="discord-btn" @click="startDiscordOAuth">
            <svg class="discord-icon" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
              />
            </svg>
            <span>使用 Discord 登录</span>
          </button>
        </div>

        <div class="card-footer">
          <p class="footer-text">
            登录即表示你已阅读并同意本网站的
            <a class="legal-link" @click="openLegalDoc('tos')">「服务条款」</a>和<a
              class="legal-link"
              @click="openLegalDoc('privacy')"
              >「隐私说明」</a
            >，并确认你已年满 18 周岁
          </p>
        </div>
      </div>
    </div>

    <!-- 法律文档弹窗 -->
    <NModal v-model:show="showLegalModal" class="legal-modal">
      <NCard :title="legalModalTitle" :bordered="false" size="small" class="legal-card">
        <template #header-extra>
          <NButton text @click="showLegalModal = false">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </NButton>
        </template>
        <div class="legal-content">
          <div v-if="legalLoading" class="content-loading">
            <LoadingSpinner size="md" />
          </div>
          <div v-else class="markdown-body" v-html="legalContent" />
        </div>
      </NCard>
    </NModal>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(235, 69, 158, 0.06) 0%, transparent 50%), var(--opz-bg-base);
  background-size: 200% 200%;
  animation: gradient-drift 20s ease-in-out infinite;
}

@keyframes gradient-drift {
  0%,
  100% {
    background-position: 0% 0%;
  }
  50% {
    background-position: 100% 100%;
  }
}

.login-container {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* 品牌区域 */
.brand-section {
  text-align: center;
}

.brand-logo {
  height: 8rem;
  width: auto;
  filter: var(--opz-icon-filter);
}

.brand-tagline {
  margin: 0.5rem 0 0;
  font-size: 1rem;
  color: var(--opz-text-tertiary);
}

/* 登录卡片 */
.login-card {
  background: var(--opz-bg-card);
  border: 1px solid var(--opz-border);
  border-radius: 16px;
  overflow: hidden;
}

.card-header {
  padding: 1.5rem 1.5rem 0;
  text-align: center;
}

.card-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.card-desc {
  margin: 0.375rem 0 0;
  font-size: 0.875rem;
  color: var(--opz-text-tertiary);
}

.card-body {
  padding: 1.5rem;
}

.discord-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 0.875rem 1.5rem;
  border: none;
  border-radius: 10px;
  background: #5865f2;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.discord-btn:hover {
  background: #4752c4;
}

.discord-icon {
  width: 1.375rem;
  height: 1.375rem;
}

.card-footer {
  padding: 0 1.5rem 1.25rem;
  text-align: center;
}

.footer-text {
  margin: 0;
  font-size: 0.75rem;
  color: var(--opz-text-tertiary);
  line-height: 1.6;
}

.legal-link {
  color: var(--opz-primary);
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.legal-link:hover {
  opacity: 0.8;
}

/* 功能说明 */
.features {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.feature-icon {
  font-size: 1rem;
}

.feature-text {
  font-size: 0.8125rem;
  color: var(--opz-text-secondary);
}

/* 移动端适配 */
@media (max-width: 480px) {
  .brand-logo {
    height: 4.5rem;
  }

  .features {
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }
}

/* 法律文档弹窗 */
.legal-card {
  width: 90vw;
  max-width: 720px;
  max-height: 80vh;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 1px solid color-mix(in srgb, var(--opz-text-primary) 12%, transparent);
}

.legal-card :deep(.n-card-header) {
  padding: 16px 20px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--opz-text-primary) 8%, transparent);
}

.legal-card :deep(.n-card__content) {
  padding: 16px 20px;
}

.legal-content {
  min-height: 300px;
  max-height: calc(80vh - 120px);
  overflow-y: auto;
  padding-right: 8px;
  margin-right: -8px;
}

.content-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

/* 滚动条 */
.legal-content::-webkit-scrollbar {
  width: 6px;
}

.legal-content::-webkit-scrollbar-track {
  background: transparent;
}

.legal-content::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--opz-text-primary) 15%, transparent);
  border-radius: 3px;
}

.legal-content::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--opz-text-primary) 30%, transparent);
}

.legal-content {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--opz-text-primary) 15%, transparent) transparent;
}

/* 关闭按钮 */
.legal-card :deep(.n-card-header__extra .n-button) {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--opz-text-secondary);
}

.legal-card :deep(.n-card-header__extra .n-button:hover) {
  background: color-mix(in srgb, var(--opz-text-primary) 8%, transparent);
  color: var(--opz-text-primary);
}

/* Markdown 渲染样式 */
.markdown-body {
  font-size: 14px;
  line-height: 1.7;
  color: var(--opz-text-primary);
}

.markdown-body :deep(h2) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1.5em 0 0.75em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--opz-border);
}

.markdown-body :deep(h3) {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1.25em 0 0.5em;
}

.markdown-body :deep(p) {
  margin: 0.75em 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.markdown-body :deep(li) {
  margin: 0.25em 0;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--opz-border);
  margin: 1.5em 0;
}

.markdown-body :deep(a) {
  color: var(--opz-primary);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(strong) {
  font-weight: 600;
}
</style>
