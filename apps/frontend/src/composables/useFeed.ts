import { ref, computed, watch, onMounted, onUnmounted, type Ref, type WatchSource } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import type { Post, PaginatedPosts, PaginationStyle } from '@opz-hub/shared';
import { postFetchers, type PostSourceKey, type PaginationParams } from '@/api/posts';
import { searchPosts } from '@/api/search';
import { usePersistentFiltersStore } from '@/stores/filters';
import { useFeedFiltersStore } from '@/stores/feed-filters';
import { useSearchStore } from '@/stores/search';
import { usePreferencesStore } from '@/stores/preferences';
import { usePagination } from './usePagination';
import { useFeedCache, buildCacheKey } from './useFeedCache';
import { useContentFilter } from './useContentFilter';

// 帖子源类型：涵盖所有后端提供的帖子流接口
export type PostSource = PostSourceKey | 'search';

export type FeedSort =
  | 'weighted-desc'
  | 'weighted-asc'
  | 'created-desc'
  | 'created-asc'
  | 'updated-desc'
  | 'updated-asc'
  | 'likes-desc'
  | 'likes-asc';

export interface UseFeedOptions {
  /** 每页大小，支持响应式 Ref 或静态数值 */
  pageSize?: Ref<number> | number;
  /** 初始排序方式 */
  initialSort?: FeedSort;
  /** 触发刷新的响应式数据源（深度监听） */
  refreshTriggers?: WatchSource<unknown>[];
  /** 刷新防抖时间（毫秒），0 表示不防抖 */
  debounceMs?: number;
  /** 是否在 onMounted 时自动加载，默认 true */
  autoFetchOnMount?: boolean;
  /** 强制分页模式，覆盖全局设置（用于 SearchView 等固定分页的场景） */
  forcePaginationStyle?: PaginationStyle;
}

/**
 * Feed 数据获取 composable
 *
 * 整合分页、缓存、数据源切换、内容过滤、生命周期管理

 */
