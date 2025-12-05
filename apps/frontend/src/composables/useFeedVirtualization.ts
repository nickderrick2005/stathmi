import { computed, watch, type ComputedRef, type Ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useWindowVirtualizer } from '@tanstack/vue-virtual';
import type { DisplayMode, Post } from '@opz-hub/shared';

const GRID_CONFIG = {
  itemMinWidth: 260,
  aspectRatio: 0.62,
  gap: 20,
  mobileGap: 6,
  mobileBreakpoint: 768,
  mobileColumns: 2,
  maxColumns: 6,
  maxGridWidth: 1800,
  overscan: 4,
  minPostsForVirtual: 20,
  maxRenderCards: 100,
};

const LIST_CONFIG = {
  estimatedRowHeight: 170,
  mobileRowHeight: 110,
  gap: 12,
  mobileGap: 8,
  wideBreakpoint: 1200,
  overscan: 6,
  minPostsForVirtual: 15,
};

export interface UseFeedVirtualizationOptions {
  containerRef: Ref<HTMLElement | null>;
  posts: ComputedRef<Post[]>;
  displayMode: ComputedRef<DisplayMode>;
  /** 分页模式下禁用虚拟滚动 */
  shouldUsePagination: ComputedRef<boolean>;
  /** 显式关闭虚拟滚动 */
  enableVirtualScroll?: ComputedRef<boolean>;
}

function groupPostsByRow(posts: Post[], cols: number): Post[][] {
  const rows: Post[][] = [];
  for (let i = 0; i < posts.length; i += cols) {
    rows.push(posts.slice(i, i + cols));
  }
  return rows;
}

