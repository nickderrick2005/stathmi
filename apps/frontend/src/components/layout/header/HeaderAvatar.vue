<script setup lang="ts">
import { ref, computed } from 'vue';
import defaultAvatar from '@/assets/icons/avatar-default.svg';

const props = defineProps<{
  avatarUrl?: string | null;
  hasUnread?: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();

const avatarFailed = ref(false);

// 是否使用默认头像（SVG 图标需要在暗色模式下 invert）
const useDefaultAvatar = computed(() => avatarFailed.value || !props.avatarUrl);

const avatarSrc = computed(() => useDefaultAvatar.value ? defaultAvatar : props.avatarUrl!);

function handleAvatarError() {
  avatarFailed.value = true;
}
</script>

<template>
  <button class="avatar-button" type="button" @click="emit('click')">
    <span v-if="hasUnread" class="avatar-badge" />
    <img
      :src="avatarSrc"
      alt=""
      class="avatar-img"
      :class="{ 'is-default': useDefaultAvatar }"
      @error="handleAvatarError"
    />
  </button>
</template>

<style scoped>
.avatar-button {
  position: relative;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid var(--opz-border);
  background: var(--opz-bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  overflow: hidden;
  padding: 0;
}

.avatar-button:hover {
  background: var(--opz-bg-mute);
  transform: scale(1.05);
}

.avatar-button:active {
  transform: scale(0.95);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-img.is-default {
  filter: var(--opz-icon-filter);
}

.avatar-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 0.5rem;
  height: 0.5rem;
  background: var(--opz-danger);
  border-radius: 50%;
  border: 2px solid var(--opz-bg-base);
  z-index: 1;
}
</style>

