import { computed, watch } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw, isNavigationFailure } from 'vue-router';
import type { SearchFilters, SearchSort, SearchTimeRange } from '@/types/search';
import { SEARCH_SORT_OPTIONS, SEARCH_TIME_RANGE_OPTIONS } from '@/types/search';
import { useSearchStore, DEFAULT_SEARCH_FILTERS } from '@/stores/search';

function parseTags(value: unknown): string[] {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value.join(',') : String(value);
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isSort(value: unknown): value is SearchSort {
  return typeof value === 'string' && SEARCH_SORT_OPTIONS.includes(value as SearchSort);
}

function isTimeRange(value: unknown): value is SearchTimeRange {
  return typeof value === 'string' && SEARCH_TIME_RANGE_OPTIONS.includes(value as SearchTimeRange);
}

function toQuery(params: SearchFilters): LocationQueryRaw {
  const query: LocationQueryRaw = {};

  if (params.q.trim()) {
    query.q = params.q.trim();
  }

  if (params.tags.length) {
    query.tags = params.tags.join(',');
  }

  if (params.tagRelation === 'AND') {
    query.tag_rel = 'AND';
  }

  if (params.selectedKeywords.length) {
    query.keywords = params.selectedKeywords.join(',');
  }

  if (params.category) {
    query.category = params.category;
  }

  if (params.sort !== DEFAULT_SEARCH_FILTERS.sort) {
    query.sort = params.sort;
  }

  if (params.timeRange !== DEFAULT_SEARCH_FILTERS.timeRange) {
    query.time = params.timeRange;
  }

  if (params.timeRange === 'custom') {
    if (params.customTimeFrom) query.time_from = params.customTimeFrom;
    if (params.customTimeTo) query.time_to = params.customTimeTo;
  }

  if (params.includeInvalid) {
    query.include_invalid = '1';
  }

  return query;
}

export function useSearch() {
  const route = useRoute();
  const router = useRouter();
  const searchStore = useSearchStore();

  function syncFromRoute() {
    const next: SearchFilters = {
      q: typeof route.query.q === 'string' ? route.query.q : DEFAULT_SEARCH_FILTERS.q,
      tags: parseTags(route.query.tags),
      tagRelation: route.query.tag_rel === 'AND' ? 'AND' : 'OR',
      selectedKeywords: parseTags(route.query.keywords),
      category: typeof route.query.category === 'string' ? route.query.category : undefined,
      sort: isSort(route.query.sort) ? (route.query.sort as SearchSort) : DEFAULT_SEARCH_FILTERS.sort,
      timeRange: isTimeRange(route.query.time)
        ? (route.query.time as SearchTimeRange)
        : DEFAULT_SEARCH_FILTERS.timeRange,
      customTimeFrom: typeof route.query.time_from === 'string' ? route.query.time_from : null,
      customTimeTo: typeof route.query.time_to === 'string' ? route.query.time_to : null,
      includeInvalid: route.query.include_invalid === '1',
    };

    if (next.timeRange !== 'custom') {
      next.customTimeFrom = null;
      next.customTimeTo = null;
    }

    // 避免不必要的更新（如 history.back() 触发的相同 query 解析）
    const current = searchStore.filters;
    const isSame =
      current.q === next.q &&
      current.category === next.category &&
      current.sort === next.sort &&
      current.tagRelation === next.tagRelation &&
      current.timeRange === next.timeRange &&
      current.customTimeFrom === next.customTimeFrom &&
      current.customTimeTo === next.customTimeTo &&
      current.includeInvalid === next.includeInvalid &&
      current.tags.length === next.tags.length &&
      current.tags.every((t, i) => t === next.tags[i]) &&
      current.selectedKeywords.length === next.selectedKeywords.length &&
      current.selectedKeywords.every((k, i) => k === next.selectedKeywords[i]);

    if (!isSame) {
      searchStore.replaceAll(next);
    }
  }

  watch(
    () => route.query,
    () => syncFromRoute(),
    { immediate: true }
  );

  const filters = computed<SearchFilters>(() => searchStore.filters);

  async function applySearch(partial: Partial<SearchFilters> = {}) {
    const merged: SearchFilters = {
      ...DEFAULT_SEARCH_FILTERS,
      ...filters.value,
      ...partial,
    };

    // 非自定义模式时清空日期范围，避免向后端传递过期的时间段
    if (merged.timeRange !== 'custom') {
      merged.customTimeFrom = null;
      merged.customTimeTo = null;
    }
    searchStore.replaceAll(merged);

    try {
      await router.push({
        path: '/search',
        query: toQuery(merged),
      });
    } catch (error) {
      if (!isNavigationFailure(error)) {
        throw error;
      }
    }
  }

  async function clearSearch() {
    searchStore.reset();
    try {
      await router.push({
        path: '/search',
      });
    } catch (error) {
      if (!isNavigationFailure(error)) {
        throw error;
      }
    }
  }

  return {
    filters,
    applySearch,
    clearSearch,
  };
}
