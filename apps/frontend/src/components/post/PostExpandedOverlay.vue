<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useWindowSize } from '@vueuse/core';
import { useExpandedPost } from '@/composables/useExpandedPost';
import { useFollowsStore } from '@/stores/follows';
import { useFavoritesStore } from '@/stores/favorites';
import { usePreferencesStore } from '@/stores/preferences';
import { useFollows } from '@/composables/useFollows';
import { useFavorites } from '@/composables/useFavorites';
import { useAuthorFallback } from '@/composables/useAuthorFallback';
import { extractContentIds, type ContentMetadata } from '@/utils/markdown-renderer';
import { fetchUserNames } from '@/api/users';
import { fetchPostTitles } from '@/api/posts';
import RoleBadge from '@/components/user/RoleBadge.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import PostContentRenderer from './PostContentRenderer.vue';
import { useDiscordLink } from '@/composables/useDiscordLink';

// 移动端断点
const MOBILE_BREAKPOINT = 768;

const router = useRouter();
const { expandedPost, cardRect, isExpanded, collapse } = useExpandedPost();
const followsStore = useFollowsStore();
const favoritesStore = useFavoritesStore();
const preferencesStore = usePreferencesStore();
const { toggleFollowAuthor } = useFollows();
const { toggleFavorite } = useFavorites();
const { width: windowWidth, height: windowHeight } = useWindowSize();

// 动画阶段
const animationPhase = ref<'initial' | 'expanding' | 'expanded' | 'collapsing'>('initial');
const overlayRef = ref<HTMLElement | null>(null);

// 内容加载状态（动画完成后短暂显示 loading）
const isContentLoading = ref(true);

// 内容元数据（用于解析 @用户 和旅程链接）
const contentMetadata = ref<ContentMetadata | undefined>(undefined);

// Discord 链接
const { openDiscordLink } = useDiscordLink();

// 响应式判断
const isMobile = computed(() => windowWidth.value <= MOBILE_BREAKPOINT);

// 展开卡片尺寸配置
const EXPANDED_CONFIG = {
  maxWidth: 1440, // 最大宽度
  maxHeight: 960, // 最大高度
  aspectRatio: 1.33, // 宽高比（竖向长方形）
  viewportPadding: 48, // 距视口边距
};

// 计算目标尺寸（桌面端长方形居中，移动端全屏）
const targetSize = computed(() => {
  if (isMobile.value) {
    return {
      width: windowWidth.value,
      height: windowHeight.value,
    };
  }
  // PC 端：竖向长方形，基于视口高度计算，限制最大宽高
  const availableHeight = windowHeight.value - EXPANDED_CONFIG.viewportPadding * 2;
  const availableWidth = windowWidth.value - EXPANDED_CONFIG.viewportPadding * 2;
  const height = Math.min(availableHeight, EXPANDED_CONFIG.maxHeight);
  // 同时限制宽度不超过视口可用宽度
  const width = Math.min(height * EXPANDED_CONFIG.aspectRatio, EXPANDED_CONFIG.maxWidth, availableWidth);
  return { width, height };
});

// 计算目标位置（居中到屏幕）
const targetPosition = computed(() => {
  const size = targetSize.value;
  return {
    left: (windowWidth.value - size.width) / 2,
    top: (windowHeight.value - size.height) / 2,
  };
});

// 计算 transform 参数（用于 FLIP 动画）
const transformParams = computed(() => {
  const rect = cardRect.value;
  const target = targetSize.value;
  const pos = targetPosition.value;
  if (!rect) return null;

  const scaleX = rect.width / target.width;
  const scaleY = rect.height / target.height;

  // 原卡片中心 vs 目标中心
  const rectCenterX = rect.left + rect.width / 2;
  const rectCenterY = rect.top + rect.height / 2;
  const targetCenterX = pos.left + target.width / 2;
  const targetCenterY = pos.top + target.height / 2;

  return {
    translateX: rectCenterX - targetCenterX,
    translateY: rectCenterY - targetCenterY,
    scaleX,
    scaleY,
  };
});

