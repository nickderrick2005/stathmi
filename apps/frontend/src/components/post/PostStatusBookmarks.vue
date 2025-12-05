<script setup lang="ts">
/**
 * 帖子状态书签组件
 * 左侧中部纵向书签，显示：新发布、收藏、安利、参与
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useFollowingSegment } from '@/composables/useFeedSegment';
import starFilledIcon from '@/assets/icons/star-filled.svg';
import giftIcon from '@/assets/icons/gift.svg';
import checkIcon from '@/assets/icons/check.svg';

const props = defineProps<{
  /** 是否被安利 */
  isRecommended?: boolean;
  /** 是否已关注（Discord 参与） */
  isFollowed?: boolean;
  /** 是否已收藏 */
  isFavorited?: boolean;
  /** 发布时间（用于判断是否是新内容） */
  createdAt?: string;
}>();

const router = useRouter();
const followingSegment = useFollowingSegment();

// 判断是否是 24 小时内发布的内容（与卡片边框高亮逻辑一致）
const isNew = computed(() => {
  if (!props.createdAt) return false;
  const created = new Date(props.createdAt);
  const diffInHours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  return diffInHours < 24;
});

interface BookmarkItem {
  key: string;
  icon?: string;
  text?: string;
  color: string;
  label: string;
  active: boolean;
}

// 书签配置（所有书签都只在满足条件时显示）
const bookmarks = computed<BookmarkItem[]>(() => {
  const items: BookmarkItem[] = [
    {
      key: 'new',
      text: 'NEW',
      color: '#10b981',
      label: '查看 24 小时内作品',
      active: isNew.value,
    },
    {
      key: 'favorited',
      icon: starFilledIcon,
      color: '#f7b731',
      label: '查看我的收藏',
      active: !!props.isFavorited,
    },
    {
      key: 'recommended',
      icon: giftIcon,
      color: '#ff6b35',
      label: '安利',
      active: !!props.isRecommended,
    },
    {
      key: 'followed',
      icon: checkIcon,
      color: '#4a90e2',
      label: '查看我参与的帖子',
      active: !!props.isFollowed,
    },
  ];

  return items.filter((item) => item.active);
});

// 处理书签点击
function handleBookmarkClick(bookmark: BookmarkItem) {
  // 安利书签不可点击
  if (bookmark.key === 'recommended') return;

  if (bookmark.key === 'new') {
    // 搜索 24 小时内作品：只设置 time_from，不设置 time_to 以包含当前时刻
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    router.push({
      path: '/search',
      query: {
        time: 'custom',
        time_from: yesterday.toISOString(),
      },
    });
  } else if (bookmark.key === 'favorited') {
    // 跳转到关注页的「我的收藏」segment
    followingSegment.value = 'favorites';
    router.push('/following');
  } else if (bookmark.key === 'followed') {
    // 跳转到关注页的「Discord 参与」segment
    followingSegment.value = 'following-discord';
    router.push('/following');
  }
}
</script>

<template>
  <TransitionGroup name="bookmark-fade" tag="div" class="post-status-bookmarks">
    <div
      v-for="bookmark in bookmarks"
      :key="bookmark.key"
      class="bookmark"
      :class="{ clickable: bookmark.key !== 'recommended', 'has-text': !!bookmark.text }"
      :style="{ '--bookmark-color': bookmark.color }"
      :title="bookmark.label"
      @click.stop="handleBookmarkClick(bookmark)"
    >
      <span v-if="bookmark.text" class="bookmark-text">{{ bookmark.text }}</span>
      <img v-else :src="bookmark.icon" :alt="bookmark.label" class="bookmark-icon" />
    </div>
  </TransitionGroup>
</template>

<style scoped>
/* 书签容器：左侧中部纵向排列 */
.post-status-bookmarks {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 书签样式：朝右 */
.bookmark {
  width: 32px;
  height: 28px;
  background: var(--bookmark-color);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 2px 0 6px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
  border-radius: 0 6px 6px 0;
}

/* 可点击的书签（收藏）增加鼠标提示 */
.bookmark.clickable {
  cursor: pointer;
}

.bookmark.clickable:hover {
  box-shadow: 3px 0 10px rgba(0, 0, 0, 0.4);
  filter: brightness(1.1);
}

/* SVG 图标样式 */
.bookmark-icon {
  width: 16px;
  height: 16px;
  user-select: none;
  pointer-events: none;
}

/* 文字书签：保持与图标书签相同高度 */
.bookmark.has-text {
  width: auto;
  min-width: 32px;
  padding: 0 6px;
}

.bookmark-text {
  font-size: 10px;
  font-weight: 700;
  color: white;
  letter-spacing: 0.3px;
  user-select: none;
}

/* 淡入淡出动画 */
.bookmark-fade-enter-active,
.bookmark-fade-leave-active {
  transition: all 0.25s ease;
}

.bookmark-fade-enter-from,
.bookmark-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* 手机端：书签（略小于桌面端） */
@media (max-width: 600px) {
  .bookmark {
    width: 27px;
    height: 24px;
    border-radius: 0 5px 5px 0;
  }

  .bookmark.has-text {
    width: auto;
    min-width: 27px;
    padding: 0 5px;
  }

  .bookmark-icon {
    width: 13px;
    height: 13px;
  }

  .bookmark-text {
    font-size: 8px;
    letter-spacing: 0.2px;
  }
}
</style>
