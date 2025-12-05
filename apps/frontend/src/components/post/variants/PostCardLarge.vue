<script setup lang="ts">
/**
 * 大图模式卡片
 *
 * 设计规格：
 * - 卡片比例：宽:高 = 3:5（长轴5，横向3）
 * - 手机端：一屏横向 2 个卡片
 * - PC端：一屏约 5 个卡片
 * - 背景：图片全屏显示
 * - 底部 1/3：模糊蒙版 + 关键信息
 * - 左上角：状态书签（安利、关注、收藏）
 * - 右上角：...操作菜单
 */
import { computed, ref } from 'vue';
import type { Post } from '@opz-hub/shared';
import { useAttachments } from '@/composables/useAttachments';
import { usePreferencesStore } from '@/stores/preferences';
import { useExpandedPost } from '@/composables/useExpandedPost';
import { useAuthorFallback } from '@/composables/useAuthorFallback';
import { getChannelDefaultImage } from '@/utils/constants';
import PostImageBackground from '../PostImageBackground.vue';
import PostStatusBookmarks from '../PostStatusBookmarks.vue';
import PostInfoOverlay from '../PostInfoOverlay.vue';
import PostCardActions from '../PostCardActions.vue';
import PostFooter from '../PostFooter.vue';
import ImageViewer from '@/components/common/ImageViewer.vue';

const props = defineProps<{
  post: Post;
  /** 是否已收藏 */
  isFavorited?: boolean;
  /** 是否为新帖子（基于用户上次查看时间） */
  isNew?: boolean;
}>();

const emit = defineEmits<{
  toggleFavorite: [];
  share: [];
  blockPost: [];
  blockPostAndAuthor: [];
  viewAuthor: [];
  findSimilar: [];
}>();

// 展开状态
const { expand } = useExpandedPost();
const cardRef = ref<HTMLElement | null>(null);

// 处理附件
const { allImages } = useAttachments(props.post);

// 当前图片索引
const currentImageIndex = ref(0);

// 图片查看器状态
const showImageViewer = ref(false);

function openImageViewer() {
  if (allImages.value.length === 0) return;
  showImageViewer.value = true;
}

const preferencesStore = usePreferencesStore();

// 作者信息回退（包装 props 为 computed ref）
const postRef = computed(() => props.post);
const { useRoleIcon, avatarSrc, handleAvatarError, authorDisplayName, authorColor } = useAuthorFallback(postRef);

// 作者胶囊字号（响应标题字号配置，基准 12px）
const capsuleNameFontSize = computed(() => 12 + preferencesStore.cardTitleFontOffset);

// 作者胶囊颜色（根据配置决定是否使用角色颜色）
const capsuleNameColor = computed(() => {
  if (!preferencesStore.authorRoleColorEnabled) return undefined;
  return authorColor.value;
});

// 频道默认封面图
const fallbackImage = computed(() => getChannelDefaultImage(props.post.categoryId));

// 根据分区生成默认背景色（当没有默认图片时使用）
const fallbackColor = computed(() => {
  const colors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  ];

  // 基于 categoryId 的哈希选择颜色
  const hash = props.post.categoryId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
});

