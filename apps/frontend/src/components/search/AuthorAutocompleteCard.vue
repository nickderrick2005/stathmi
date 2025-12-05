<script setup lang="ts">
import { computed } from 'vue';
import type { AuthorAutocompleteItem } from '@opz-hub/shared';
import { useAuthorFallback } from '@/composables/useAuthorFallback';

const props = defineProps<{
  author: AuthorAutocompleteItem;
}>();

const emit = defineEmits<{
  click: [];
  searchPosts: [];
}>();

const authorInfo = computed(() => ({
  authorAvatar: props.author.avatar,
  authorName: props.author.displayName,
  authorDiscordRoles: props.author.discordRoles,
}));

const { avatarSrc, authorColor, handleAvatarError } = useAuthorFallback(authorInfo);

// 确保名字颜色在浅色背景下可见
const safeAuthorColor = computed(() => {
  if (!authorColor.value) return null;
  // 过滤掉太浅的颜色（如白色、浅灰）
  const hex = authorColor.value.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // 计算亮度，太亮则不使用
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness > 200) return null;
  return authorColor.value;
});

function handleGoToProfile() {
  emit('click');
}

function handleSearchPosts(e: Event) {
  e.stopPropagation();
  emit('searchPosts');
}
</script>

<template>
  <div class="author-card">
    <img :src="avatarSrc" alt="" class="author-avatar" @error="handleAvatarError" />
    <div class="author-info">
      <div class="author-name" :style="safeAuthorColor ? { color: safeAuthorColor } : undefined">
        {{ author.displayName }}
      </div>
      <div class="author-meta">{{ author.threadCount }} 作品</div>
    </div>
    <div class="author-actions">
      <button type="button" class="action-btn profile-btn" title="查看主页" @click="handleGoToProfile">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>主页</span>
      </button>
      <button type="button" class="action-btn search-btn" title="搜索作品" @click="handleSearchPosts">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" stroke-linecap="round" />
        </svg>
        <span>作品</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.author-card {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  background: var(--opz-bg-base);
  border: 1px solid var(--opz-border);
  border-radius: 8px;
}

.author-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.author-info {
  flex: 1;
  min-width: 0;
}

.author-name {
  font-weight: 600;
  font-size: 0.8125rem;
  color: var(--opz-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.author-meta {
  font-size: 0.6875rem;
  color: var(--opz-text-tertiary);
  line-height: 1.3;
}

.author-actions {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--opz-border);
  border-radius: 6px;
  background: var(--opz-bg-soft);
  color: var(--opz-text-secondary);
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  border-color: var(--opz-primary);
  color: var(--opz-primary);
}

.action-btn svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.profile-btn:hover {
  background: var(--opz-primary-soft, rgba(74, 144, 226, 0.1));
}

.search-btn:hover {
  background: var(--opz-primary-soft, rgba(74, 144, 226, 0.1));
}

/* 移动端：隐藏文字，只显示图标 */
@media (max-width: 640px) {
  .action-btn span {
    display: none;
  }

  .action-btn {
    padding: 0.375rem;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }
}
</style>
