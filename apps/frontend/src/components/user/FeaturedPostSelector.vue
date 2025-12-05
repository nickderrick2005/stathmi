<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { NModal, NSpin } from 'naive-ui';
import type { Post } from '@opz-hub/shared';
import { fetchUserPosts } from '@/api/users';
import { useUserStore } from '@/stores/user';

const props = defineProps<{
  show: boolean;
  currentPostId?: string;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  select: [postId: string | null];
}>();

const userStore = useUserStore();

// 状态
const posts = ref<Post[]>([]);
const loading = ref(false);
const selectedId = ref<string | null>(null);

// 加载用户帖子
async function loadPosts() {
  const userId = userStore.session?.id;
  if (!userId) return;

  loading.value = true;
  try {
    // 加载所有帖子（最多100个）
    const result = await fetchUserPosts(userId, { limit: 100 });
    posts.value = result.posts;
  } catch (e) {
    console.error('[FeaturedPostSelector] loadPosts error:', e);
    posts.value = [];
  } finally {
    loading.value = false;
  }
}

// 监听弹窗显示
watch(
  () => props.show,
  (show) => {
    if (show) {
      selectedId.value = props.currentPostId ?? null;
      loadPosts();
    }
  }
);

// 选中帖子
function selectPost(postId: string) {
  selectedId.value = postId === selectedId.value ? null : postId;
}

// 确认选择
function confirm() {
  emit('select', selectedId.value);
}

// 清除
function clear() {
  emit('select', null);
}

// 关闭
function close() {
  emit('update:show', false);
}

// 渐变色列表（用于无图回退）
const fallbackColors = [
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #667eea 0%, #5b86e5 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
];

// 根据 postId 生成稳定的回退背景色
function getFallbackColor(postId: string): string {
  const hash = postId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return fallbackColors[hash % fallbackColors.length]!;
}

// 获取帖子封面
function getThumbnail(post: Post): string | null {
  return post.attachments[0]?.url ?? null;
}

// 是否可以确认（有选中且不是当前的）
const canConfirm = computed(() => selectedId.value && selectedId.value !== props.currentPostId);
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="选择代表作"
    class="featured-selector-modal"
    :style="{ maxWidth: '600px' }"
    @update:show="emit('update:show', $event)"
  >
    <template v-if="loading">
      <div class="loading-state">
        <NSpin size="medium" />
      </div>
    </template>
    <template v-else-if="posts.length === 0">
      <div class="empty-state">
        还没有发布任何作品
      </div>
    </template>
    <template v-else>
      <div class="posts-grid">
        <div
          v-for="post in posts"
          :key="post.id"
          class="post-item"
          :class="{ selected: post.id === selectedId }"
          @click="selectPost(post.id)"
        >
          <div class="post-thumbnail-wrap">
            <img v-if="getThumbnail(post)" :src="getThumbnail(post)!" :alt="post.title" class="post-thumbnail" />
            <div v-else class="post-thumbnail-fallback" :style="{ background: getFallbackColor(post.id) }">
              <span class="fallback-text">{{ post.title.slice(0, 1) }}</span>
            </div>
          </div>
          <div class="post-title">{{ post.title }}</div>
          <div v-if="post.id === selectedId" class="selected-mark">✓</div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="modal-footer">
        <button v-if="currentPostId" type="button" class="action-btn danger" @click="clear">
          清除代表作
        </button>
        <span v-else></span>
        <div class="footer-actions">
          <button type="button" class="action-btn secondary" @click="close">取消</button>
          <button type="button" class="action-btn primary" :disabled="!canConfirm" @click="confirm">
            确定
          </button>
        </div>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--opz-text-tertiary);
}

.posts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
  padding: 0.25rem;
}

.post-item {
  position: relative;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.15s ease;
  background: var(--opz-bg-card);
}

.post-item:hover {
  border-color: var(--opz-border-hover);
  transform: translateY(-2px);
}

.post-item.selected {
  border-color: var(--opz-primary);
}

.post-thumbnail-wrap {
  aspect-ratio: 3 / 5;
  overflow: hidden;
}

.post-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: var(--opz-bg-soft);
}

.post-thumbnail-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fallback-text {
  font-size: 2rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.post-title {
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  color: var(--opz-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: var(--opz-bg-card);
}

.selected-mark {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--opz-primary);
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-actions {
  display: flex;
  gap: 0.5rem;
}

/* 按钮样式（与项目风格一致） */
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--opz-border);
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.primary {
  background: var(--opz-primary);
  border-color: var(--opz-primary);
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  opacity: 0.9;
}

.action-btn.secondary {
  background: var(--opz-bg-soft);
  color: var(--opz-text-secondary);
  border-color: var(--opz-border);
}

.action-btn.secondary:hover {
  background: var(--opz-bg-elevated);
  border-color: var(--opz-border-hover);
}

.action-btn.danger {
  background: transparent;
  border-color: var(--opz-danger, #e74c3c);
  color: var(--opz-danger, #e74c3c);
}

.action-btn.danger:hover {
  background: color-mix(in srgb, var(--opz-danger, #e74c3c) 10%, transparent);
}
</style>
