<script setup lang="ts">
/**
 * 角色徽章组件
 * 只显示图标或 emoji，无底色无边框
 */
import { computed, ref } from 'vue';
import type { Role } from '@opz-hub/shared';

const props = defineProps<{
  /** 角色信息 */
  role: Role;
}>();

// 图标加载失败标记
const iconFailed = ref(false);

// 图标 URL
const iconUrl = computed(() => {
  if (!props.role.iconUrl || iconFailed.value) return null;
  return props.role.iconUrl;
});

// emoji（仅在没有图标时显示）
const emoji = computed(() => {
  if (iconUrl.value) return null;
  return props.role.emoji || null;
});

// 图标加载失败处理
const handleIconError = () => {
  iconFailed.value = true;
};
</script>

<template>
  <span class="role-badge" :title="role.name">
    <img v-if="iconUrl" :src="iconUrl" :alt="role.name" class="role-icon" @error="handleIconError" />
    <span v-else-if="emoji" class="role-emoji">{{ emoji }}</span>
  </span>
</template>

<style scoped>
.role-badge {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.role-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.role-emoji {
  font-size: 16px;
  line-height: 1;
}
</style>