// 动画样式 - 使用 transform 优化性能
const cardStyle = computed(() => {
  const target = targetSize.value;
  const pos = targetPosition.value;
  const params = transformParams.value;
  const isCollapsed = animationPhase.value === 'initial' || animationPhase.value === 'collapsing';

  // 移动端：直接全屏，用淡入动画
  // 高度由 CSS 控制（支持 dvh 回退）
  if (isMobile.value) {
    return {
      position: 'fixed' as const,
      left: '0',
      top: '0',
      width: '100vw',
      borderRadius: '0',
      opacity: isCollapsed ? 0 : 1,
      transform: isCollapsed ? 'scale(0.95)' : 'scale(1)',
    };
  }

  // PC 端：始终使用目标位置，通过 transform 模拟原位置
  if (!params) return {};

  return {
    position: 'fixed' as const,
    left: `${pos.left}px`,
    top: `${pos.top}px`,
    width: `${target.width}px`,
    height: `${target.height}px`,
    borderRadius: isCollapsed ? '12px' : '16px',
    opacity: 1,
    // 收起时用 transform 移回原卡片位置
    transform: isCollapsed
      ? `translate(${params.translateX}px, ${params.translateY}px) scale(${params.scaleX}, ${params.scaleY})`
      : 'translate(0, 0) scale(1)',
  };
});

// 作者信息回退
const {
  useRoleIcon,
  avatarSrc,
  handleAvatarError,
  resetAvatarState,
  authorDisplayName,
  authorColorWithDefault: authorColorRaw,
  authorPrimaryRole,
  effectiveRole,
} = useAuthorFallback(expandedPost);

// 作者胶囊字号（响应标题字号配置，基准 14px）
const capsuleNameFontSize = computed(() => 14 + preferencesStore.cardTitleFontOffset);

// 作者胶囊颜色（根据配置决定是否使用角色颜色）
const authorColor = computed(() => {
  if (!preferencesStore.authorRoleColorEnabled) return 'var(--opz-text-primary)';
  return authorColorRaw.value;
});

// 头尾区域色调（基于作者角色色，带渐变）
const barTintStyle = computed(() => {
  const color = effectiveRole.value?.primaryColor;
  if (!color || color === '#000000') {
    // 默认渐变
    return {
      background: `linear-gradient(135deg,
        color-mix(in srgb, var(--opz-primary) 6%, var(--opz-bg-base)) 0%,
        var(--opz-bg-base) 100%)`,
    };
  }
  // 角色色渐变
  return {
    background: `linear-gradient(135deg,
      color-mix(in srgb, ${color} 12%, var(--opz-bg-base)) 0%,
      color-mix(in srgb, ${color} 4%, var(--opz-bg-base)) 100%)`,
  };
});

const isFollowing = computed(() => {
  const authorId = expandedPost.value?.authorId;
  return authorId ? followsStore.isFollowingAuthor(authorId) : false;
});

const isFavorited = computed(() => {
  const postId = expandedPost.value?.id;
  return postId ? favoritesStore.isFavorited(postId) : false;
});

// 操作进行中标志（防抖）
const isFollowPending = ref(false);
const isFavoritePending = ref(false);

// 处理关注作者
async function handleToggleFollow() {
  const authorId = expandedPost.value?.authorId;
  if (!authorId || isFollowPending.value) return;

  isFollowPending.value = true;
  try {
    await toggleFollowAuthor(authorId);
  } finally {
    isFollowPending.value = false;
  }
}

// 处理收藏作品
async function handleToggleFavorite() {
  const postId = expandedPost.value?.id;
  if (!postId || isFavoritePending.value) return;

  isFavoritePending.value = true;
  try {
    await toggleFavorite(postId);
  } finally {
    isFavoritePending.value = false;
  }
}

// 跳转作者主页
function goToAuthorProfile() {
  const authorId = expandedPost.value?.authorId;
  if (authorId) {
    navigatingAway = true;
    collapse();
    router.push({ name: 'user-profile', params: { id: authorId } });
  }
}

// 跳转首楼（Discord）
function goToDiscord() {
  const url = expandedPost.value?.discordUrl;
  if (url) {
    navigatingAway = true;
    collapse();
    openDiscordLink(url);
  }
}

// 跳转到最新更新
function goToUpdate() {
  const url = expandedPost.value?.updatedJumpUrl;
  if (url) {
    navigatingAway = true;
    collapse();
    openDiscordLink(url);
  }
}