// 卡片边框样式（根据发布/更新时间）
const borderStyle = computed(() => {
  const now = new Date();
  const createdAt = new Date(props.post.createdAt);
  const updatedAt = props.post.updatedAt ? new Date(props.post.updatedAt) : null;

  // 计算最近的时间（发布或更新）
  const latestTime = updatedAt && updatedAt > createdAt ? updatedAt : createdAt;
  const diffInHours = (now.getTime() - latestTime.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    // 新发布/更新（<24小时）：金色光晕
    return {
      borderColor: '#ffd700',
      boxShadow: '0 0 12px rgba(255, 215, 0, 0.6), 0 4px 8px rgba(0, 0, 0, 0.2)',
    };
  } else if (diffInHours < 24 * 7) {
    // 近期更新（<7天）：蓝色边框
    return {
      borderColor: '#4a90e2',
      boxShadow: '0 0 8px rgba(74, 144, 226, 0.4), 0 4px 8px rgba(0, 0, 0, 0.2)',
    };
  }

  // 普通：灰色细边框
  return {
    borderColor: 'rgba(0, 0, 0, 0.1)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  };
});

// 预加载 markdown 渲染器（hover 时触发）
// 模块级单例：所有卡片实例共享，确保只预加载一次
let preloaded = false;
function preloadMarkdownRenderer() {
  if (preloaded) return;
  preloaded = true;
  import('@/utils/markdown-renderer');
}

// 处理卡片点击 - 展开内容
function handleCardClick() {
  if (cardRef.value) {
    const rect = cardRef.value.getBoundingClientRect();
    expand(props.post, rect);
  }
}

// 书签操作处理
function handleToggleFavorite() {
  emit('toggleFavorite');
}

// 菜单操作处理
function handleShare() {
  emit('share');
}

function handleBlockPost() {
  emit('blockPost');
}

function handleBlockPostAndAuthor() {
  emit('blockPostAndAuthor');
}

function handleViewAuthor() {
  emit('viewAuthor');
}

function handleFindSimilar() {
  emit('findSimilar');
}
</script>

<template>
  <div
    ref="cardRef"
    class="post-card-large"
    :style="borderStyle"
    @click="handleCardClick"
    @mouseenter="preloadMarkdownRenderer"
  >
    <!-- 背景图片 -->
    <PostImageBackground
      v-model:current-index="currentImageIndex"
      :images="allImages"
      :fallback-image="fallbackImage"
      :fallback-color="fallbackColor"
    >
      <template #actions>
        <PostCardActions
          :post-id="post.id"
          :author-id="post.authorId"
          :discord-url="post.discordUrl"
          :updated-jump-url="post.updatedJumpUrl"
          :is-favorited="isFavorited"
          :has-images="allImages.length > 0"
          @toggle-favorite="handleToggleFavorite"
          @view-images="openImageViewer"
          @share="handleShare"
          @block-post="handleBlockPost"
          @block-post-and-author="handleBlockPostAndAuthor"
          @view-author="handleViewAuthor"
          @find-similar="handleFindSimilar"
        />
      </template>
    </PostImageBackground>

    <!-- 顶部作者胶囊 -->
    <button class="author-capsule" @click.stop="handleViewAuthor" title="查看作者主页">
      <img
        :src="avatarSrc"
        :alt="authorDisplayName"
        class="capsule-avatar"
        :class="{ 'role-icon': useRoleIcon }"
        @error="handleAvatarError"
      />
      <span
        class="capsule-name"
        :style="{ fontSize: `${capsuleNameFontSize}px`, color: capsuleNameColor || undefined }"
      >
        {{ authorDisplayName }}
      </span>
    </button>

    <!-- 左侧状态书签 -->
    <PostStatusBookmarks
      :is-recommended="post.isRecommended"
      :is-followed="post.isFollowedByUser"
      :is-favorited="isFavorited"
      :created-at="post.createdAt"
      @toggle-favorite="handleToggleFavorite"
    />

    <!-- 底部信息蒙版 -->
    <PostInfoOverlay :post="post">
      <template #footer>
        <PostFooter
          :created-at="post.createdAt"
          :updated-at="post.updatedAt"
          :reaction-count="post.reactionCount"
          :message-count="post.messageCount"
          :image-count="allImages.length"
          :current-index="currentImageIndex"
          @go-to-image="currentImageIndex = $event"
          @open-image-viewer="openImageViewer"
        />
      </template>
    </PostInfoOverlay>

    <!-- 图片查看器 -->
    <ImageViewer v-model:show="showImageViewer" :images="allImages" :initial-index="currentImageIndex" />
  </div>
</template>

<style scoped>
.post-card-large {
  /* 卡片比例：宽/高 ≈ 0.62 */
  aspect-ratio: 0.62;
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  border: 2px solid var(--border-color, rgba(0, 0, 0, 0.1));
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: #f5f5f5;
  user-select: none;
  /* 宽度由父容器 Grid 控制，设置最小宽度确保内容可读 */
  width: 100%;
  min-width: 160px;
}

.post-card-large:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15) !important;
}

.post-card-large:active {
  transform: translateY(-2px);
}

/* 顶部作者胶囊 - 靠左贴合，响应主题 */
.author-capsule {
  position: absolute;
  top: 12px;
  left: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 6px 8px;
  background: color-mix(in srgb, var(--opz-bg-base) 92%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 0 999px 999px 0;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.2);
  max-width: 170px;
  transition: all 0.2s ease;
  /* button 重置 */
  border: none;
  cursor: pointer;
  font: inherit;
}

.author-capsule:hover {
  filter: brightness(1.05);
  box-shadow: 3px 3px 12px rgba(0, 0, 0, 0.25);
}

.author-capsule:active {
  transform: scale(0.98);
}

.capsule-avatar {
  width: 24px;
  height: 24px;
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
  font-size: 11px;
  font-weight: 600;
  color: var(--opz-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 响应式布局 - 宽度由 Grid 控制，这里只需处理内部元素 */

/* 手机端：作者胶囊（略小于桌面端） */
@media (max-width: 600px) {
  .author-capsule {
    top: 8px;
    gap: 5px;
    padding: 5px 10px 5px 6px;
    max-width: 140px;
  }

  .capsule-avatar {
    width: 20px;
    height: 20px;
  }

  .capsule-name {
    font-size: 11px !important;
  }

  .capsule-avatar.role-icon {
    border-radius: 5px;
  }
}
</style>