export function useFeed(sourceRef: Ref<PostSource>, options: UseFeedOptions = {}) {
  const { refreshTriggers = [], debounceMs = 0, autoFetchOnMount = true } = options;

  const posts = ref<Post[]>([]);
  const loading = ref(false);
  const isRefreshing = ref(false);
  const isLoadingMore = ref(false);
  const error = ref<Error | null>(null);
  const nextCursor = ref<string | null>(null);

  // 组件卸载标记，防止异步操作在卸载后更新状态
  let isMounted = true;
  // 刷新版本号，用于处理筛选变化时的竞态条件
  let refreshVersion = 0;

  const initialPageSize = typeof options.pageSize === 'number' ? options.pageSize : (options.pageSize?.value ?? 40);

  const pagination = usePagination({ initialPageSize });
  const cache = useFeedCache({ ttl: 5 * 60 * 1000 });
  const inflightRequests = new Map<string, Promise<PaginatedPosts>>();
  const sort = ref<FeedSort>(options.initialSort ?? 'weighted-desc');

  const filterStore = usePersistentFiltersStore();
  const feedFiltersStore = useFeedFiltersStore();
  const searchStore = useSearchStore();
  const preferencesStore = usePreferencesStore();
  const { filterPosts: applyContentFilters } = useContentFilter();

  // 优先使用强制设置，否则从全局偏好读取
  const isPageMode = computed(() => {
    if (options.forcePaginationStyle) {
      return options.forcePaginationStyle === 'pages';
    }
    return preferencesStore.paginationStyle === 'pages';
  });

  // 时间范围参数提取
  function getTimeParams(timeFrom: string | null | undefined, timeTo: string | null | undefined) {
    return {
      timeFrom: timeFrom || undefined,
      timeTo: timeTo || undefined,
    };
  }

  // 获取 custom 数据源的筛选参数
  function getCustomFilterParams() {
    const hasChannels = filterStore.selectedChannels.length > 0;
    const channelIds = hasChannels ? filterStore.selectedChannels : ['global'];
    const channels = hasChannels ? filterStore.selectedChannels.slice().sort().join(',') : 'global';
    const tags = channelIds.flatMap((id) => filterStore.channelFilters[id]?.activeTags || []).sort();
    const tagRelation = filterStore.channelFilters[channelIds[0]!]?.tagRelation || 'OR';
    const keywords = channelIds.flatMap((id) => filterStore.channelFilters[id]?.activeKeywords || []).sort();
    const keywordRelation = filterStore.channelFilters[channelIds[0]!]?.keywordRelation || 'OR';
    const { timeFrom, timeTo } = getTimeParams(filterStore.customTimeFrom, filterStore.customTimeTo);
    return { channelIds, channels, tags, tagRelation, keywords, keywordRelation, timeFrom, timeTo };
  }

  // 获取 trending/following 数据源的筛选参数
  function getFeedFilterParams(source: PostSource) {
    const isTrending = source.startsWith('trending');
    const channels = isTrending ? feedFiltersStore.trendingChannels : feedFiltersStore.followingChannels;
    const includeInvalid = isTrending
      ? feedFiltersStore.trendingIncludeInvalid
      : feedFiltersStore.followingIncludeInvalid;
    return { channels, includeInvalid };
  }

  /**
   * 生成缓存 key
   */
  function getCacheKey(source: PostSource, offset: number): string {
    if (source === 'search') {
      const {
        q,
        tags,
        tagRelation,
        selectedKeywords,
        category,
        sort: searchSort,
        timeRange,
        customTimeFrom,
        customTimeTo,
        includeInvalid,
      } = searchStore.filters;
      const { timeFrom, timeTo } = getTimeParams(customTimeFrom, customTimeTo);
      return buildCacheKey([
        'search',
        q,
        tags.join(','),
        tagRelation,
        selectedKeywords.join(','),
        category,
        searchSort,
        timeRange,
        timeFrom,
        timeTo,
        offset,
        pagination.pageSize.value,
        includeInvalid ? 'invalid' : null,
      ]);
    }

    if (source === 'custom') {
      const { channels, tags, tagRelation, keywords, keywordRelation, timeFrom, timeTo } = getCustomFilterParams();
      return buildCacheKey([
        'custom',
        offset,
        channels,
        tags.join(','),
        tagRelation,
        keywords.join(','),
        keywordRelation,
        sort.value,
        filterStore.timeRange,
        timeFrom,
        timeTo,
        pagination.pageSize.value,
        filterStore.includeInvalid ? 'invalid' : null,
      ]);
    }

    // trending 和 following 数据源需要包含筛选参数
    if (source.startsWith('trending') || source.startsWith('following')) {
      const { channels, includeInvalid } = getFeedFilterParams(source);
      return buildCacheKey([
        source,
        offset,
        sort.value,
        pagination.pageSize.value,
        channels.slice().sort().join(','),
        includeInvalid ? 'invalid' : null,
      ]);
    }

    return buildCacheKey([source, offset, sort.value, pagination.pageSize.value]);
  }

  function invalidateInflight(keyPrefix?: string) {
    if (!keyPrefix) {
      inflightRequests.clear();
      return;
    }
    for (const key of inflightRequests.keys()) {
      if (key.startsWith(keyPrefix)) {
        inflightRequests.delete(key);
      }
    }
  }

  /**
   * 获取帖子数据
   *
   * 数据源与 Store 对应关系：
   * - "search": 使用 searchStore（临时筛选，与 URL 同步）
   * - "custom": 使用 filterStore（持久化筛选，localStorage）
   * - 其他 (trending/latest 等): 直接调用 postFetchers，不依赖筛选 store
   */
  async function fetchBySource(source: PostSource, offset: number, cursor?: string | null): Promise<PaginatedPosts> {
    const cacheKey = getCacheKey(source, offset);
    const cached = cache.get(cacheKey);
    if (cached) {
      return { posts: cached.posts, total: cached.total, nextCursor: cached.nextCursor };
    }

    const existingRequest = inflightRequests.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    const params: PaginationParams = {
      limit: pagination.pageSize.value,
      offset,
      cursor: cursor ?? undefined,
      sort: sort.value,
    };

    const request = (async () => {
      let result: PaginatedPosts;

      if (source === 'search') {
        // 搜索数据源：从 searchStore 读取筛选条件（与 URL query 同步）
        const { timeFrom, timeTo } = getTimeParams(
          searchStore.filters.customTimeFrom,
          searchStore.filters.customTimeTo
        );
        // 热词合并到搜索关键词（用引号包裹强制精确匹配）
        const userQuery = searchStore.filters.q.trim();
        const quotedKeywords = searchStore.filters.selectedKeywords.map((k) => `"${k}"`);
        const combinedQuery = [userQuery, ...quotedKeywords].filter(Boolean).join(' ');
        result = await searchPosts({
          q: combinedQuery,
          tags: searchStore.filters.tags,
          tagRelation: searchStore.filters.tagRelation,
          category: searchStore.filters.category,
          sort: searchStore.filters.sort,
          timeRange: searchStore.filters.timeRange,
          timeFrom,
          timeTo,
          limit: pagination.pageSize.value,
          offset,
          includeInvalid: searchStore.filters.includeInvalid,
        });
      } else if (source === 'custom') {
        // 自定义数据源：从 filterStore 读取持久化筛选条件（localStorage）
        const { tags, tagRelation, keywords, keywordRelation, timeFrom, timeTo } = getCustomFilterParams();
        result = await postFetchers.custom({
          ...params,
          channels: filterStore.selectedChannels,
          tags,
          tagRelation,
          keywords,
          keywordRelation,
          timeRange: filterStore.timeRange,
          timeFrom,
          timeTo,
          includeInvalid: filterStore.includeInvalid,
        });
      } else if (source.startsWith('trending') || source.startsWith('following')) {
        // trending/following 数据源：从 feedFiltersStore 读取筛选条件
        const { channels, includeInvalid } = getFeedFilterParams(source);
        const fetcher = postFetchers[source];
        result = await fetcher({
          ...params,
          channels: channels.length > 0 ? channels : undefined,
          includeInvalid,
        });
      } else {
        // 其他数据源：直接调用对应的 fetcher
        const fetcher = postFetchers[source];
        result = await fetcher(params);
      }

      cache.set(cacheKey, result.posts, result.total, result.nextCursor);
      return result;
    })();

    inflightRequests.set(cacheKey, request);

    try {
      return await request;
    } finally {
      if (inflightRequests.get(cacheKey) === request) {
        inflightRequests.delete(cacheKey);
      }
    }
  }

  // 检查请求是否已过期（组件卸载或有新的 refresh）
  const isStale = (version: number) => !isMounted || version !== refreshVersion;

  /**
   * 初始加载
   */
  async function fetch() {
    const version = refreshVersion;
    loading.value = true;
    isRefreshing.value = true;
    isLoadingMore.value = false;
    error.value = null;

    try {
      const result = await fetchBySource(sourceRef.value, 0, null);
      if (isStale(version)) return;
      const filteredPosts = applyContentFilters(result.posts);
      posts.value = filteredPosts;
      nextCursor.value = result.nextCursor ?? null;
      pagination.updateAfterFetch(result.posts.length, result.total, nextCursor.value);
    } catch (err) {
      if (isStale(version)) return;
      error.value = err instanceof Error ? err : new Error('加载帖子失败');
      console.error('[useFeed] fetch error:', err);
    } finally {
      if (!isStale(version)) {
        loading.value = false;
        isRefreshing.value = false;
      }
    }
  }

  /**
   * 加载更多（无限滚动）
   */
  let lastLoadMoreTime = 0;
  const LOAD_MORE_THROTTLE_MS = 1000;

  async function loadMore() {
    if (loading.value || !pagination.hasMore.value) return;

    const now = Date.now();
    if (now - lastLoadMoreTime < LOAD_MORE_THROTTLE_MS) return;

    const version = refreshVersion;
    loading.value = true;
    isLoadingMore.value = true;

    try {
      const result = await fetchBySource(sourceRef.value, pagination.offset.value, nextCursor.value);
      if (isStale(version)) return;
      const filteredPosts = applyContentFilters(result.posts);
      posts.value.push(...filteredPosts);
      nextCursor.value = result.nextCursor ?? null;
      pagination.updateAfterLoadMore(result.posts.length, result.total, nextCursor.value);
    } catch (err) {
      if (isStale(version)) return;
      error.value = err instanceof Error ? err : new Error('加载更多失败');
      console.error('[useFeed] loadMore error:', err);
    } finally {
      if (!isStale(version)) {
        loading.value = false;
        isLoadingMore.value = false;
        lastLoadMoreTime = Date.now();
      }
    }
  }

  /**
   * 跳转到指定页
   */
  async function setPage(page: number) {
    if (loading.value) return;

    const targetPage = Math.max(1, page);
    const targetOffset = pagination.getOffsetForPage(targetPage);
    const version = refreshVersion;

    loading.value = true;
    isRefreshing.value = true;
    error.value = null;

    try {
      const result = await fetchBySource(sourceRef.value, targetOffset, null);
      if (isStale(version)) return;
      const filteredPosts = applyContentFilters(result.posts);
      posts.value = filteredPosts;
      nextCursor.value = result.nextCursor ?? null;
      pagination.updateAfterSetPage(targetPage, result.posts.length, result.total, nextCursor.value);
    } catch (err) {
      if (isStale(version)) return;
      error.value = err instanceof Error ? err : new Error('加载帖子失败');
      console.error('[useFeed] setPage error:', err);
    } finally {
      if (!isStale(version)) {
        loading.value = false;
        isRefreshing.value = false;
      }
    }
  }

  /**
   * 重置状态
   */
  function reset() {
    error.value = null;
    nextCursor.value = null;
    pagination.reset();
  }

  /**
   * 刷新数据（清除缓存、重置并重新加载）
   */
  async function refresh() {
    ++refreshVersion; // 使正在进行的请求过期
    invalidateInflight(sourceRef.value);
    cache.invalidate(sourceRef.value);
    // 保留现有 posts 避免切换 segment 时滚动位置闪烁回顶部，仅重置分页相关状态
    if (!loading.value) {
      reset();
    }
    await fetch();
  }

  /**
   * 设置排序并刷新
   */
  function setSort(newSort: FeedSort) {
    sort.value = newSort;
  }

  /**
   * 设置排序并立即刷新
   */
  async function changeSort(newSort: FeedSort) {
    setSort(newSort);
    await refresh();
  }

  /**
   * 设置每页大小
   */
  function setPageSize(size: number) {
    pagination.setPageSize(size);
  }

  // ========== 生命周期与自动化 ==========

  // 创建防抖后的刷新函数
  const debouncedRefresh = debounceMs > 0 ? useDebounceFn(refresh, debounceMs) : null;

  // 监听数据源变化
  watch(
    sourceRef,
    () => {
      void refresh();
    },
    { immediate: false }
  );

  // 监听外部触发器
  if (refreshTriggers.length > 0) {
    watch(
      refreshTriggers,
      () => {
        if (debouncedRefresh) {
          debouncedRefresh();
          return;
        }
        void refresh();
      },
      { deep: true }
    );
  }

  // 监听 pageSize 变化（如果传入的是 Ref）
  if (options.pageSize && typeof options.pageSize !== 'number') {
    watch(
      options.pageSize,
      (size) => {
        setPageSize(size);
        void setPage(1);
      },
      { flush: 'post' }
    );
  }

  // 挂载时自动加载
  onMounted(() => {
    if (!autoFetchOnMount) return;
    void refresh();
  });

  // 卸载时标记（isMounted 检查会阻止任何后续状态更新）
  onUnmounted(() => {
    isMounted = false;
  });

  return {
    // 状态
    posts,
    loading,
    isRefreshing,
    isLoadingMore,
    error,
    hasMore: pagination.hasMore,
    total: pagination.total,
    pageSize: pagination.pageSize,
    currentPage: pagination.currentPage,
    sort,
    isPageMode,
    // 方法
    fetch,
    loadMore,
    setPage,
    reset,
    refresh,
    setSort,
    changeSort,
    setPageSize,
    invalidateCache: cache.invalidate,
  };
}