export function useFeedVirtualization(options: UseFeedVirtualizationOptions) {
  const { containerRef, posts, displayMode, shouldUsePagination, enableVirtualScroll } = options;

  const { width: containerWidth } = useElementSize(containerRef);
  const effectiveWidth = computed(() => {
    if (containerWidth.value > 0) return containerWidth.value;
    return typeof window !== 'undefined' ? window.innerWidth : 1024;
  });

  const isMobile = computed(() => effectiveWidth.value <= GRID_CONFIG.mobileBreakpoint);
  const enableVirtual = computed(() => enableVirtualScroll?.value !== false);

  // ----- Grid 模式 -----
  const gap = computed(() => (isMobile.value ? GRID_CONFIG.mobileGap : GRID_CONFIG.gap));

  const columnsPerRow = computed(() => {
    if (isMobile.value) return GRID_CONFIG.mobileColumns;
    const maxPossible = Math.floor((effectiveWidth.value + gap.value) / (GRID_CONFIG.itemMinWidth + gap.value));
    return Math.min(Math.max(1, maxPossible), GRID_CONFIG.maxColumns);
  });

  const cardWidth = computed(() => {
    const cols = columnsPerRow.value;
    return (effectiveWidth.value - (cols - 1) * gap.value) / cols;
  });

  const cardHeight = computed(() => cardWidth.value / GRID_CONFIG.aspectRatio);
  const rowHeight = computed(() => cardHeight.value + gap.value);

  const gridStyle = computed(() => ({
    gridTemplateColumns: `repeat(${columnsPerRow.value}, 1fr)`,
    gap: `${gap.value}px`,
  }));

  const containerStyle = computed(() => {
    if (isMobile.value) return {};
    return {
      maxWidth: `${GRID_CONFIG.maxGridWidth}px`,
      margin: '0 auto',
    };
  });

  // 按行分组（带缓存避免重复创建）
  const rowItemsCache = new Map<number, Post[]>();
  let lastRowsCols = 0;
  let lastRowsLength = 0;

  function groupPostsByRowCached(data: Post[], cols: number): Post[][] {
    if (cols !== lastRowsCols) {
      rowItemsCache.clear();
      lastRowsCols = cols;
      lastRowsLength = 0;
    }

    const rows: Post[][] = [];
    const totalRows = Math.ceil(data.length / cols);

    for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
      const startIdx = rowIdx * cols;
      const cached = rowItemsCache.get(rowIdx);
      const currentRow = data.slice(startIdx, startIdx + cols);

      if (cached && cached.length === currentRow.length && cached.every((p, i) => p.id === currentRow[i]?.id)) {
        rows.push(cached);
      } else {
        rowItemsCache.set(rowIdx, currentRow);
        rows.push(currentRow);
      }
    }

    if (totalRows < lastRowsLength) {
      for (let i = totalRows; i < lastRowsLength; i++) {
        rowItemsCache.delete(i);
      }
    }
    lastRowsLength = totalRows;

    return rows;
  }

  const rowItems = computed(() => {
    if (!shouldUseGridVirtualScroll.value) return [];
    return groupPostsByRowCached(posts.value, columnsPerRow.value);
  });

  const shouldUseGridVirtualScroll = computed(() => {
    return (
      enableVirtual.value &&
      !shouldUsePagination.value &&
      displayMode.value === 'large' &&
      posts.value.length >= GRID_CONFIG.minPostsForVirtual
    );
  });

  const limitedPosts = computed(() => {
    if (shouldUseGridVirtualScroll.value) return posts.value;
    return posts.value.slice(0, GRID_CONFIG.maxRenderCards);
  });

  const gridVirtualizer = useWindowVirtualizer(
    computed(() => ({
      count: rowItems.value.length,
      estimateSize: () => rowHeight.value,
      overscan: GRID_CONFIG.overscan,
    }))
  );

  const virtualRows = computed(() => gridVirtualizer.value.getVirtualItems());
  const totalVirtualHeight = computed(() => gridVirtualizer.value.getTotalSize());

  // ----- List 模式 -----
  const listColumnsPerRow = computed(() => {
    return effectiveWidth.value >= LIST_CONFIG.wideBreakpoint ? 2 : 1;
  });

  const listGap = computed(() => (isMobile.value ? LIST_CONFIG.mobileGap : LIST_CONFIG.gap));
  const listRowHeight = computed(
    () => (isMobile.value ? LIST_CONFIG.mobileRowHeight : LIST_CONFIG.estimatedRowHeight) + listGap.value
  );

  const listRowItems = computed(() => {
    if (!shouldUseListVirtualScroll.value) return [];
    return groupPostsByRow(posts.value, listColumnsPerRow.value);
  });

  const shouldUseListVirtualScroll = computed(() => {
    return (
      enableVirtual.value &&
      !shouldUsePagination.value &&
      displayMode.value === 'list' &&
      posts.value.length >= LIST_CONFIG.minPostsForVirtual
    );
  });

  const listVirtualizer = useWindowVirtualizer(
    computed(() => ({
      count: listRowItems.value.length,
      estimateSize: () => listRowHeight.value,
      overscan: LIST_CONFIG.overscan,
    }))
  );

  const listVirtualRows = computed(() => listVirtualizer.value.getVirtualItems());
  const totalListVirtualHeight = computed(() => listVirtualizer.value.getTotalSize());

  // 布局参数变化时重新测量虚拟化器
  watch(
    [columnsPerRow, rowHeight, listColumnsPerRow, listRowHeight],
    () => {
      gridVirtualizer.value?.measure();
      listVirtualizer.value?.measure();
    },
    { flush: 'post' }
  );

  return {
    isMobile,
    grid: {
      gap,
      columnsPerRow,
      cardWidth,
      cardHeight,
      rowHeight,
      gridStyle,
      containerStyle,
      rowItems,
      limitedPosts,
      shouldUseVirtualScroll: shouldUseGridVirtualScroll,
      virtualRows,
      totalVirtualHeight,
    },
    list: {
      gap: listGap,
      rowHeight: listRowHeight,
      columnsPerRow: listColumnsPerRow,
      rowItems: listRowItems,
      shouldUseVirtualScroll: shouldUseListVirtualScroll,
      virtualRows: listVirtualRows,
      totalVirtualHeight: totalListVirtualHeight,
    },
  };
}
