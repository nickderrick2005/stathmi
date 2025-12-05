<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NModal, NButton, NCard } from 'naive-ui';
import { renderMarkdown, type ContentMetadata } from '@/utils/markdown-renderer';
import { usePreferencesStore } from '@/stores/preferences';
import { useExpandedPost } from '@/composables/useExpandedPost';
import { useDiscordLink } from '@/composables/useDiscordLink';

const props = defineProps<{
  content: string;
  // 增强渲染元数据（可选）
  metadata?: ContentMetadata;
}>();

const router = useRouter();
const preferencesStore = usePreferencesStore();
const { collapse } = useExpandedPost();
const { openDiscordLink } = useDiscordLink();

// 外部链接安全确认
const showExternalLinkModal = ref(false);
const pendingExternalUrl = ref('');

const renderedContent = computed(() => renderMarkdown(props.content, props.metadata));

// 内容字号（基础 14px + 偏移）
const contentFontSize = computed(() => 14 + preferencesStore.cardContentFontOffset);

// 事件委托：处理内容区域点击
function handleContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement;

  // 处理 Discord 频道链接点击 - 根据用户设置决定打开方式
  const discordLink = target.closest('.discord-link[data-discord-url]');
  if (discordLink) {
    e.preventDefault();
    const url = discordLink.getAttribute('data-discord-url');
    if (url) {
      openDiscordLink(url);
    }
    return;
  }

  // 处理外部链接点击
  const externalLink = target.closest('.external-link[data-url]');
  if (externalLink) {
    e.preventDefault();
    pendingExternalUrl.value = externalLink.getAttribute('data-url') || '';
    showExternalLinkModal.value = true;
    return;
  }

  // 处理用户提及点击 - 跳转到用户主页
  const mentionLink = target.closest('.discord-mention-resolved[data-user-id]');
  if (mentionLink) {
    e.preventDefault();
    const userId = mentionLink.getAttribute('data-user-id');
    if (userId) {
      collapse(); // 关闭展开的卡片
      router.push({ name: 'user-profile', params: { id: userId } });
    }
  }
}

// 确认打开外部链接
function confirmOpenExternal() {
  if (pendingExternalUrl.value) {
    window.open(pendingExternalUrl.value, '_blank', 'noopener,noreferrer');
  }
  showExternalLinkModal.value = false;
  pendingExternalUrl.value = '';
}

// 取消打开外部链接
function cancelOpenExternal() {
  showExternalLinkModal.value = false;
  pendingExternalUrl.value = '';
}
</script>

<template>
  <div class="post-content" :style="{ fontSize: `${contentFontSize}px` }" v-html="renderedContent" @click="handleContentClick" />

  <!-- 外部链接安全确认弹窗 -->
  <NModal v-model:show="showExternalLinkModal" :z-index="10001" class="external-link-modal">
    <NCard title="安全提示" :bordered="false" size="small" class="modal-card">
      <div class="external-link-warning">
        <p>您即将访问外部链接：</p>
        <p class="external-url">{{ pendingExternalUrl }}</p>
        <p class="warning-text">外部链接可能存在安全风险，请确认是否继续访问？</p>
      </div>
      <template #footer>
        <div class="modal-actions">
          <NButton @click="cancelOpenExternal">取消</NButton>
          <NButton type="info" @click="confirmOpenExternal">继续访问</NButton>
        </div>
      </template>
    </NCard>
  </NModal>
</template>

<style scoped>
.post-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--opz-text-primary);
  word-break: break-word;
}