// 是否有更新链接
const hasUpdateUrl = computed(() => !!expandedPost.value?.updatedJumpUrl);

// 处理关闭
function handleClose() {
  if (animationPhase.value !== 'expanded') return;

  animationPhase.value = 'collapsing';
  setTimeout(() => {
    collapse();
    animationPhase.value = 'initial';
  }, 300);
}

// 点击背景关闭
function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    handleClose();
  }
}

// ESC 键关闭
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isExpanded.value) {
    handleClose();
  }
}

// 加载内容元数据（用户名、旅程标题）
async function loadContentMetadata() {
  const content = expandedPost.value?.content;
  if (!content) {
    contentMetadata.value = undefined;
    return;
  }

  const { userIds, threadIds } = extractContentIds(content);
  if (!userIds.length && !threadIds.length) {
    contentMetadata.value = undefined;
    return;
  }

  // 并行请求用户名和旅程标题
  const [usersRes, titlesRes] = await Promise.all([
    userIds.length ? fetchUserNames(userIds) : Promise.resolve({ users: [] }),
    threadIds.length ? fetchPostTitles(threadIds) : Promise.resolve({ titles: [] }),
  ]);

  // 构建元数据映射
  const users = new Map<string, string>();
  for (const user of usersRes.users) {
    users.set(user.id, user.displayName);
  }

  const posts = new Map<string, string>();
  for (const post of titlesRes.titles) {
    posts.set(post.id, post.title);
  }

  contentMetadata.value = { users, posts };
}

// 锁定/解锁 body 滚动
function lockBodyScroll() {
  document.body.style.overflow = 'hidden';
}

function unlockBodyScroll() {
  document.body.style.overflow = '';
}

// 浏览器返回按钮支持
const HISTORY_STATE_KEY = 'post-expanded';
// 标记是否通过 popstate（返回按钮）关闭，避免重复 history.back()
let closedByPopstate = false;
// 标记是否正在导航到其他页面，此时不需要 history.back()
let navigatingAway = false;

function handlePopstate(e: PopStateEvent) {
  // 当前是展开状态且历史状态不含标记，说明用户点击了返回
  if (isExpanded.value && e.state?.[HISTORY_STATE_KEY] !== true) {
    closedByPopstate = true;
    handleClose();
  }
}

// Transition 离开动画完成后的清理
function handleAfterLeave() {
  // 动画完全结束后再处理历史记录，避免闪烁
  if (!closedByPopstate && !navigatingAway) {
    history.back();
  }
  closedByPopstate = false;
  navigatingAway = false;
}

