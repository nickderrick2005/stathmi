<script setup lang="ts">
/**
 * 帖子卡片右上角操作按钮组
 * 包含：跳转 Discord、收藏、菜单
 */
import { useDiscordLink } from '@/composables/useDiscordLink';
import starOutlineIcon from '@/assets/icons/star-outline.svg';
import starFilledIcon from '@/assets/icons/star-filled.svg';
import PostActionMenu from './PostActionMenu.vue';

const props = defineProps<{
  postId: string;
  authorId?: string;
  discordUrl?: string;
  updatedJumpUrl?: string | null;
  isFavorited?: boolean;
  hasImages?: boolean;
}>();

const emit = defineEmits<{
  toggleFavorite: [];
  viewImages: [];
  share: [];
  blockPost: [];
  blockPostAndAuthor: [];
  viewAuthor: [];
  findSimilar: [];
}>();

const { openWithJumpChoice } = useDiscordLink();

function handleOpenDiscord() {
  if (props.discordUrl) {
    openWithJumpChoice(props.discordUrl, props.updatedJumpUrl ?? null);
  }
}

function handleToggleFavorite() {
  emit('toggleFavorite');
}

function handleViewImages() {
  emit('viewImages');
}

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
  <div class="post-card-actions" @touchstart.stop @touchmove.stop @touchend.stop @click.stop>
    <button class="action-button" type="button" title="前往 Discord" @click="handleOpenDiscord">
      <img src="@/assets/icons/link.svg" alt="跳转" />
    </button>

    <button
      class="action-button favorite-button"
      :class="{ active: isFavorited }"
      type="button"
      :title="isFavorited ? '取消收藏' : '收藏'"
      @click="handleToggleFavorite"
    >
      <img :src="isFavorited ? starFilledIcon : starOutlineIcon" alt="收藏" />
    </button>

    <PostActionMenu
      :post-id="postId"
      :author-id="authorId"
      :has-images="hasImages"
      variant="stacked"
      @view-images="handleViewImages"
      @share="handleShare"
      @block-post="handleBlockPost"
      @block-post-and-author="handleBlockPostAndAuthor"
      @view-author="handleViewAuthor"
      @find-similar="handleFindSimilar"
    />
  </div>
</template>

<style scoped>
.post-card-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 8;
}

.action-button {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--opz-bg-base) 85%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--opz-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  pointer-events: auto;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--opz-bg-base) 30%, transparent);
  opacity: 0.9;
}

.action-button img {
  width: 18px;
  height: 18px;
}

/* 深色主题下反色 icon */
:root[data-theme='dark'] .action-button img {
  filter: invert(1);
}

.action-button:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--opz-bg-base) 95%, transparent);
  transform: translateY(-1px) scale(1.05);
}

.action-button:active {
  transform: scale(0.95);
}

/* 手机端 */
@media (max-width: 600px) {
  .post-card-actions {
    top: 8px;
    right: 8px;
    gap: 6px;
  }

  .action-button {
    width: 30px;
    height: 30px;
  }

  .action-button img {
    width: 15px;
    height: 15px;
  }
}
</style>