.post-content :deep(a) {
  color: var(--opz-primary);
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.post-content :deep(a:hover) {
  opacity: 0.8;
  text-decoration: underline;
}

.post-content :deep(p) {
  margin: 0 0 0.8em;
}

.post-content :deep(p:last-child) {
  margin-bottom: 0;
}

.post-content :deep(.discord-emoji) {
  display: inline-block;
  width: 1.4em;
  height: 1.4em;
  vertical-align: -0.3em;
  object-fit: contain;
}

/* Discord 用户提及 - 蓝框样式 */
.post-content :deep(.discord-mention) {
  display: inline-block;
  padding: 0 6px;
  background: rgba(88, 101, 242, 0.15);
  color: #5865f2;
  border-radius: 4px;
  font-weight: 500;
  cursor: default;
}

/* Discord 用户提及（已解析）- 可点击 */
.post-content :deep(.discord-mention-resolved) {
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s ease;
}

.post-content :deep(.discord-mention-resolved:hover) {
  background: rgba(88, 101, 242, 0.3);
  text-decoration: none;
}

/* Discord 遮罩/剧透 */
.post-content :deep(.discord-spoiler) {
  display: inline;
  padding: 0 4px;
  background: var(--opz-text-primary);
  color: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

/* 未揭示时：隐藏内部所有元素，禁止点击 */
.post-content :deep(.discord-spoiler:not(.revealed) *) {
  color: transparent !important;
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  pointer-events: none;
}

.post-content :deep(.discord-spoiler:hover) {
  background: color-mix(in srgb, var(--opz-text-primary) 80%, transparent);
}

.post-content :deep(.discord-spoiler.revealed) {
  background: var(--opz-bg-elevated);
  color: var(--opz-text-primary);
  user-select: text;
}

/* 揭示后恢复内部元素的点击 */
.post-content :deep(.discord-spoiler.revealed *) {
  pointer-events: auto;
}

/* Discord 小字/副标题 -# */
.post-content :deep(.discord-subtext) {
  display: block;
  font-size: 0.8em;
  color: var(--opz-text-tertiary);
  margin: 0.3em 0;
}

/* Discord 链接 - 蓝框样式 */
.post-content :deep(.discord-link) {
  display: inline-block;
  padding: 0 6px;
  background: rgba(88, 101, 242, 0.15);
  color: #5865f2;
  border-radius: 4px;
  font-weight: 500;
  text-decoration: none;
}

.post-content :deep(.discord-link:hover) {
  background: rgba(88, 101, 242, 0.25);
  text-decoration: none;
}

/* Discord 旅程链接（已解析标题） */
.post-content :deep(.discord-journey-link) {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

/* Discord 文件链接 - 蓝框样式 */
.post-content :deep(.discord-file-link) {
  display: inline-block;
  padding: 0 6px;
  background: rgba(88, 101, 242, 0.15);
  color: #5865f2;
  border-radius: 4px;
  font-weight: 500;
  text-decoration: none;
}

.post-content :deep(.discord-file-link:hover) {
  background: rgba(88, 101, 242, 0.25);
  text-decoration: none;
}

/* Discord 其他服务器链接（灰色） */
.post-content :deep(.discord-other-server-link) {
  display: inline-block;
  padding: 0 6px;
  background: rgba(128, 128, 128, 0.15);
  color: #888;
  border-radius: 4px;
  font-weight: 500;
  text-decoration: none;
}

.post-content :deep(.discord-other-server-link:hover) {
  background: rgba(128, 128, 128, 0.25);
  text-decoration: none;
}

/* 非 Discord 外部链接 */
.post-content :deep(.external-link) {
  display: inline-block;
  padding: 0 6px;
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
  border-radius: 4px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
}

.post-content :deep(.external-link:hover) {
  background: rgba(234, 179, 8, 0.25);
  text-decoration: none;
}

/* 行内代码 */
.post-content :deep(code) {
  background: var(--opz-bg-elevated);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
}

/* 代码块容器 */
.post-content :deep(.code-block-wrapper) {
  margin: 0.8em 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--opz-primary) 20%, var(--opz-border));
  background: color-mix(in srgb, var(--opz-primary) 3%, var(--opz-bg-elevated));
}

/* 代码块头部（仅在有语言标识时显示） */
.post-content :deep(.code-block-header) {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--opz-primary) 8%, var(--opz-bg-base)),
    color-mix(in srgb, var(--opz-primary) 4%, var(--opz-bg-elevated))
  );
  border-bottom: 1px solid color-mix(in srgb, var(--opz-primary) 15%, var(--opz-border));
}

/* 语言标签 */
.post-content :deep(.code-lang-label) {
  font-size: 11px;
  font-weight: 600;
  color: var(--opz-primary);
  font-family: system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.8;
}

/* 代码块主体 */
.post-content :deep(.code-block) {
  margin: 0;
  padding: 12px 16px;
  background: transparent;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}

.post-content :deep(.code-block code) {
  background: none;
  padding: 0;
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
}

/* 兼容旧格式的 pre（无 wrapper 时） */
.post-content :deep(pre:not(.code-block)) {
  background: var(--opz-bg-elevated);
  padding: 12px 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.8em 0;
}

.post-content :deep(pre:not(.code-block) code) {
  background: none;
  padding: 0;
}

.post-content :deep(blockquote) {
  border-left: 3px solid var(--opz-border);
  margin: 0.8em 0;
  padding-left: 12px;
  color: var(--opz-text-secondary);
}

.post-content :deep(ul),
.post-content :deep(ol) {
  margin: 0.8em 0;
  padding-left: 1.5em;
}

.post-content :deep(li) {
  margin: 0.3em 0;
}

.post-content :deep(strong) {
  font-weight: 600;
}

.post-content :deep(em) {
  font-style: italic;
}

.post-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--opz-border);
  margin: 1em 0;
}

/* 外部链接安全确认弹窗 */
.modal-card {
  max-width: 420px;
  border-radius: 12px;
}

.external-link-warning {
  padding: 4px 0;
}

.external-link-warning p {
  margin: 0 0 8px;
}

.external-link-warning .external-url {
  word-break: break-all;
  padding: 8px 12px;
  background: var(--opz-bg-elevated);
  border-radius: 6px;
  font-family: monospace;
  font-size: 13px;
  color: var(--opz-primary);
}

.external-link-warning .warning-text {
  color: var(--opz-text-secondary);
  font-size: 13px;
  margin-top: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