// 监听展开状态变化
watch(isExpanded, async (expanded) => {
  if (expanded) {
    // 锁定 body 滚动，防止滚动穿透
    lockBodyScroll();
    // 添加历史记录，支持返回按钮关闭
    closedByPopstate = false;
    history.pushState({ [HISTORY_STATE_KEY]: true }, '', window.location.href);
    // 重置头像加载状态和内容元数据
    resetAvatarState();
    contentMetadata.value = undefined;
    isContentLoading.value = true;
    animationPhase.value = 'initial';
    await nextTick();
    // 触发展开动画
    requestAnimationFrame(() => {
      animationPhase.value = 'expanding';
      setTimeout(() => {
        animationPhase.value = 'expanded';
        // 动画完成后短暂延迟再隐藏 loading（等待内容渲染）
        setTimeout(() => {
          isContentLoading.value = false;
        }, 150);
      }, 300);
    });
    // 异步加载内容元数据（不阻塞动画）
    loadContentMetadata();
  } else {
    // 解锁 body 滚动
    unlockBodyScroll();
    // 历史记录清理移至 handleAfterLeave，在动画完成后执行
  }
});

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('popstate', handlePopstate);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('popstate', handlePopstate);
  // 确保组件卸载时解锁 body 滚动
  unlockBodyScroll();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay" @after-leave="handleAfterLeave">
      <div v-if="isExpanded" class="expanded-overlay" @click="handleBackdropClick">
        <!-- 背景遮罩 -->
        <div class="overlay-backdrop" @click="handleClose" />

        <!-- 展开卡片 -->
        <div
          ref="overlayRef"
          class="expanded-card"
          :class="[`phase-${animationPhase}`, { mobile: isMobile }]"
          :style="cardStyle"
        >
          <!-- 纯色背景 -->
          <div class="solid-background" />

          <!-- 主内容区 -->
          <div class="main-layout">
            <!-- 顶部栏：作者 + 关闭 -->
            <header class="top-bar" :style="barTintStyle">
              <button class="author-capsule" @click.stop="goToAuthorProfile" title="查看作者主页">
                <img
                  class="capsule-avatar"
                  :class="{ 'role-icon': useRoleIcon }"
                  :src="avatarSrc"
                  :alt="authorDisplayName"
                  @error="handleAvatarError"
                />
                <span class="capsule-name" :style="{ fontSize: `${capsuleNameFontSize}px`, color: authorColor }">
                  {{ authorDisplayName }}
                </span>
                <RoleBadge v-if="authorPrimaryRole" :role="authorPrimaryRole" />
              </button>
              <button class="close-btn" @click.stop="handleClose" aria-label="关闭">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <!-- 滚动内容区 -->
            <div class="scroll-content">
              <!-- Loading -->
              <div v-if="isContentLoading && animationPhase === 'expanded'" class="content-loading">
                <LoadingSpinner size="md" />
              </div>
              <template v-else>
                <!-- 标题 -->
                <div v-if="expandedPost?.title" class="title-block">
                  <h1 class="post-title">{{ expandedPost.title }}</h1>
                </div>
                <!-- 正文 -->
                <PostContentRenderer
                  v-if="expandedPost?.content"
                  :content="expandedPost.content"
                  :metadata="contentMetadata"
                />
                <div v-if="!expandedPost?.title && !expandedPost?.content" class="empty-content">暂无内容</div>
              </template>
            </div>

            <!-- 底部操作栏 -->
            <footer class="bottom-bar" :style="barTintStyle">
              <button
                class="footer-btn"
                :class="{ active: isFollowing }"
                :disabled="isFollowPending"
                @click.stop="handleToggleFollow"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                <span>{{ isFollowing ? '已关注' : '关注作者' }}</span>
              </button>
              <button
                class="footer-btn"
                :class="{ active: isFavorited }"
                :disabled="isFavoritePending"
                @click.stop="handleToggleFavorite"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  :fill="isFavorited ? 'currentColor' : 'none'"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span>{{ isFavorited ? '已收藏' : '收藏作品' }}</span>
              </button>
              <button class="footer-btn" @click.stop="goToDiscord">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span>跳转首楼</span>
              </button>
              <button v-if="hasUpdateUrl" class="footer-btn update" @click.stop="goToUpdate">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 20V4M5 11l7-7 7 7" />
                </svg>
                <span>跳转更新</span>
              </button>
            </footer>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ===== 基础布局 ===== */
.expanded-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

/* PC 端保留背景模糊 */
@media (min-width: 769px) {
  .overlay-backdrop {
    backdrop-filter: blur(4px);
  }
}

.expanded-card {
  position: fixed;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  border: 1px solid color-mix(in srgb, var(--opz-text-primary) 15%, transparent);
  z-index: 1;
  /* 使用 transform 优化动画性能 */
  will-change: transform, opacity;
  transform-origin: center center;
}

/* PC 端：保留完整动画 */
.expanded-card:not(.mobile) {
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 移动端：简化动画，提升性能 */
.expanded-card.mobile {
  box-shadow: none;
  border: none;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  /* dvh 回退：旧浏览器用 vh，支持的用 dvh */
  height: 100vh;
  height: 100dvh;
}

/* ===== 背景效果 ===== */
.solid-background {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--opz-bg-base);
}

/* ===== 主布局容器 ===== */
.main-layout {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  opacity: 0;
  transform: translateY(20px);
  transition:
    opacity 0.25s ease 0.15s,
    transform 0.25s ease 0.15s;
}

.phase-expanded .main-layout {
  opacity: 1;
  transform: translateY(0);
}

.mobile .main-layout {
  padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
}

/* ===== 顶部栏 ===== */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -16px -16px 0;
  padding: 16px 16px 12px;
  flex-shrink: 0;
  border-radius: 16px 16px 0 0;
  border-bottom: 1px solid color-mix(in srgb, var(--opz-text-primary) 8%, transparent);
}

