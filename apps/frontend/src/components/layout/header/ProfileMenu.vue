<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NPopover } from 'naive-ui';
import { useAuthorFallback } from '@/composables/useAuthorFallback';
import AboutModal from '@/components/common/AboutModal.vue';

const showAboutModal = ref(false);

const props = defineProps<{
  avatarUrl?: string | null;
  username: string | null;
  userId: string | null;
  discordRoles?: string[];
  hasUnread?: boolean;
}>();

const emit = defineEmits<{
  navigate: [string];
  logout: [];
}>();

const showPopover = ref(false);

// 使用作者回退逻辑
const authorInfo = computed(() => ({
  authorAvatar: props.avatarUrl,
  authorName: props.username,
  authorDiscordRoles: props.discordRoles ?? [],
}));

const { avatarSrc, authorDisplayName, authorColor, roleIconUrl, handleAvatarError, resetAvatarState, useRoleIcon } =
  useAuthorFallback(authorInfo);

// 切换用户时重置头像状态
watch(
  () => props.userId,
  () => {
    resetAvatarState();
  }
);

const menuItems = computed(() => {
  const items = [
    { label: '浏览偏好', path: '/follows' },
    { label: '作者偏好', path: '/follows/authors' },
    { label: '界面偏好', path: '/settings' },
  ];
  if (props.userId) {
    items.unshift({ label: '个人主页', path: `/user/${props.userId}` });
  }
  return items;
});

function handleNavigate(path: string) {
  showPopover.value = false;
  emit('navigate', path);
}

function handleLogout() {
  showPopover.value = false;
  emit('logout');
}
</script>

<template>
  <NPopover v-model:show="showPopover" trigger="click" placement="bottom-end" :show-arrow="false" raw>
    <template #trigger>
      <button type="button" class="avatar-btn" title="用户菜单">
        <span v-if="hasUnread" class="avatar-badge" />
        <img
          :src="avatarSrc"
          alt=""
          class="avatar-img"
          :class="{ 'is-role-icon': useRoleIcon }"
          @error="handleAvatarError"
        />
      </button>
    </template>
    <div class="profile-dropdown">
      <div class="profile-header">
        <img v-if="roleIconUrl" :src="roleIconUrl" alt="" class="role-icon" />
        <span class="profile-name" :style="authorColor ? { color: authorColor } : undefined">
          {{ authorDisplayName }}
        </span>
      </div>
      <div class="menu-divider" />
      <div class="menu-list">
        <button
          v-for="item in menuItems"
          :key="item.path"
          type="button"
          class="menu-item"
          @click="handleNavigate(item.path)"
        >
          {{ item.label }}
        </button>
      </div>
      <div class="menu-divider" />
      <button
        type="button"
        class="menu-item about-item"
        @click="
          showPopover = false;
          showAboutModal = true;
        "
      >
        关于
      </button>
      <button type="button" class="menu-item logout-item" @click="handleLogout">登出</button>
    </div>
  </NPopover>

  <!-- 关于弹窗 -->
  <AboutModal v-model:show="showAboutModal" />
</template>

<style scoped>
.avatar-btn {
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

.avatar-btn:hover {
  background: var(--opz-bg-mute);
  transform: scale(1.05);
}

.avatar-btn:active {
  transform: scale(0.95);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-img.is-role-icon {
  /* 角色图标不需要 filter，保持原色 */
  border-radius: 0;
  padding: 2px;
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

/* 下拉菜单 */
.profile-dropdown {
  background: var(--opz-bg-base);
  border: 1px solid var(--opz-border);
  border-radius: 10px;
  padding: 6px;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
}

.role-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.profile-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--opz-text-primary);
}

.menu-divider {
  height: 1px;
  background: var(--opz-border);
  margin: 4px 0;
}

.menu-list {
  display: flex;
  flex-direction: column;
}

.menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 14px;
  color: var(--opz-text-primary);
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
}

.menu-item:hover {
  background: var(--opz-bg-soft);
}

.about-item {
  color: var(--opz-text-secondary);
}

.about-item:hover {
  color: var(--opz-text-primary);
}

.logout-item {
  color: var(--opz-danger);
}

.logout-item:hover {
  background: var(--opz-danger-bg);
}
</style>
