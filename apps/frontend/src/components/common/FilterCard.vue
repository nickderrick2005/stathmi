<script setup lang="ts">
/**
 * 通用筛选卡片包装组件
 * 统一 filter 区域的卡片样式
 */
const props = withDefaults(
  defineProps<{
    /** 卡片标题 */
    title?: string;
    /** 卡片描述 */
    description?: string;
    /** 是否无边框（嵌套使用时） */
    borderless?: boolean;
  }>(),
  {
    borderless: false,
  }
);
</script>

<template>
  <div class="filter-card" :class="{ borderless: props.borderless }">
    <div v-if="props.title || props.description || $slots.header" class="filter-card-header">
      <slot name="header">
        <div class="header-text">
          <header v-if="props.title">{{ props.title }}</header>
          <p v-if="props.description" class="description">{{ props.description }}</p>
        </div>
      </slot>
      <slot name="actions" />
    </div>
    <slot />
  </div>
</template>

<style scoped>
.filter-card {
  background: transparent;
  border: 1px solid var(--opz-border);
  border-radius: 16px;
  padding: 0.75rem 1rem;
}

.filter-card.borderless {
  border: none;
  padding: 0;
}

.filter-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.header-text {
  flex: 1;
  min-width: 0;
}

header {
  font-weight: 600;
  font-size: 0.8125rem;
  margin-bottom: 0.25rem;
  color: var(--opz-text-primary);
}

.description {
  font-size: 0.8rem;
  color: var(--opz-text-muted);
  margin: 0;
}
</style>
