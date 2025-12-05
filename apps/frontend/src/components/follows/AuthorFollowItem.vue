<script setup lang="ts">
import { computed } from 'vue';
import type { Author, UserName } from '@opz-hub/shared';
import { useAuthorFallback } from '@/composables/useAuthorFallback';
import { useQuickConfirm } from '@/composables/useQuickConfirm';

type AuthorLike = Author | UserName;

const props = withDefaults(
  defineProps<{
    author: AuthorLike;
    pending?: boolean;
    mode?: 'follow' | 'block';
  }>(),
  {
    mode: 'follow',
  }
);

const emit = defineEmits<{
  unfollow: [];
  unblock: [];
  navigate: [];
}>();

// 判断是否为 UserName 类型（屏蔽作者使用）
function isUserName(author: AuthorLike): author is UserName {
  return 'displayName' in author;
}

// 显示名称优先级：服务器昵称 > 全局名称 > 用户名
const authorInfo = computed(() => {
  const author = props.author;
  if (isUserName(author)) {
    // UserName 类型（屏蔽作者）
    return {
      authorAvatar: author.avatar,
      authorName: author.displayName,
      authorDiscordRoles: author.roles.map((r) => r.roleId),
    };
  }
  // Author 类型（关注作者）
  return {
    authorAvatar: author.avatar,
    authorName: author.nickname ?? author.globalName ?? author.username,
    authorDiscordRoles: author.discordRoles,
  };
});

const { avatarSrc, authorDisplayName, authorColor, roleIconUrl, handleAvatarError } =
  useAuthorFallback(authorInfo);

const { confirm } = useQuickConfirm();

// 根据模式获取操作配置
const actionConfig = computed(() =>
  props.mode === 'block'
    ? { label: '取消屏蔽', confirmMsg: '确定要取消屏蔽这个作者吗？' }
    : { label: '取消关注', confirmMsg: '确定要取消关注这个作者吗？' }
);

async function handleAction(e: Event) {
  const confirmed = await confirm(e, actionConfig.value.confirmMsg);
  if (!confirmed) return;

  if (props.mode === 'block') {
    emit('unblock');
  } else {
    emit('unfollow');
  }
}
</script>

<template>
  <div class="author-item">
    <!-- 头像 -->
    <img :src="avatarSrc" alt="" class="author-avatar" @error="handleAvatarError" />

    <!-- 作者信息 -->
    <div class="author-info">
      <div class="author-name-row">
        <img v-if="roleIconUrl" :src="roleIconUrl" alt="" class="role-icon" />
        <span class="author-name" :style="authorColor ? { color: authorColor } : undefined">
          {{ authorDisplayName }}
        </span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="author-actions">
      <button type="button" class="action-btn profile-btn" :disabled="pending" @click="emit('navigate')">
        主页
      </button>
      <button type="button" class="action-btn unfollow-btn" :disabled="pending" @click="handleAction">
        {{ actionConfig.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.author-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--opz-border);
  border-radius: 10px;
  background: var(--opz-bg-card);
  transition: border-color 0.15s ease;
}

.author-item:hover {
  border-color: color-mix(in srgb, var(--opz-border) 50%, var(--opz-primary));
}

.author-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--opz-bg-elevated);
}

.author-info {
  flex: 1;
  min-width: 0;
}

.author-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.role-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.author-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--opz-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.action-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--opz-border);
  border-radius: 6px;
  background: var(--opz-bg-base);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.profile-btn {
  color: var(--opz-text-secondary);
}

.profile-btn:hover:not(:disabled) {
  border-color: var(--opz-primary);
  color: var(--opz-primary);
  background: color-mix(in srgb, var(--opz-primary) 10%, var(--opz-bg-base));
}

.unfollow-btn {
  color: var(--opz-text-tertiary);
}

.unfollow-btn:hover:not(:disabled) {
  border-color: var(--opz-danger);
  color: var(--opz-danger);
  background: color-mix(in srgb, var(--opz-danger) 10%, var(--opz-bg-base));
}
</style>
