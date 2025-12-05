<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAuthorFallback } from '@/composables/useAuthorFallback';
import CloseIcon from '@/assets/icons/close.svg?raw';
import UserIcon from '@/assets/icons/user.svg?raw';
import HeartIcon from '@/assets/icons/heart.svg?raw';
import UsersIcon from '@/assets/icons/users.svg?raw';
import SettingsIcon from '@/assets/icons/settings.svg?raw';
import LogoutIcon from '@/assets/icons/logout.svg?raw';
import ChevronRightIcon from '@/assets/icons/chevron-right.svg?raw';
import AboutModal from '@/components/common/AboutModal.vue';

// 关于弹窗
const showAboutModal = ref(false);

// 内联 info 图标
const InfoIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/></svg>`;

const props = defineProps<{
  show: boolean;
  username: string | null;
  userId: string | null;
  avatarUrl: string | null;
  discordRoles: string[];
  hasUnread: boolean;
}>();

const emit = defineEmits<{
  'update:show': [boolean];
  navigate: [string];
  logout: [];
}>();

// 使用作者回退逻辑
const authorInfo = computed(() => ({
  authorAvatar: props.avatarUrl,
  authorName: props.username,
  authorDiscordRoles: props.discordRoles,
}));

const { avatarSrc, authorDisplayName, authorColor, roleIconUrl, handleAvatarError, resetAvatarState } =
  useAuthorFallback(authorInfo);

// 切换用户时重置头像状态
watch(
  () => props.userId,
  () => {
    resetAvatarState();
  }
);

// 头部渐变背景色（基于角色颜色）
const headerGradient = computed(() => {
  const color = authorColor.value || '#3b82f6';
  return `linear-gradient(135deg, ${color}20 0%, ${color}08 100%)`;
});

// 头像边框色
const avatarBorderColor = computed(() => authorColor.value || 'var(--opz-border)');

const iconMap: Record<string, string> = {
  user: UserIcon,
  heart: HeartIcon,
  users: UsersIcon,
  settings: SettingsIcon,
  info: InfoIcon,
};

const menuItems = computed(() => {
  const items: { label: string; path: string; icon: string }[] = [
    { label: '浏览偏好', path: '/follows', icon: 'heart' },
    { label: '作者偏好', path: '/follows/authors', icon: 'users' },
    { label: '界面偏好', path: '/settings', icon: 'settings' },
  ];
  if (props.userId) {
    items.unshift({ label: '个人主页', path: `/user/${props.userId}`, icon: 'user' });
  }
  return items;
});

function goTo(path: string) {
  emit('navigate', path);
}

function handleLogout() {
  emit('logout');
}
</script>

<template>
  <n-drawer
    :show="props.show"
    placement="left"
    :width="300"
    :auto-focus="false"
    @update:show="emit('update:show', $event)"
  >
    <n-drawer-content :body-content-style="{ padding: 0 }">
      <!-- 头部卡片区域 -->
      <div class="profile-header" :style="{ background: headerGradient }">
        <button class="close-btn" @click="emit('update:show', false)">
          <span v-html="CloseIcon"></span>
        </button>

        <div class="avatar-wrapper" :style="{ '--avatar-border-color': avatarBorderColor }">
          <img :src="avatarSrc" alt="" class="avatar-img" @error="handleAvatarError" />
          <span v-if="props.hasUnread" class="avatar-badge" />
        </div>

        <div class="profile-info">
          <div class="profile-name-row">
            <img v-if="roleIconUrl" :src="roleIconUrl" alt="" class="role-icon" />
            <span class="profile-name" :style="authorColor ? { color: authorColor } : undefined">
              {{ authorDisplayName }}
            </span>
          </div>
        </div>
      </div>

      <!-- 菜单区域 -->
      <nav class="menu-section">
        <button v-for="item in menuItems" :key="item.path" class="menu-item" @click="goTo(item.path)">
          <span class="menu-icon" v-html="iconMap[item.icon]"></span>
          <span class="menu-label">{{ item.label }}</span>
          <span class="menu-arrow" v-html="ChevronRightIcon"></span>
        </button>
      </nav>

      <!-- 底部区域 -->
      <div class="footer-section">
        <button class="about-btn" @click="showAboutModal = true">
          <span v-html="InfoIcon"></span>
          <span>关于</span>
        </button>
        <button class="logout-btn" @click="handleLogout">
          <span v-html="LogoutIcon"></span>
          <span>登出</span>
        </button>
      </div>
    </n-drawer-content>
  </n-drawer>

  <!-- 关于弹窗 -->
  <AboutModal v-model:show="showAboutModal" />
</template>

<style scoped>
.profile-header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 1.5rem 1.5rem;
  border-bottom: 1px solid var(--opz-border);
}

.close-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
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

.avatar-wrapper {
  position: relative;
  width: 72px;
  height: 72px;
  margin-bottom: 1rem;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background: var(--opz-bg-base);
  border: 2px solid var(--avatar-border-color, var(--opz-border));
  box-sizing: border-box;
}

.avatar-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 12px;
  height: 12px;
  background: #ef4444;
  border: 2px solid var(--opz-bg-base);
  border-radius: 50%;
}

.profile-info {
  text-align: center;
}

.profile-name-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.role-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.profile-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

/* 菜单区域 */
.menu-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem;
  gap: 0.25rem;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 240px;
  padding: 0.875rem 1rem;
  border: none;
  background: transparent;
  border-radius: var(--opz-radius-md);
  cursor: pointer;
  transition: all var(--opz-transition-fast);
  text-align: center;
}

.menu-item:hover {
  background: var(--opz-bg-soft);
}

.menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--opz-radius-md);
  background: var(--opz-bg-mute);
  color: var(--opz-text-secondary);
  flex-shrink: 0;
  transition: all var(--opz-transition-fast);
}

.menu-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.menu-item:hover .menu-icon {
  background: var(--opz-bg-base);
  color: var(--opz-text-primary);
}

.menu-label {
  flex: 1;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--opz-text-primary);
  text-align: left;
}

.menu-arrow {
  display: flex;
  align-items: center;
  color: var(--opz-text-tertiary);
  opacity: 0;
  transform: translateX(-4px);
  transition: all var(--opz-transition-fast);
}

.menu-arrow :deep(svg) {
  width: 16px;
  height: 16px;
}

.menu-item:hover .menu-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* 底部区域 */
.footer-section {
  margin-top: auto;
  padding: 0.75rem;
  border-top: 1px solid var(--opz-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.about-btn,
.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 240px;
  padding: 0.75rem;
  border: none;
  background: transparent;
  border-radius: var(--opz-radius-md);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--opz-transition-fast);
}

.about-btn :deep(svg),
.logout-btn :deep(svg) {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: block;
}

.about-btn {
  color: var(--opz-text-secondary);
}

.about-btn:hover {
  background: var(--opz-bg-soft);
  color: var(--opz-text-primary);
}

.logout-btn {
  color: var(--opz-danger);
}

.logout-btn:hover {
  background: var(--opz-danger-bg);
}
</style>
