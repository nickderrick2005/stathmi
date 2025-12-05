<script setup lang="ts">
/**
 * 标题后徽章（NEW / 安利 / 收藏 / 参与）
 * 3DM 论坛风格小胶囊
 */
import { computed } from 'vue';
import type { Post } from '@opz-hub/shared';
import giftIcon from '@/assets/icons/gift.svg';
import starFilledIcon from '@/assets/icons/star-filled.svg';
import checkIcon from '@/assets/icons/check.svg';

const props = defineProps<{
  post: Post;
  /** 是否是新帖（可选，不传则自动根据 24 小时判断） */
  isNew?: boolean;
  /** 是否已收藏 */
  isFavorited?: boolean;
  /** 是否显示收藏徽章（默认 false） */
  showFavorite?: boolean;
  /** 是否显示参与徽章（默认 false） */
  showJoined?: boolean;
}>();

const emit = defineEmits<{
  clickNew: [e: Event];
  clickFavorite: [e: Event];
  clickJoined: [e: Event];
}>();

// 判断是否是 24 小时内的新帖
// 如果外部传入 true，直接使用（用于关注流等场景的自定义判断）
// 否则使用默认的 24 小时规则自己计算
const showNew = computed(() => {
  if (props.isNew === true) return true;
  const created = new Date(props.post.createdAt);
  const diffInHours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  return diffInHours < 24;
});
</script>

<template>
  <!-- NEW -->
  <button
    v-if="showNew"
    type="button"
    class="title-badge badge-new"
    title="查看24小时内作品"
    @click.stop="emit('clickNew', $event)"
  >
    NEW
  </button>
  <!-- 安利 -->
  <span v-if="post.isRecommended" class="title-badge badge-recommend" title="安利">
    <img :src="giftIcon" alt="" class="badge-icon" />安利
  </span>
  <!-- 收藏 -->
  <button
    v-if="showFavorite && isFavorited"
    type="button"
    class="title-badge badge-favorite"
    title="已收藏"
    @click.stop="emit('clickFavorite', $event)"
  >
    <img :src="starFilledIcon" alt="" class="badge-icon" />收藏
  </button>
  <!-- 参与 -->
  <button
    v-if="showJoined && post.isFollowedByUser"
    type="button"
    class="title-badge badge-joined"
    title="查看我参与的帖子"
    @click.stop="emit('clickJoined', $event)"
  >
    <img :src="checkIcon" alt="" class="badge-icon" />参与
  </button>
</template>

<style scoped>
.title-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 2px;
  flex-shrink: 0;
  white-space: nowrap;
  vertical-align: middle;
  line-height: 1.4;
  border: none;
  background: none;
  cursor: pointer;
  transition: filter 0.15s ease;
}

.title-badge:hover {
  filter: brightness(1.1);
}

.badge-icon {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  filter: brightness(0) invert(1);
}

/* NEW 徽章 */
.badge-new {
  background: #10b981;
  color: white;
}

/* 安利徽章 */
.badge-recommend {
  background: #ff6b35;
  color: white;
  cursor: default;
}

.badge-recommend:hover {
  filter: none;
}

/* 收藏徽章 */
.badge-favorite {
  background: #f7b731;
  color: white;
}

/* 参与徽章 */
.badge-joined {
  background: #4a90e2;
  color: white;
}
</style>
