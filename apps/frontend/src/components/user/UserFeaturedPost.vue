<script setup lang="ts">
import { ref } from 'vue';
import type { Post } from '@opz-hub/shared';
import PostCardLarge from '@/components/post/variants/PostCardLarge.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import FeaturedPostSelector from './FeaturedPostSelector.vue';

defineProps<{
  post: Post | null;
  isOwnProfile: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  select: [postId: string | null];
}>();

// 选择器弹窗
const showSelector = ref(false);

function handleSelect(postId: string | null) {
  emit('select', postId);
  showSelector.value = false;
}
</script>

<template>
  <div class="featured-post-section">
    <!-- 标题栏 -->
    <div class="section-header">
      <span class="section-title">代表作</span>
      <button
        v-if="isOwnProfile"
        type="button"
        class="edit-btn"
        @click="showSelector = true"
      >
        {{ post ? '更换' : '设置' }}
      </button>
    </div>

    <!-- 内容区 -->
    <div class="section-content">
      <template v-if="loading">
        <div class="loading-state">加载中...</div>
      </template>
      <template v-else-if="post">
        <div class="card-container">
          <PostCardLarge :post="post" />
        </div>
      </template>
      <template v-else>
        <EmptyState
          :description="isOwnProfile ? '选择一个作品作为你的代表作' : '还没有设置代表作'"
        />
        <button
          v-if="isOwnProfile"
          type="button"
          class="set-btn"
          @click="showSelector = true"
        >
          设置代表作
        </button>
      </template>
    </div>

    <!-- 选择器弹窗 -->
    <FeaturedPostSelector
      v-if="isOwnProfile"
      v-model:show="showSelector"
      :current-post-id="post?.id"
      @select="handleSelect"
    />
  </div>
</template>

<style scoped>
.featured-post-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--opz-bg-card);
  border: 1px solid var(--opz-border);
  border-radius: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.edit-btn {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--opz-text-tertiary);
  background: transparent;
  border: 1px solid var(--opz-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.edit-btn:hover {
  color: var(--opz-primary);
  border-color: var(--opz-primary);
  background: color-mix(in srgb, var(--opz-primary) 8%, transparent);
}

.section-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.loading-state {
  padding: 2rem 0;
  font-size: 0.875rem;
  color: var(--opz-text-tertiary);
}

.card-container {
  width: 100%;
  max-width: 260px;
}

.set-btn {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--opz-primary);
  background: transparent;
  border: 1px solid var(--opz-primary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.set-btn:hover {
  background: color-mix(in srgb, var(--opz-primary) 10%, transparent);
}

/* 移动端样式 */
@media (max-width: 767px) {
  .featured-post-section {
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .section-header {
    margin-bottom: 0.25rem;
  }

  .section-title {
    font-size: 0.8125rem;
  }

  .card-container {
    max-width: 220px;
  }

  .loading-state {
    padding: 1rem 0;
    font-size: 0.8125rem;
  }
}
</style>