.mobile .top-bar {
  margin: calc(-1 * max(16px, env(safe-area-inset-top))) -16px 0;
  padding: max(16px, env(safe-area-inset-top)) 16px 12px;
  border-radius: 0;
}

/* 作者胶囊 */
.author-capsule {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 6px;
  background: var(--opz-bg-base);
  border: 1px solid var(--opz-border);
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
  max-width: 280px;
}

.author-capsule:hover {
  background: var(--opz-bg-elevated);
  border-color: var(--opz-primary);
}

.author-capsule:active {
  transform: scale(0.98);
}

.capsule-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

/* 角色图标替代头像时用圆角方形 */
.capsule-avatar.role-icon {
  border-radius: 6px;
  object-fit: contain;
}

.capsule-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--opz-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 关闭按钮 */
.close-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--opz-border);
  border-radius: 50%;
  background: var(--opz-bg-base);
  color: var(--opz-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--opz-bg-elevated);
  border-color: var(--opz-primary);
}

.close-btn:active {
  transform: scale(0.95);
}

/* ===== 滚动内容区 ===== */
.scroll-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 8px 4px 0;
  margin: 0 -8px 0 0;
  /* 防止滚动穿透到底层页面 */
  overscroll-behavior: contain;
}

.scroll-content::-webkit-scrollbar {
  width: 6px;
}

.scroll-content::-webkit-scrollbar-track {
  background: transparent;
}

.scroll-content::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--opz-text-primary) 15%, transparent);
  border-radius: 3px;
}

.scroll-content::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--opz-text-primary) 30%, transparent);
}

.scroll-content {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--opz-text-primary) 15%, transparent) transparent;
}

/* 标题区块 */
.title-block {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid color-mix(in srgb, var(--opz-text-primary) 8%, transparent);
}

.post-title {
  margin: 0;
  padding: 12px 24px;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.5;
  text-align: center;
  color: var(--opz-text-primary);
  background: color-mix(in srgb, var(--opz-primary) 6%, var(--opz-bg-base));
  border: 1px solid color-mix(in srgb, var(--opz-primary) 15%, transparent);
  border-radius: 10px;
  max-width: 90%;
}

.empty-content {
  color: var(--opz-text-tertiary);
  text-align: center;
  padding: 40px 0;
}

/* 内容加载状态 */
.content-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
}

/* ===== 底部操作栏 ===== */
.bottom-bar {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 0 -16px -16px;
  padding: 12px 16px 16px;
  flex-shrink: 0;
  border-radius: 0 0 16px 16px;
  border-top: 1px solid color-mix(in srgb, var(--opz-text-primary) 8%, transparent);
}

.mobile .bottom-bar {
  margin: 0 -16px calc(-1 * max(16px, env(safe-area-inset-bottom)));
  padding: 12px 16px max(16px, env(safe-area-inset-bottom));
  border-radius: 0;
}

.footer-btn {
  flex: 1;
  max-width: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--opz-border);
  border-radius: 10px;
  background: var(--opz-bg-base);
  color: var(--opz-text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.footer-btn:hover {
  background: var(--opz-bg-elevated);
  border-color: var(--opz-primary);
}

.footer-btn:active {
  transform: scale(0.98);
}

.footer-btn.active {
  background: var(--opz-primary);
  border-color: var(--opz-primary);
  color: white;
}

.footer-btn.active:hover {
  opacity: 0.9;
}

.footer-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.footer-btn.update {
  background: color-mix(in srgb, var(--opz-primary) 10%, var(--opz-bg-base));
  border-color: var(--opz-primary);
  color: var(--opz-primary);
}

.footer-btn.update:hover {
  background: var(--opz-primary);
  color: white;
}

.footer-btn svg {
  flex-shrink: 0;
}

/* 移动端底部按钮 */
.mobile .footer-btn {
  padding: 10px 8px;
  font-size: 12px;
  gap: 4px;
}

/* ===== 过渡动画 ===== */
.overlay-enter-active .overlay-backdrop,
.overlay-leave-active .overlay-backdrop {
  transition: opacity 0.3s ease;
}

.overlay-enter-from .overlay-backdrop,
.overlay-leave-to .overlay-backdrop {
  opacity: 0;
}
</style>
