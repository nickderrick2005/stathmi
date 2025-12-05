<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import MarkdownIt from 'markdown-it';
import { fetchLatestNotice, type Notice, type NoticeType } from '@/api/notices';
import { useDiscordLink } from '@/composables/useDiscordLink';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';

const POLL_INTERVAL = 5 * 60 * 1000; // 5分钟
const FEEDBACK_URL = 'https://discord.com/channels/1291925535324110879/1337463244062720100';

const { openDiscordLink } = useDiscordLink();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

const notice = ref<Notice | null>(null);
const loading = ref(true);
let timer: ReturnType<typeof setInterval> | null = null;

const noticeClass = computed(() => {
  if (!notice.value) return '';
  const typeMap: Record<NoticeType, string> = {
    error: 'notice-error',
    warning: 'notice-warning',
    hint: 'notice-hint',
    info: 'notice-info',
  };
  return typeMap[notice.value.type] || 'notice-info';
});

const renderedContent = computed(() => {
  if (!notice.value?.content) return '';
  return md.render(notice.value.content);
});

async function loadNotice() {
  try {
    notice.value = await fetchLatestNotice();
  } catch {
    // 静默失败
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadNotice();
  timer = setInterval(loadNotice, POLL_INTERVAL);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>

<template>
  <div v-if="loading || notice" class="notice-wrapper">
    <div class="notice-header">
      <p class="notice-title">工作组提示</p>
      <button type="button" class="feedback-btn" @click="openDiscordLink(FEEDBACK_URL)">反馈</button>
    </div>
    <div v-if="loading" class="notice-loading">
      <LoadingSpinner />
    </div>
    <div v-else-if="notice" class="workgroup-notice" :class="noticeClass">
      <div class="notice-content" v-html="renderedContent" />
    </div>
  </div>
</template>

<style scoped>
.notice-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--opz-border);
}

.notice-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.notice-title {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--opz-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.feedback-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  color: var(--opz-text-secondary);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.feedback-btn:hover {
  background: var(--opz-primary-soft, rgba(74, 144, 226, 0.15));
  border-color: var(--opz-primary);
  color: var(--opz-primary);
}

:root[data-theme='dark'] .feedback-btn {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

:root[data-theme='dark'] .feedback-btn:hover {
  background: var(--opz-primary-soft, rgba(74, 144, 226, 0.2));
}

.workgroup-notice {
  position: relative;
  border-radius: 10px;
  padding: 0.875rem 1rem 0.875rem 1.25rem;
  background: var(--opz-bg-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06);
}

/* 左侧色条（内嵌圆角） */
.workgroup-notice::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 2px;
  opacity: 0.85;
}

.notice-error::before {
  background: var(--opz-danger);
}

.notice-warning::before {
  background: var(--opz-warning);
}

.notice-hint::before {
  background: var(--opz-info);
}

.notice-info::before {
  background: var(--opz-text-muted);
}

:root[data-theme='dark'] .workgroup-notice {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.3);
}

.notice-content {
  font-size: 0.8125rem;
  line-height: 1.65;
  color: var(--opz-text-secondary);
  word-break: break-word;
}

.notice-content :deep(p) {
  margin: 0 0 0.5em;
}

.notice-content :deep(p:last-child) {
  margin-bottom: 0;
}

.notice-content :deep(ol),
.notice-content :deep(ul) {
  margin: 0.35rem 0 0;
  padding-left: 1.25rem;
}

.notice-content :deep(li) {
  margin: 0.2rem 0;
}

.notice-content :deep(li::marker) {
  color: var(--opz-text-muted);
}

.notice-content :deep(a) {
  color: var(--opz-primary);
  text-decoration: none;
  word-break: break-all;
}

.notice-content :deep(a:hover) {
  text-decoration: underline;
}

.notice-content :deep(code) {
  background: var(--opz-bg-muted);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.85em;
  font-family: 'Fira Code', 'Consolas', monospace;
}

.notice-content :deep(strong) {
  color: var(--opz-text-primary);
  font-weight: 600;
}

.notice-content :deep(blockquote) {
  border-left: 2px solid var(--opz-border);
  margin: 0.5em 0;
  padding-left: 0.75rem;
  color: var(--opz-text-muted);
}

.notice-loading {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .workgroup-notice {
    padding: 0.75rem 0.875rem 0.75rem 1rem;
    border-radius: 8px;
  }

  .workgroup-notice::before {
    left: 4px;
    top: 8px;
    bottom: 8px;
    width: 2px;
  }

  .notice-content {
    font-size: 0.8rem;
    line-height: 1.6;
  }

  .notice-content :deep(ol),
  .notice-content :deep(ul) {
    padding-left: 1rem;
  }

  .feedback-btn {
    padding: 3px 8px;
    font-size: 0.65rem;
  }
}
</style>
