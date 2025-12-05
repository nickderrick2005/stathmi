import { watch, type ComputedRef, type Ref } from 'vue';
import type { PaginationStyle } from '@opz-hub/shared';
import { useFeed, type PostSource, type UseFeedOptions } from './useFeed';
import { useScrollRestore } from './useScrollRestore';

export interface UseFeedPageOptions extends Omit<UseFeedOptions, 'pageSize' | 'forcePaginationStyle'> {
  /** 帖子数据源 */
  source: Ref<PostSource>;
  /** 滚动恢复 key，区分不同页面 */
  scrollKey: string;
  /** 细分滚动恢复（例如 trending segment） */
  scrollSegment?: ComputedRef<string> | Ref<string>;
  /** 透传给 useFeed 的 pageSize，可选响应式 */
  pageSize?: Ref<number> | number;
  /** 强制分页模式（覆盖偏好设置） */
  forcePaginationStyle?: PaginationStyle;
  /** 外部维护的页大小 ref，用于 search 等场景触发 useFeed 内部 watcher */
  pageSizeState?: Ref<number>;
}

/**
 * 统一的 Feed 页面组合式：
 * - 包装 useFeed，输出分页/排序等状态
 * - 内置滚动恢复与页面跳转滚动到顶部
 * - 统一的翻页/页大小处理，避免各视图重复样板
 */
export function useFeedPage(options: UseFeedPageOptions) {
  const {
    source,
    scrollKey,
    scrollSegment,
    pageSizeState,
    refreshTriggers,
    debounceMs,
    autoFetchOnMount,
    initialSort,
    forcePaginationStyle,
    pageSize,
  } = options;

  const { restoreNow, hasPendingRestore } = useScrollRestore(scrollKey, scrollSegment);

  const feed = useFeed(source, {
    refreshTriggers,
    debounceMs,
    autoFetchOnMount,
    initialSort,
    forcePaginationStyle,
    pageSize,
  });

  // 数据加载完成后统一恢复滚动
  watch(feed.loading, (isLoading, wasLoading) => {
    if (wasLoading && !isLoading && hasPendingRestore.value) {
      restoreNow();
    }
  });

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  async function handlePageChange(page: number) {
    await feed.setPage(page);
    scrollToTop();
  }

  async function handlePageSizeChange(size: number) {
    // search 等场景需要先写入外部 pageSize ref，触发 useFeed 内部 watch
    if (pageSizeState) {
      pageSizeState.value = size;
      scrollToTop();
      return;
    }
    feed.setPageSize(size);
    await feed.refresh();
    scrollToTop();
  }

  return {
    ...feed,
    restoreNow,
    hasPendingRestore,
    handlePageChange,
    handlePageSizeChange,
  };
}
