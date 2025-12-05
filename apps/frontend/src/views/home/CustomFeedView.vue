<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePersistentFiltersStore } from '@/stores/filters';
import { type FeedSort } from '@/composables/useFeed';
import { useFeedPage } from '@/composables/useFeedPage';
import ViewShell from '@/components/layout/ViewShell.vue';
import PostFeedList from '@/components/feed/PostFeedList.vue';
import FeedTopbar from '@/components/feed/FeedTopbar.vue';
import { storeToRefs } from 'pinia';
import { useUIStore } from '@/stores/ui';

const filterStore = usePersistentFiltersStore();

// 按 channel 组合生成唯一 key
const channelKey = computed(() => {
  const channels = filterStore.selectedChannels;
  return channels.length > 0 ? channels.join(',') : 'all';
});

// feedKey 带 segment 前缀，segment:channel 级别的视图设置
const feedKey = computed(() => `custom:${channelKey.value}`);

type CustomSortBase = 'weighted' | 'created' | 'updated' | 'likes';

const sortOptions: Array<{ value: CustomSortBase; label: string }> = [
  { value: 'weighted', label: '智能' },
  { value: 'created', label: '发布' },
  { value: 'updated', label: '回复' },
  { value: 'likes', label: '点赞' },
];

const sort = ref<FeedSort>('weighted-desc');
const source = ref<'custom'>('custom');
const uiStore = useUIStore();
const { showFilterDrawer } = storeToRefs(uiStore);

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
  isRefreshing,
  handlePageChange: changePage,
  handlePageSizeChange: changePageSize,
} = useFeedPage({
  source,
  refreshTriggers: [
    () => filterStore.selectedChannels,
    () => filterStore.channelFilters,
    () => filterStore.timeRange,
    () => filterStore.customTimeFrom,
    () => filterStore.customTimeTo,
    () => filterStore.includeInvalid,
  ],
  debounceMs: 0,
  initialSort: sort.value,
  scrollKey: 'custom',
  scrollSegment: channelKey,
});

function handleSortChange(newSort: string) {
  const typedSort = newSort as FeedSort;
  if (typedSort === sort.value) return;
  sort.value = typedSort;
  changeSort(typedSort);
}

function openFilterDrawer() {
  showFilterDrawer.value = true;
}

async function handlePageChange(page: number) {
  await changePage(page);
}

async function handlePageSizeChange(size: number) {
  await changePageSize(size);
}
</script>

<template>
  <ViewShell>
    <FeedTopbar
      :sort-options="sortOptions"
      :active-sort="sort"
      show-filter
      :has-active-filters="filterStore.hasActiveFilters"
      :show-pagination="isPageMode"
      :current-page="currentPage"
      :total="total"
      :page-size="pageSize"
      :pagination-disabled="loading"
      :feed-key="feedKey"
      @sort="handleSortChange"
      @filter="openFilterDrawer"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
    />
    <PostFeedList
      :posts="posts"
      :loading="loading"
      :error="error"
      :has-more="hasMore"
      :total="total"
      :page-size="pageSize"
      :current-page="currentPage"
      :is-page-mode="isPageMode"
      :refreshing="isRefreshing"
      :feed-key="feedKey"
      :show-pagination-controls="false"
      :hide-channel="filterStore.selectedChannels.length > 0"
      :on-load-more="loadMore"
      :on-page-change="handlePageChange"
      :on-retry="refresh"
      :on-refresh="refresh"
    />
  </ViewShell>
</template>
