<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useSearchStore } from '@/stores/search';
import { type PostSource } from '@/composables/useFeed';
import { useFeedPage } from '@/composables/useFeedPage';
import ViewShell from '@/components/layout/ViewShell.vue';
import PostFeedList from '@/components/feed/PostFeedList.vue';
import BackButton from '@/components/common/BackButton.vue';
import FeedTopbar from '@/components/feed/FeedTopbar.vue';
import SearchFilterPanel from '@/components/search/SearchFilterPanel.vue';
import type { SearchSort } from '@/types/search';

const sortOptions: Array<{ value: string; label: string }> = [
  { value: 'weighted', label: '智能' },
  { value: 'created', label: '发布' },
  { value: 'updated', label: '回复' },
  { value: 'likes', label: '点赞' },
];

const searchStore = useSearchStore();
const source = ref<PostSource>('search');
const pageSize = ref<number>(40);
const filterExpanded = ref(false);

const {
  posts,
  loading,
  error,
  hasMore,
  total,
  pageSize: resolvedPageSize,
  currentPage,
  isPageMode,
  refresh,
  handlePageChange: changePage,
  handlePageSizeChange: changePageSize,
} = useFeedPage({
  source,
  refreshTriggers: [() => searchStore.filters],
  debounceMs: 500,
  autoFetchOnMount: false,
  pageSize,
  forcePaginationStyle: 'pages',
  scrollKey: 'search',
  pageSizeState: pageSize,
});

const title = computed(() => {
  const q = searchStore.filters.q.trim();
  const keywords = searchStore.filters.selectedKeywords;
  const parts = [q, ...keywords].filter(Boolean);
  return parts.length > 0 ? `搜索：${parts.join(' ')}` : '搜索';
});

const shouldShowPagination = computed(() => {
  const totalCount = total.value ?? 0;
  const size = resolvedPageSize.value ?? 0;
  return totalCount > 0 && size > 0;
});

// 检查是否有活跃的筛选条件（不包括排序）
const hasActiveFilters = computed(() => {
  const f = searchStore.filters;
  return f.tags.length > 0 || f.category !== undefined || f.timeRange !== 'all' || f.includeInvalid === true;
});

// 排序相关
const activeSort = computed(() => searchStore.filters.sort);

function handleSortChange(value: string) {
  searchStore.patch({ sort: value as SearchSort });
}

function toggleFilter() {
  filterExpanded.value = !filterExpanded.value;
}

onMounted(() => {
  // 有关键词、标签或自定义时间范围时都触发搜索
  if (searchStore.filters.q || searchStore.filters.tags.length || searchStore.filters.timeRange === 'custom') {
    void refresh();
  }
});

const handlePageChange = changePage;
const handlePageSizeChange = changePageSize;
</script>

<template>
  <ViewShell eyebrow="">
    <template #header>
      <div class="search-header">
        <div class="title-row">
          <BackButton />
          <h1 class="search-title">{{ title }}</h1>
          <span v-if="total && total > 0" class="total-count">{{ total }} 条</span>
        </div>
        <button
          type="button"
          class="filter-btn"
          :class="{ active: filterExpanded || hasActiveFilters }"
          @click="toggleFilter"
        >
          <img src="@/assets/icons/filter.svg" alt="" class="filter-icon" />
          <span>{{ filterExpanded ? '收起' : '筛选' }}</span>
        </button>
      </div>
    </template>

    <!-- 筛选面板容器 -->
    <div class="filter-container">
      <SearchFilterPanel v-model:expanded="filterExpanded" :posts="posts" :loading="loading" />
    </div>

    <!-- 排序 + 视图 + 分页 -->
    <FeedTopbar
      class="search-topbar"
      :sort-options="sortOptions"
      :active-sort="activeSort"
      :show-pagination="shouldShowPagination"
      :current-page="currentPage"
      :total="total"
      :page-size="resolvedPageSize"
      :pagination-disabled="loading"
      feed-key="search"
      @sort="handleSortChange"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
    />

    <PostFeedList
      :posts="posts"
      :loading="loading"
      :error="error"
      :has-more="hasMore"
      :on-page-change="handlePageChange"
      :is-page-mode="isPageMode"
      :total="total"
      :page-size="resolvedPageSize"
      :current-page="currentPage"
      :on-retry="refresh"
      :on-refresh="refresh"
      :show-pagination-controls="false"
      feed-key="search"
    />
  </ViewShell>
</template>

<style scoped>
.search-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--opz-text-primary);
}

.total-count {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--opz-text-secondary);
  font-variant-numeric: tabular-nums;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--opz-border);
  border-radius: 10px;
  background: var(--opz-bg-soft);
  color: var(--opz-text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease;
}

.filter-btn:hover {
  background: var(--opz-bg-mute);
}

.filter-btn:active {
  transform: scale(0.95);
}

.filter-btn.active {
  background: var(--opz-primary);
  border-color: var(--opz-primary);
  color: white;
}

.filter-icon {
  width: 14px;
  height: 14px;
  opacity: 0.7;
}

.filter-btn.active .filter-icon {
  filter: brightness(0) invert(1);
  opacity: 1;
}

.filter-container {
  position: relative;
  height: 0;
}

.search-topbar {
  margin-top: -1rem;
}

@media (max-width: 640px) {
  .search-header {
    gap: 0.75rem;
  }

  .search-title {
    font-size: 1.25rem;
  }

  .total-count {
    font-size: 0.8rem;
  }

  .filter-btn {
    padding: 5px 10px;
    font-size: 12px;
  }

  .filter-icon {
    width: 13px;
    height: 13px;
  }
}

/* 暗色主题适配 */
:root[data-theme='dark'] .filter-btn {
  background: var(--opz-bg-soft);
  border-color: var(--opz-border);
}

:root[data-theme='dark'] .filter-btn:hover {
  background: var(--opz-bg-mute);
}

:root[data-theme='dark'] .filter-icon {
  filter: invert(1);
}

:root[data-theme='dark'] .filter-btn.active {
  background: var(--opz-primary);
  border-color: var(--opz-primary);
}

:root[data-theme='dark'] .filter-btn.active .filter-icon {
  filter: brightness(0) invert(1);
}
</style>
