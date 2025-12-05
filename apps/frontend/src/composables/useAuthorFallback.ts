import { computed, ref, type Ref, type ComputedRef } from 'vue';
import { useRolesStore } from '@/stores/roles';
import defaultAvatar from '@/assets/icons/avatar-default.svg';

// 创作者角色 ID（用于默认头像和色调）
const DEFAULT_ROLE_ID = '1336817752844796016';

interface AuthorInfo {
  authorAvatar?: string | null;
  authorName?: string | null;
  authorDiscordRoles?: readonly string[];
}

type MaybeRef<T> = Ref<T> | ComputedRef<T>;

/**
 * 作者信息回退 composable
 *
 * 处理作者头像、名称、角色的统一回退逻辑：
 * - 头像：用户头像 -> 角色图标 -> 默认头像
 * - 名称：用户名 -> "创作者"
 * - 角色颜色：用户角色 -> 创作者角色 -> 默认
 */
export function useAuthorFallback(authorInfo: MaybeRef<AuthorInfo | null | undefined>) {
  const rolesStore = useRolesStore();

  // 头像加载失败标记
  const avatarFailed = ref(false);

  // 重置头像加载状态（切换作者时调用）
  function resetAvatarState() {
    avatarFailed.value = false;
  }

  // 检查是否为 Discord 默认头像
  const isDiscordDefaultAvatar = computed(() => {
    const avatar = authorInfo.value?.authorAvatar;
    if (!avatar) return true;
    return avatar.includes('/embed/avatars/');
  });

  // 默认角色（创作者）
  const defaultRole = computed(() => rolesStore.getRoleById(DEFAULT_ROLE_ID));

  // 作者的主要角色
  const authorPrimaryRole = computed(() => {
    const roles = authorInfo.value?.authorDiscordRoles;
    return roles ? rolesStore.getPrimaryRole([...roles]) : null;
  });

  // 最终使用的角色（作者角色 > 默认角色）- 用于头像和色调
  const effectiveRole = computed(() => authorPrimaryRole.value || defaultRole.value);

  // 角色图标 URL
  const roleIconUrl = computed(() => effectiveRole.value?.iconUrl ?? null);

  // 是否使用角色图标替代头像
  const useRoleIcon = computed(() => {
    return (isDiscordDefaultAvatar.value || avatarFailed.value) && roleIconUrl.value;
  });

  // 最终头像地址
  const avatarSrc = computed(() => {
    if (useRoleIcon.value && roleIconUrl.value) return roleIconUrl.value;
    return authorInfo.value?.authorAvatar || defaultAvatar;
  });

  // 头像加载失败处理
  function handleAvatarError() {
    avatarFailed.value = true;
  }

  // 作者名称（回退到"创作者"）
  const authorDisplayName = computed(() => authorInfo.value?.authorName || '创作者');

  // 作者名称颜色
  const authorColor = computed(() => {
    const color = effectiveRole.value?.primaryColor;
    if (!color || color === '#000000') return null;
    return color;
  });

  // 作者名称颜色（带默认值，用于必须有颜色的场景）
  const authorColorWithDefault = computed(() => {
    return authorColor.value || 'var(--opz-text-primary)';
  });

  return {
    // 状态
    avatarFailed,
    // 计算属性
    isDiscordDefaultAvatar,
    defaultRole,
    authorPrimaryRole,
    effectiveRole,
    roleIconUrl,
    useRoleIcon,
    avatarSrc,
    authorDisplayName,
    authorColor,
    authorColorWithDefault,
    // 方法
    resetAvatarState,
    handleAvatarError,
  };
}
