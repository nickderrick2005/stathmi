<script setup lang="ts">
import { NEmpty } from 'naive-ui';

withDefaults(
  defineProps<{
    title?: string;
    description?: string;
  }>(),
  {
    title: '暂无数据',
    description: '',
  }
);
</script>

<template>
  <div class="empty-state-wrapper">
    <NEmpty :description="title">
      <template v-if="description" #extra>
        <div style="color: var(--n-text-color-3)">{{ description }}</div>
      </template>
    </NEmpty>
  </div>
</template>

<style scoped>
.empty-state-wrapper {
  padding: 60px 20px;
  text-align: center;
}
</style>
