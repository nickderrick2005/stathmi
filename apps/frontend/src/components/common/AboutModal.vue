<script setup lang="ts">
import { ref } from 'vue';
import { NModal, NCard, NButton } from 'naive-ui';
import { extractContentIds, type ContentMetadata } from '@/utils/markdown-renderer';
import { fetchUserNames } from '@/api/users';
import { fetchPostTitles } from '@/api/posts';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import PostContentRenderer from '@/components/post/PostContentRenderer.vue';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  'update:show': [boolean];
}>();

// 关于内容（存储原始 markdown）
const aboutRawContent = ref('');
const aboutMetadata = ref<ContentMetadata | undefined>(undefined);
const aboutLoading = ref(false);
const aboutError = ref(false);

// 法律文档弹窗（存储原始 markdown）
const showLegalModal = ref(false);
const legalModalTitle = ref('');
const legalRawContent = ref('');
const legalMetadata = ref<ContentMetadata | undefined>(undefined);
const legalLoading = ref(false);
const legalError = ref(false);

// 加载内容元数据（用户名、旅程标题）
async function loadContentMetadata(content: string): Promise<ContentMetadata | undefined> {
  const { userIds, threadIds } = extractContentIds(content);
  if (!userIds.length && !threadIds.length) {
    return undefined;
  }

  // 并行请求用户名和旅程标题
  const [usersRes, titlesRes] = await Promise.all([
    userIds.length ? fetchUserNames(userIds) : Promise.resolve({ users: [] }),
    threadIds.length ? fetchPostTitles(threadIds) : Promise.resolve({ titles: [] }),
  ]);

  // 构建元数据映射
  const users = new Map<string, string>();
  for (const user of usersRes.users) {
    users.set(user.id, user.displayName);
  }

  const posts = new Map<string, string>();
  for (const post of titlesRes.titles) {
    posts.set(post.id, post.title);
  }

  return { users, posts };
}

async function loadAboutContent() {
  if (aboutRawContent.value) return;
  aboutLoading.value = true;
  aboutError.value = false;
  try {
    const res = await fetch('/md-file/ABOUT.md');
    const md = await res.text();
    aboutRawContent.value = md;
    // 异步加载元数据
    aboutMetadata.value = await loadContentMetadata(md);
  } catch {
    aboutError.value = true;
  } finally {
    aboutLoading.value = false;
  }
}

async function openLegalDoc(type: 'tos' | 'privacy') {
  legalModalTitle.value = type === 'tos' ? '服务条款' : '隐私说明';
  legalRawContent.value = '';
  legalMetadata.value = undefined;
  legalLoading.value = true;
  legalError.value = false;
  showLegalModal.value = true;

  try {
    const fileName = type === 'tos' ? 'TOS.md' : 'PA.md';
    const res = await fetch(`/md-file/${fileName}`);
    const md = await res.text();
    legalRawContent.value = md;
    // 异步加载元数据
    legalMetadata.value = await loadContentMetadata(md);
  } catch {
    legalError.value = true;
  } finally {
    legalLoading.value = false;
  }
}

function handleOpen() {
  loadAboutContent();
}
</script>

<template>
  <NModal :show="props.show" class="about-modal" @update:show="emit('update:show', $event)" @after-enter="handleOpen">
    <NCard title="关于" :bordered="false" size="small" class="about-card">
      <template #header-extra>
        <NButton text @click="emit('update:show', false)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </NButton>
      </template>

      <div class="about-content">
        <div v-if="aboutLoading" class="content-loading">
          <LoadingSpinner size="md" />
        </div>
        <div v-else-if="aboutError" class="content-error">加载失败，请稍后重试</div>
        <PostContentRenderer v-else-if="aboutRawContent" :content="aboutRawContent" :metadata="aboutMetadata" />

        <!-- 法律文档链接 -->
        <div class="legal-links">
          <button type="button" class="legal-btn" @click="openLegalDoc('tos')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            服务条款
          </button>
          <button type="button" class="legal-btn" @click="openLegalDoc('privacy')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            隐私说明
          </button>
        </div>
      </div>
    </NCard>
  </NModal>

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
        <div v-else-if="legalError" class="content-error">加载失败，请稍后重试</div>
        <PostContentRenderer v-else-if="legalRawContent" :content="legalRawContent" :metadata="legalMetadata" />
      </div>
    </NCard>
  </NModal>
</template>

<style scoped>
.about-card,
.legal-card {
  width: 90vw;
  max-width: 720px;
  max-height: 80vh;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 1px solid color-mix(in srgb, var(--opz-text-primary) 12%, transparent);
}

.about-card :deep(.n-card-header),
.legal-card :deep(.n-card-header) {
  padding: 16px 20px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--opz-text-primary) 8%, transparent);
}

.about-card :deep(.n-card__content),
.legal-card :deep(.n-card__content) {
  padding: 16px 20px;
}

.about-content,
.legal-content {
  min-height: 200px;
  max-height: calc(80vh - 120px);
  overflow-y: auto;
  padding-right: 8px;
  margin-right: -8px;
}

.content-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.content-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--opz-text-tertiary);
}

/* 法律文档链接 */
.legal-links {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--opz-border);
}

.legal-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--opz-border);
  border-radius: 8px;
  background: var(--opz-bg-soft);
  color: var(--opz-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.legal-btn:hover {
  background: var(--opz-bg-mute);
  color: var(--opz-text-primary);
  border-color: var(--opz-primary);
}

.legal-btn svg {
  flex-shrink: 0;
}

/* 滚动条 */
.about-content::-webkit-scrollbar,
.legal-content::-webkit-scrollbar {
  width: 6px;
}

.about-content::-webkit-scrollbar-track,
.legal-content::-webkit-scrollbar-track {
  background: transparent;
}

.about-content::-webkit-scrollbar-thumb,
.legal-content::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--opz-text-primary) 15%, transparent);
  border-radius: 3px;
}

.about-content::-webkit-scrollbar-thumb:hover,
.legal-content::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--opz-text-primary) 30%, transparent);
}

.about-content,
.legal-content {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--opz-text-primary) 15%, transparent) transparent;
}

/* 关闭按钮 */
.about-card :deep(.n-card-header__extra .n-button),
.legal-card :deep(.n-card-header__extra .n-button) {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--opz-text-secondary);
}

.about-card :deep(.n-card-header__extra .n-button:hover),
.legal-card :deep(.n-card-header__extra .n-button:hover) {
  background: color-mix(in srgb, var(--opz-text-primary) 8%, transparent);
  color: var(--opz-text-primary);
}

</style>
