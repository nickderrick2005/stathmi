<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useTrendingSegment } from '@/composables/useFeedSegment';
import { useFeedPage } from '@/composables/useFeedPage';
import { useFeedFiltersStore } from '@/stores/feed-filters';
import ViewShell from '@/components/layout/ViewShell.vue';
import PostFeedList from '@/components/feed/PostFeedList.vue';
import FeedTopbar from '@/components/feed/FeedTopbar.vue';
import FeedFilters from '@/components/feed/FeedFilters.vue';

// 与 AppLayout 共享的 segment 状态
const source = useTrendingSegment();
// 筛选状态
const feedFiltersStore = useFeedFiltersStore();
const { trendingChannels, trendingIncludeInvalid } = storeToRefs(feedFiltersStore);

// 用于触发刷新的筛选条件
const filterTriggers = computed(() => ({
  channels: trendingChannels.value,
  includeInvalid: trendingIncludeInvalid.value,
}));

const {
  posts,
  loading,
  error,
  hasMore,
  total,
  pageSize,
  currentPage,
  isPageMode,
  loadMore,
  refresh,
  handlePageChange,
  handlePageSizeChange,
} = useFeedPage({
  source,
  scrollKey: 'trending',
  scrollSegment: source,
  refreshTriggers: [filterTriggers],
  debounceMs: 500,
});

function handleChannelsChange(channels: string[]) {
  feedFiltersStore.setTrendingChannels(channels);
}

function handleIncludeInvalidChange(value: boolean) {
  feedFiltersStore.setTrendingIncludeInvalid(value);
}
</script>

<template>
  <ViewShell>
    <FeedTopbar
      :feed-key="source"
      :show-pagination="isPageMode"
      :current-page="currentPage"
      :total="total"
      :page-size="pageSize"
      :pagination-disabled="loading"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
    >
      <FeedFilters
        :selected-channels="trendingChannels"
        :include-invalid="trendingIncludeInvalid"
        default-mode="followed"
        @update:selected-channels="handleChannelsChange"
        @update:include-invalid="handleIncludeInvalidChange"
      />
    </FeedTopbar>
    <PostFeedList
      :posts="posts"
      :loading="loading"
      :error="error"
      :has-more="hasMore"
      :total="total"
      :page-size="pageSize"
      :current-page="currentPage"
      :is-page-mode="isPageMode"
      :feed-key="source"
      :show-pagination-controls="false"
      :on-load-more="loadMore"
      :on-page-change="handlePageChange"
      :on-retry="refresh"
      :on-refresh="refresh"
    />
  </ViewShell>
</template>
