<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppHeader from './AppHeader.vue';
import ChannelBar from '@/components/feed/ChannelBar.vue';
import SegmentBar from '@/components/feed/SegmentBar.vue';
import DiscordLinkPrompt from '@/components/common/DiscordLinkPrompt.vue';
import { useTrendingSegment, useFollowingSegment } from '@/composables/useFeedSegment';
import { useDiscordLink } from '@/composables/useDiscordLink';

const route = useRoute();

// ChannelBar 只在 Custom Feed 页面显示
const showChannelBar = computed(() => route.name === 'custom');

// SegmentBar 配置
const trendingSegments = [
  { value: 'trending-recommended', label: 'Trending' },
  { value: 'trending-new-hot', label: '新晋热门' },
  { value: 'trending-hidden-gems', label: '隐藏宝藏' },
];

const followingSegments = [
  { value: 'following-discord', label: 'Discord 参与' },
  { value: 'favorites', label: '我的收藏' },
  { value: 'following-authors', label: '关注作者' },
  { value: 'following-tags', label: '关注标签' },
];

// 各路由的 segment 状态（与 View 组件共享）
const trendingSegment = useTrendingSegment();
const followingSegment = useFollowingSegment();

const segmentBarConfig = computed(() => {
  if (route.name === 'trending') {
    return { segments: trendingSegments, segment: trendingSegment };
  }
  if (route.name === 'following') {
    return { segments: followingSegments, segment: followingSegment };
  }
  return null;
});

// Discord 跳转位置选择弹窗
const { showJumpPrompt, pendingFirstUrl, pendingUpdateUrl, handleJumpSelected } = useDiscordLink();
</script>

<template>
  <div class="app-layout">
    <AppHeader />
    <ChannelBar v-if="showChannelBar" />
    <SegmentBar
      v-else-if="segmentBarConfig"
      :segments="segmentBarConfig.segments"
      v-model:active-segment="segmentBarConfig.segment.value"
    />
    <main class="content">
      <slot />
    </main>

    <!-- 全局 Discord 跳转位置选择弹窗 -->
    <DiscordLinkPrompt
      v-model:show="showJumpPrompt"
      :first-url="pendingFirstUrl"
      :update-url="pendingUpdateUrl"
      @selected="handleJumpSelected"
    />

    <!-- 全局回到顶部按钮 -->
    <n-back-top :right="24" :bottom="24" />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--opz-bg-base);
}

.content {
  flex: 1;
  width: 100%;
  max-width: 2400px;
  margin: 0 auto;
  padding: 1.5rem;
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .content {
    padding: 0.5rem;
  }
}
</style>
