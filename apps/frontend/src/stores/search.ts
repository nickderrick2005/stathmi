import { defineStore } from 'pinia';
import type { SearchFilters, SearchSort, SearchTimeRange, TagRelation } from '@/types/search';

/**
 * 搜索筛选状态 (SearchStore)
 *
 * 职责：管理搜索页的临时筛选条件
 * - 搜索关键词 (q)
 * - 标签筛选 (tags)
 * - 排序方式 (sort)
 * - 时间范围 (timeRange)
 *
 * 数据源：与 URL query 双向同步（通过 useSearch composable）
 *
 * 使用场景：
 * - useFeed 的 "search" 数据源读取本 store 的 filters
 * - 搜索页表单通过 useSearch/useSearchForm 操作本 store
 *
 * 与 persistentFiltersStore 的边界：
 * - 本 store：搜索页专用，临时状态，刷新后从 URL 恢复
 * - persistentFiltersStore：用户偏好筛选，localStorage 持久化，跨页面保持
 */
export const DEFAULT_SEARCH_FILTERS: Readonly<SearchFilters> = {
  q: '',
  tags: [],
  tagRelation: 'OR',
  selectedKeywords: [],
  category: undefined,
  sort: 'weighted-desc',
  timeRange: 'all',
  customTimeFrom: null,
  customTimeTo: null,
  includeInvalid: false,
};

function normalizeValue(value: string) {
  return value.trim();
}

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .filter(Boolean)
        .map((tag) => normalizeValue(tag))
        .filter(Boolean)
    )
  );
}

export const useSearchStore = defineStore('search', {
  state: (): SearchFilters => ({
    ...DEFAULT_SEARCH_FILTERS,
  }),
  getters: {
    filters: (state): SearchFilters => ({
      q: state.q,
      tags: [...state.tags],
      tagRelation: state.tagRelation,
      selectedKeywords: [...state.selectedKeywords],
      category: state.category,
      sort: state.sort,
      timeRange: state.timeRange,
      customTimeFrom: state.customTimeFrom,
      customTimeTo: state.customTimeTo,
      includeInvalid: state.includeInvalid,
    }),
  },
  actions: {
    replaceAll(next: SearchFilters) {
      this.q = normalizeValue(next.q);
      this.tags = normalizeTags(next.tags);
      this.tagRelation = (next.tagRelation ?? DEFAULT_SEARCH_FILTERS.tagRelation) as TagRelation;
      this.selectedKeywords = normalizeTags(next.selectedKeywords ?? []);
      this.category = next.category;
      this.sort = (next.sort ?? DEFAULT_SEARCH_FILTERS.sort) as SearchSort;
      this.timeRange = (next.timeRange ?? DEFAULT_SEARCH_FILTERS.timeRange) as SearchTimeRange;
      if (this.timeRange === 'custom') {
        this.customTimeFrom = next.customTimeFrom ?? null;
        this.customTimeTo = next.customTimeTo ?? null;
      } else {
        this.customTimeFrom = null;
        this.customTimeTo = null;
      }
      this.includeInvalid = next.includeInvalid ?? false;
    },
    patch(partial: Partial<SearchFilters>) {
      this.replaceAll({
        ...this.filters,
        ...partial,
      });
    },
    reset() {
      this.replaceAll(DEFAULT_SEARCH_FILTERS);
    },
  },
});
