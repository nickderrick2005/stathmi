<script setup lang="ts">
/**
 * 屏蔽帖子占位符
 * 显示"已屏蔽"状态和刷新按钮
 */
defineProps<{
  /** 占位符样式：card（卡片宽高比）或 list（固定内边距） */
  variant?: 'card' | 'list';
}>();

const emit = defineEmits<{
  refresh: [];
}>();
</script>

<template>
  <div class="blocked-card-placeholder" :class="variant === 'list' ? 'list-placeholder' : 'card-placeholder'">
    <span class="blocked-text">已屏蔽</span>
    <button type="button" class="refresh-btn" @click.stop="emit('refresh')">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M8 1V4L11 2.5L8 1Z" fill="currentColor" />
      </svg>
      <span>刷新</span>
    </button>
  </div>
</template>

<style scoped>
.blocked-card-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--opz-bg-soft);
  border: 1px dashed var(--opz-border);
  border-radius: 12px;
}

.blocked-card-placeholder.card-placeholder {
  aspect-ratio: 0.62;
}

.blocked-card-placeholder.list-placeholder {
  padding: 24px;
  border-radius: 12px;
}

.blocked-text {
  color: var(--opz-text-tertiary);
  font-size: 13px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--opz-border);
  border-radius: 8px;
  background: var(--opz-bg-base);
  color: var(--opz-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.refresh-btn:hover {
  background: var(--opz-bg-elevated, #f5f5f5);
  color: var(--opz-primary);
  border-color: var(--opz-primary);
}
</style>
