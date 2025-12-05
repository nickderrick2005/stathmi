import { ref, type Ref } from 'vue';

export interface UsePaginationOptions {
  initialPageSize?: number;
}

export interface PaginationState {
  currentPage: Ref<number>;
  pageSize: Ref<number>;
  total: Ref<number>;
  hasMore: Ref<boolean>;
  offset: Ref<number>;
}

/**
 * 管理分页相关的响应式状态：当前页、每页大小、总数、是否有更多、偏移量
 */
export function usePagination(options: UsePaginationOptions = {}) {
  const currentPage = ref(1);
  const pageSize = ref(Math.max(1, options.initialPageSize ?? 40));
  const total = ref(0);
  const hasMore = ref(true);
  const offset = ref(0);

  function reset() {
    currentPage.value = 1;
    total.value = 0;
    hasMore.value = true;
    offset.value = 0;
  }

  function setPageSize(size: number) {
    const nextSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : pageSize.value;
    pageSize.value = nextSize;
    offset.value = 0;
  }

  /**
   * 更新分页状态（fetch 后调用）
   */
  function updateAfterFetch(resultLength: number, resultTotal: number, nextCursor?: string | null) {
    offset.value = resultLength;
    total.value = resultTotal;
    currentPage.value = 1;
    hasMore.value = Boolean(nextCursor) || (resultLength > 0 && offset.value < resultTotal);
  }

  /**
   * 更新分页状态（loadMore 后调用）
   */
  function updateAfterLoadMore(resultLength: number, resultTotal: number, nextCursor?: string | null) {
    offset.value += resultLength;
    total.value = resultTotal;
    hasMore.value = Boolean(nextCursor) || (resultLength > 0 && offset.value < resultTotal);
    currentPage.value = Math.min(
      Math.ceil(offset.value / pageSize.value),
      Math.ceil(total.value / pageSize.value) || 1
    );
  }

  /**
   * 更新分页状态（setPage 后调用）
   */
  function updateAfterSetPage(page: number, resultLength: number, resultTotal: number, nextCursor?: string | null) {
    const targetOffset = (page - 1) * pageSize.value;
    offset.value = targetOffset + resultLength;
    total.value = resultTotal;
    currentPage.value = page;
    hasMore.value = Boolean(nextCursor) || (resultLength > 0 && offset.value < resultTotal);
  }

  function getOffsetForPage(page: number) {
    return (Math.max(1, page) - 1) * pageSize.value;
  }

  return {
    currentPage,
    pageSize,
    total,
    hasMore,
    offset,
    reset,
    setPageSize,
    updateAfterFetch,
    updateAfterLoadMore,
    updateAfterSetPage,
    getOffsetForPage,
  };
}
