<script setup lang="ts">
import PersistentFilters from '@/components/filters/PersistentFilters.vue';
import TargetIcon from '@/assets/icons/target.svg?raw';
import CloseIcon from '@/assets/icons/close.svg?raw';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  'update:show': [boolean];
}>();
</script>

<template>
  <n-drawer
    :show="props.show"
    placement="right"
    :width="320"
    :auto-focus="false"
    @update:show="emit('update:show', $event)"
  >
    <n-drawer-content :body-content-style="{ padding: 0 }">
      <!-- 头部 -->
      <div class="drawer-header">
        <div class="header-icon" v-html="TargetIcon"></div>
        <h3 class="header-title">页面筛选</h3>
        <button class="close-btn" @click="emit('update:show', false)">
          <span v-html="CloseIcon"></span>
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="drawer-body">
        <!-- PersistentFilters 内部直接操作 store -->
        <PersistentFilters />
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--opz-border);
  background: var(--opz-bg-soft);
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--opz-radius-md);
  background: var(--opz-primary);
  color: white;
}

.header-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.header-title {
  flex: 1;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--opz-text-tertiary);
  border-radius: var(--opz-radius-md);
  cursor: pointer;
  transition: all var(--opz-transition-fast);
}

.close-btn:hover {
  background: var(--opz-bg-mute);
  color: var(--opz-text-primary);
}

.close-btn :deep(svg) {
  width: 20px;
  height: 20px;
}

.drawer-body {
  padding: 1rem 1.25rem;
}
</style>
