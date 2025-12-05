<script setup lang="ts">
import { computed } from 'vue';
import { NSkeleton } from 'naive-ui';
import { usePreferencesStore } from '@/stores/preferences';

/**
 * 骨架屏变体：
 * - grid: 大卡片网格（对应 PostCardLarge）
 * - list: 横向列表（对应 PostCardList）
 * - table: 表格行（对应 PostTableMinimal）
 * - text: 文本段落
 * - auto: 根据 displayMode 自动选择
 */
type SkeletonVariant = 'grid' | 'list' | 'table' | 'text' | 'auto';

const props = defineProps<{
  variant?: SkeletonVariant;
  count?: number;
  animate?: boolean;
  /** grid 模式下是否使用 display: contents（适配虚拟滚动） */
  inline?: boolean;
}>();

const preferencesStore = usePreferencesStore();

// 解析变体：auto 根据 displayMode 自动选择
const resolvedVariant = computed(() => {
  const v = props.variant ?? 'auto';
  if (v !== 'auto') return v;

  // 根据 displayMode 映射
  switch (preferencesStore.displayMode) {
    case 'large':
      return 'grid';
    case 'list':
      return 'list';
    case 'minimal':
      return 'table';
    default:
      return 'grid';
  }
});

// 默认数量
const itemCount = computed(() => {
  if (typeof props.count === 'number') return props.count;
  switch (resolvedVariant.value) {
    case 'grid':
      return 6;
    case 'list':
      return 4;
    case 'table':
      return 8;
    case 'text':
      return 3;
    default:
      return 6;
  }
});

// 文本模式的行宽度
const textLineWidths = computed(() => {
  const presets = [100, 86, 72, 64, 58];
  return Array.from({ length: itemCount.value }, (_, index) => `${presets[index % presets.length]}%`);
});
</script>

<template>
  <!-- Grid 模式：大卡片网格 -->
  <div
    v-if="resolvedVariant === 'grid'"
    class="loading-placeholder grid-mode"
    :class="{
      'is-animated': props.animate ?? true,
      'is-inline': props.inline,
    }"
  >
    <div v-for="i in itemCount" :key="`grid-${i}`" class="skeleton-card-grid">
      <NSkeleton height="100%" width="100%" />
    </div>
  </div>

  <!-- List 模式：横向列表 -->
  <div
    v-else-if="resolvedVariant === 'list'"
    class="loading-placeholder list-mode"
    :class="{ 'is-animated': props.animate ?? true }"
  >
    <div v-for="i in itemCount" :key="`list-${i}`" class="skeleton-card-list">
      <div class="list-content">
        <NSkeleton height="18px" width="70%" />
        <NSkeleton height="12px" width="90%" />
        <div class="list-bottom">
          <NSkeleton height="22px" width="22px" circle />
          <NSkeleton height="12px" width="80px" />
        </div>
      </div>
      <div class="list-image">
        <NSkeleton height="100%" width="100%" />
      </div>
    </div>
  </div>

  <!-- Table 模式：表格行 -->
  <div
    v-else-if="resolvedVariant === 'table'"
    class="loading-placeholder table-mode"
    :class="{ 'is-animated': props.animate ?? true }"
  >
    <div v-for="i in itemCount" :key="`table-${i}`" class="skeleton-row">
      <NSkeleton height="14px" :width="`${60 + (i % 3) * 10}%`" />
    </div>
  </div>

  <!-- Text 模式：文本段落 -->
  <div v-else class="loading-placeholder text-mode" :class="{ 'is-animated': props.animate ?? true }">
    <div v-for="(width, index) in textLineWidths" :key="`text-${index}`" class="text-line">
      <NSkeleton :width="width" height="12px" />
    </div>
  </div>
</template>

<style scoped>
.loading-placeholder {
  width: 100%;
}

/* Grid 模式 */
.grid-mode {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.grid-mode.is-inline {
  display: contents;
}

.skeleton-card-grid {
  aspect-ratio: 0.62;
  border-radius: 12px;
  overflow: hidden;
}

/* List 模式 */
.list-mode {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-card-list {
  display: flex;
  gap: 16px;
  padding: 12px 12px 12px 20px;
  min-height: 120px;
  background: var(--opz-bg-card);
  border-radius: 10px;
  border-left: 3px solid var(--opz-border);
}

.list-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
}

.list-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
}

.list-image {
  width: 120px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
}

/* Table 模式 */
.table-mode {
  display: flex;
  flex-direction: column;
}

.skeleton-row {
  padding: 12px 8px;
  border-bottom: 1px solid var(--opz-border-light, rgba(0, 0, 0, 0.06));
}

/* Text 模式 */
.text-mode {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.text-line {
  display: inline-flex;
}

/* 动画 */
.is-animated {
  opacity: 0.72;
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.72;
  }
  50% {
    opacity: 0.45;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .grid-mode {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .skeleton-card-list {
    gap: 10px;
    padding: 10px 10px 10px 14px;
    min-height: 90px;
  }

  .list-image {
    width: 90px;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .grid-mode {
    gap: 16px;
  }
}
</style>
