<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useFollowingSegment } from '@/composables/useFeedSegment';
import { useFeedPage } from '@/composables/useFeedPage';
import type { FeedSort } from '@/composables/useFeed';
import { useUserStore } from '@/stores/user';
import { useFeedFiltersStore } from '@/stores/feed-filters';
import ViewShell from '@/components/layout/ViewShell.vue';
import PostFeedList from '@/components/feed/PostFeedList.vue';
import FeedTopbar from '@/components/feed/FeedTopbar.vue';
import FeedFilters from '@/components/feed/FeedFilters.vue';

const userStore = useUserStore();
const { followingFeedViewedAt, isAuthenticated } = storeToRefs(userStore);

// 与 AppLayout 共享的 segment 状态
const source = useFollowingSegment();
// 筛选状态
const feedFiltersStore = useFeedFiltersStore();
const { followingChannels, followingIncludeInvalid } = storeToRefs(feedFiltersStore);

// 排序选项
type FollowingSortBase = 'weighted' | 'created' | 'updated' | 'likes';
const sortOptions: Array<{ value: FollowingSortBase; label: string }> = [
  { value: 'weighted', label: '智能' },
  { value: 'created', label: '发布' },
  { value: 'updated', label: '回复' },
  { value: 'likes', label: '点赞' },
];
const sort = ref<FeedSort>('weighted-desc');

// 用于触发刷新的筛选条件
const filterTriggers = computed(() => ({
  channels: followingChannels.value,
  includeInvalid: followingIncludeInvalid.value,
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
  changeSort,
  refresh,
  handlePageChange: changePage,
  handlePageSizeChange: changePageSize,
} = useFeedPage({
  source,
  initialSort: sort.value,
  refreshTriggers: [filterTriggers],
  debounceMs: 500,
  scrollKey: 'following',
  scrollSegment: source,
});

// 是否显示新内容标记（仅在关注作者和关注标签 tab）
const showNewIndicator = computed(() => source.value === 'following-authors' || source.value === 'following-tags');

// 进入页面时加载 viewedAt
onMounted(async () => {
  if (isAuthenticated.value) {
    await userStore.loadFollowingFeedViewedAt();
  }
});

function handleSortChange(newSort: string) {
  const typedSort = newSort as FeedSort;
  if (typedSort === sort.value) return;
  sort.value = typedSort;
  changeSort(typedSort);
}

async function handlePageChange(page: number) {
  await changePage(page);
}

async function handlePageSizeChange(size: number) {
  await changePageSize(size);
}

function handleChannelsChange(channels: string[]) {
  feedFiltersStore.setFollowingChannels(channels);
}

function handleIncludeInvalidChange(value: boolean) {
  feedFiltersStore.setFollowingIncludeInvalid(value);
}

// 滚动过新内容后更新时间戳
async function handleNewContentPassed() {
  if (!isAuthenticated.value) return;
  const now = new Date().toISOString();
  await userStore.saveFollowingFeedViewedAt(now);
}
</script>

<template>
  <ViewShell>
    <FeedTopbar
      :feed-key="source"
      :sort-options="sortOptions"
      :active-sort="sort"
      :show-pagination="isPageMode"
      :current-page="currentPage"
      :total="total"
      :page-size="pageSize"
      :pagination-disabled="loading"
      @sort="handleSortChange"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
    >
      <FeedFilters
        :selected-channels="followingChannels"
        :include-invalid="followingIncludeInvalid"
        default-mode="all"
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
      :show-new-indicator="showNewIndicator"
      :viewed-at="followingFeedViewedAt"
      @new-content-passed="handleNewContentPassed"
    />
  </ViewShell>
</template>
