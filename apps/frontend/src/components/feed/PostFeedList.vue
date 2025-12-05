<script setup lang="ts">
import { computed, ref, watch, withDefaults, onUnmounted, toRef } from 'vue';
import { useInfiniteScroll, useIntersectionObserver } from '@vueuse/core';
import type { Post, DisplayMode } from '@opz-hub/shared';
import PostCardLarge from '@/components/post/variants/PostCardLarge.vue';
import PostCardList from '@/components/post/variants/PostCardList.vue';
import PostTableMinimal from '@/components/post/variants/PostTableMinimal.vue';
import PostExpandedOverlay from '@/components/post/PostExpandedOverlay.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';
import LoadingPlaceholder from '@/components/common/LoadingPlaceholder.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import PaginationControl from '@/components/common/PaginationControl.vue';
import BlockedCardPlaceholder from '@/components/common/BlockedCardPlaceholder.vue';
import { useFavorites } from '@/composables/useFavorites';
import { useFavoritesStore } from '@/stores/favorites';
import { useBlocksStore } from '@/stores/blocks';
import { useFeedDisplayMode } from '@/composables/useFeedDisplayMode';
import { useRouter } from 'vue-router';
import { notifySuccess, notifyError, notifyInfo } from '@/utils/notifications';
import { usePullRefresh } from '@/composables/usePullRefresh';
import { useFeedVirtualization } from '@/composables/useFeedVirtualization';

const props = withDefaults(
  defineProps<{
    posts: Post[];
    loading?: boolean;
    error?: Error | null;
    hasMore?: boolean;
    onLoadMore?: () => void | Promise<void>;
    onRetry?: () => void | Promise<void>;
    onRefresh?: () => Promise<void>;
    infiniteDistance?: number;
    isPageMode?: boolean;
    total?: number;
    pageSize?: number;
    currentPage?: number;
    onPageChange?: (page: number) => void | Promise<void>;
    showPaginationControls?: boolean;
    enableVirtualScroll?: boolean;
    refreshing?: boolean;
    // 新内容标记相关
    showNewIndicator?: boolean;
    viewedAt?: string | null;
    // 显示模式
    feedKey?: string;
    // 默认显示模式（优先于全局设置）
    defaultDisplayMode?: DisplayMode;
    // 是否隐藏频道列（极简模式）
    hideChannel?: boolean;
  }>(),
  {
    showPaginationControls: true,
    refreshing: false,
  }
);

// 响应式 feedKey（使用 toRef 确保 props 变化时能响应）
const feedKeyRef = toRef(props, 'feedKey');
const { displayMode } = useFeedDisplayMode(
  computed(() => feedKeyRef.value ?? 'default'),
  props.defaultDisplayMode
);

// 骨架屏 variant 映射（根据当前 feed 的 displayMode）
const skeletonVariant = computed(() => {
  switch (displayMode.value) {
    case 'large':
      return 'grid';
    case 'list':
      return 'list';
    case 'minimal':
      return 'table';
    default:
      return 'grid';
  }
});

const showRefreshingBanner = computed(() => props.refreshing && props.posts.length > 0);

const emit = defineEmits<{
  (e: 'new-content-passed', lastNewPostIndex: number): void;
}>();

// 下拉刷新
const { isRefreshing, pullDistance, threshold } = usePullRefresh(async () => {
  if (props.onRefresh) {
    await props.onRefresh();
  }
});

// 新内容判断
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function isNewPost(post: Post): boolean {
  if (!props.showNewIndicator) return false;
  // viewedAt 为 null 时（首次用户），使用 3 天前作为基准
  const viewedTime = props.viewedAt ? new Date(props.viewedAt).getTime() : Date.now() - THREE_DAYS_MS;
  const createdTime = new Date(post.createdAt).getTime();
  const updatedTime = post.updatedAt ? new Date(post.updatedAt).getTime() : 0;
  return createdTime > viewedTime || updatedTime > viewedTime;
}

// 新帖 ID 缓存（只需计算一次，帖子的 isNew 状态不会变化）
const newPostIds = ref(new Set<string>());

// 更新新帖缓存
function updateNewPostIds(posts: Post[]) {
  let hasNew = false;
  const currentSet = newPostIds.value;
  for (const post of posts) {
    if (!currentSet.has(post.id) && isNewPost(post)) {
      currentSet.add(post.id);
      hasNew = true;
    }
  }
  // 只有实际添加了新项才触发更新
  if (hasNew) {
    newPostIds.value = new Set(currentSet);
  }
}

// 分割线信息缓存
const cachedSeparatorInfo = ref({ threeDayIndex: -1, lastNewIndex: -1, position: -1 });
const separatorCalculated = ref(false);

// 计算分割线位置
function calculateSeparatorInfo() {
  if (!props.showNewIndicator) {
    cachedSeparatorInfo.value = { threeDayIndex: -1, lastNewIndex: -1, position: -1 };
    return;
  }

  const now = Date.now();
  const threshold = now - THREE_DAYS_MS;
  const hasViewedAt = !!props.viewedAt;
  const result = { threeDayIndex: -1, lastNewIndex: -1, position: -1 };

  for (let i = 0; i < props.posts.length; i++) {
    const post = props.posts[i]!;

    // 计算 3 天分割线位置
    if (result.threeDayIndex < 0 && new Date(post.createdAt).getTime() < threshold) {
      result.threeDayIndex = i;
    }

    // 计算最后一个新帖索引
    if (hasViewedAt && newPostIds.value.has(post.id)) {
      result.lastNewIndex = i;
    }
  }

  // 计算分割线位置
  if (result.threeDayIndex > 0) {
    result.position = result.threeDayIndex;
  } else if (result.lastNewIndex >= 0 && result.lastNewIndex < props.posts.length - 1) {
    result.position = result.lastNewIndex + 1;
  }

  cachedSeparatorInfo.value = result;
  separatorCalculated.value = true;
}

// 监听 posts 变化，更新新帖缓存并在首次计算分割线
watch(
  () => props.posts,
  (posts) => {
    if (posts.length > 0) {
      updateNewPostIds(posts);
      // 仅首次或 viewedAt 变化时计算分割线
      if (!separatorCalculated.value) {
        calculateSeparatorInfo();
      }
    }
  },
  { immediate: true }
);

// viewedAt 变化时重新计算
watch(
  () => props.viewedAt,
  () => {
    separatorCalculated.value = false;
    newPostIds.value.clear();
    if (props.posts.length > 0) {
      updateNewPostIds(props.posts);
      calculateSeparatorInfo();
    }
  }
);

// 分页模式：由父组件通过 isPageMode prop 控制
// shouldUsePagination: 控制是否禁用无限滚动
// shouldRenderTopPagination: 顶部分页条，受 showPaginationControls 控制
// shouldRenderBottomPagination: 底部分页条，只要分页模式就显示
const shouldUsePagination = computed(() => !!props.isPageMode);
const hasPagination = computed(() => {
  if (!props.isPageMode) return false;
  const total = props.total ?? 0;
  const pageSize = props.pageSize ?? 40;
  return total > pageSize;
});
const shouldRenderTopPagination = computed(() => hasPagination.value && props.showPaginationControls);
const shouldRenderBottomPagination = computed(() => hasPagination.value);

const containerRef = ref<HTMLElement | null>(null);
const { isMobile, grid, list } = useFeedVirtualization({
  containerRef,
  posts: computed(() => props.posts),
  displayMode,
  shouldUsePagination,
  enableVirtualScroll: computed(() => props.enableVirtualScroll !== false),
});

const containerStyle = grid.containerStyle;
const gridStyle = grid.gridStyle;
const columnsPerRow = grid.columnsPerRow;
const cardWidth = grid.cardWidth;
const cardHeight = grid.cardHeight;
const gap = grid.gap;
const rowItems = grid.rowItems;
const limitedPosts = grid.limitedPosts;
const shouldUseVirtualScroll = grid.shouldUseVirtualScroll;
const virtualRows = grid.virtualRows;
const totalVirtualHeight = grid.totalVirtualHeight;

const listGap = list.gap;
const listRowHeight = list.rowHeight;
const listRowItems = list.rowItems;
const shouldUseListVirtualScroll = list.shouldUseVirtualScroll;
const listVirtualRows = list.virtualRows;
const totalListVirtualHeight = list.totalVirtualHeight;

// 为模板提供便捷访问
const separatorPosition = computed(() => cachedSeparatorInfo.value.position);
const lastNewPostIndex = computed(() => cachedSeparatorInfo.value.lastNewIndex);

// 分割线所在的行索引（虚拟滚动用）
const separatorRowIndex = computed(() => {
  if (separatorPosition.value < 0 || columnsPerRow.value <= 0) return -1;
  return Math.floor(separatorPosition.value / columnsPerRow.value);
});

// 分割线元素引用
const separatorRef = ref<HTMLElement | null>(null);
const hasEmittedNewContentPassed = ref(false);

// 监听分割线可见性
useIntersectionObserver(
  separatorRef,
  (entries) => {
    const entry = entries[0];
    if (entry?.isIntersecting && !hasEmittedNewContentPassed.value && lastNewPostIndex.value >= 0) {
      hasEmittedNewContentPassed.value = true;
      emit('new-content-passed', lastNewPostIndex.value);
    }
  },
  { threshold: 0.5 }
);

// 当 posts 或 viewedAt 变化时重置标记
watch(
  () => [props.posts.length, props.viewedAt],
  () => {
    hasEmittedNewContentPassed.value = false;
  }
);

const router = useRouter();
const favoritesStore = useFavoritesStore();
const blocksStore = useBlocksStore();
const { toggleFavorite } = useFavorites();

// 正在隐藏的帖子 ID（用于动画）
const hidingPostIds = ref<Set<string>>(new Set());

// 待清理的定时器（组件卸载时清除）
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

onUnmounted(() => {
  pendingTimers.forEach((timer) => clearTimeout(timer));
  pendingTimers.clear();
});

// 虚拟滚动模式下监听可见行范围，触发 new-content-passed 事件
watch(
  () => virtualRows.value,
  (rows) => {
    if (!shouldUseVirtualScroll.value || hasEmittedNewContentPassed.value) return;
    if (separatorRowIndex.value < 0 || lastNewPostIndex.value < 0) return;

    // 检查分割线所在行是否在可见范围内
    const isVisible = rows.some((row) => row.index === separatorRowIndex.value);
    if (isVisible) {
      hasEmittedNewContentPassed.value = true;
      emit('new-content-passed', lastNewPostIndex.value);
    }
  }
);

// 无限滚动加载
useInfiniteScroll(
  () => (typeof document !== 'undefined' ? document : null),
  async () => {
    if (!props.onLoadMore || shouldUsePagination.value) return;
    if (props.loading) return;
    if (props.hasMore === false) return;
    await props.onLoadMore();
  },
  {
    distance: props.infiniteDistance ?? 220,
    canLoadMore: () => !props.loading && props.hasMore !== false && !shouldUsePagination.value,
  }
);

function handleFavorite(postId: string) {
  toggleFavorite(postId);
}

function handleShare(_postId: string) {
  notifyInfo('分享功能正在开发中，敬请期待');
}

function handleBlockPost(postId: string) {
  // 先播放隐藏动画
  hidingPostIds.value.add(postId);

  // 等待动画完成后执行屏蔽
  const timer = setTimeout(async () => {
    pendingTimers.delete(timer);
    try {
      await blocksStore.blockPost(postId);
      notifySuccess('已屏蔽此帖');
    } catch {
      notifyError('屏蔽失败，请重试');
      hidingPostIds.value.delete(postId);
    }
  }, 300);
  pendingTimers.add(timer);
}

function handleBlockPostAndAuthor(post: Post) {
  // 先播放隐藏动画
  hidingPostIds.value.add(post.id);

  const timer = setTimeout(async () => {
    pendingTimers.delete(timer);
    try {
      await Promise.all([blocksStore.blockPost(post.id), blocksStore.blockAuthor(post.authorId)]);
      notifySuccess('已屏蔽帖子和作者');
    } catch {
      notifyError('屏蔽失败，请重试');
      hidingPostIds.value.delete(post.id);
    }
  }, 300);
  pendingTimers.add(timer);
}

function handleRefresh() {
  props.onRefresh?.();
}

function handleViewAuthor(post: Post) {
  router.push(`/user/${post.authorId}`);
}

function handleFindSimilar(post: Post) {
  const tags = post.tags.slice(0, 3).join(',');
  router.push(`/search?tags=${encodeURIComponent(tags)}`);
}

async function handlePageChange(page: number) {
  if (!props.onPageChange) return;
  await props.onPageChange(page);
}
</script>

<template>
  <div class="post-feed-list" ref="containerRef">
    <!-- 下拉刷新指示器 -->
    <div
      v-if="pullDistance > 0 || isRefreshing"
      class="pull-refresh-indicator"
      :style="{ height: `${Math.max(pullDistance, isRefreshing ? threshold : 0)}px` }"
    >
      <div class="pull-refresh-content" :class="{ refreshing: isRefreshing }">
        <svg
          class="pull-icon"
          :class="{ 'can-refresh': pullDistance >= threshold }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 20V4M5 11l7-7 7 7" />
        </svg>
        <span class="pull-text">
          {{ isRefreshing ? '刷新中...' : pullDistance >= threshold ? '松开刷新' : '下拉刷新' }}
        </span>
      </div>
    </div>

    <div v-if="props.error">
      <ErrorMessage :message="props.error.message" :retry="props.onRetry" />
    </div>

    <template v-else>
      <div v-if="showRefreshingBanner" class="refresh-banner">
        <LoadingSpinner />
      </div>

      <PaginationControl
        v-if="shouldRenderTopPagination"
        class="pagination-block"
        compact
        :current="props.currentPage || 1"
        :total="props.total || 0"
        :page-size="props.pageSize || 1"
        :show-summary="false"
        @page-change="handlePageChange"
      />

      <!-- 极简模式：表格布局 -->
      <template v-if="props.posts.length > 0 && displayMode === 'minimal'">
        <PostTableMinimal
          :posts="props.posts"
          :hide-channel="props.hideChannel"
          :hiding-post-ids="hidingPostIds"
          @toggle-favorite="handleFavorite"
          @share="handleShare"
          @block-post="handleBlockPost"
          @block-post-and-author="handleBlockPostAndAuthor"
          @view-author="handleViewAuthor"
          @find-similar="handleFindSimilar"
          @refresh="handleRefresh"
        />
        <div v-if="props.loading && props.hasMore !== false && !shouldUsePagination" class="load-more-indicator">
          <LoadingPlaceholder inline variant="text" :count="3" />
        </div>
        <div v-if="props.onLoadMore && props.hasMore === false && !shouldUsePagination" class="load-more-indicator">
          <span class="no-more">已经到底了</span>
        </div>
      </template>

      <!-- 列表模式：虚拟滚动 -->
      <template v-else-if="props.posts.length > 0 && displayMode === 'list' && shouldUseListVirtualScroll">
        <div class="post-list-container" :style="containerStyle">
          <div class="post-list-virtual" :style="{ height: `${totalListVirtualHeight}px`, position: 'relative' }">
            <div
              v-for="virtualRow in listVirtualRows"
              :key="virtualRow.index"
              class="post-list-row"
              :style="{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${listRowHeight - listGap}px`,
                transform: `translateY(${virtualRow.start}px)`,
                gap: `${listGap}px`,
              }"
            >
              <template v-for="post in listRowItems[virtualRow.index]" :key="post.id">
                <BlockedCardPlaceholder v-if="hidingPostIds.has(post.id)" variant="list" @refresh="handleRefresh" />
                <PostCardList
                  v-else
                  :post="post"
                  :is-favorited="favoritesStore.isFavorited(post.id)"
                  :is-new="newPostIds.has(post.id)"
                  @toggle-favorite="handleFavorite(post.id)"
                  @share="handleShare(post.id)"
                  @block-post="handleBlockPost(post.id)"
                  @block-post-and-author="handleBlockPostAndAuthor(post)"
                  @view-author="handleViewAuthor(post)"
                  @find-similar="handleFindSimilar(post)"
                />
              </template>
            </div>
          </div>
        </div>
        <div v-if="props.loading && props.hasMore !== false" class="load-more-indicator">
          <LoadingPlaceholder inline variant="list" :count="2" />
        </div>
        <div v-if="props.onLoadMore && props.hasMore === false" class="load-more-indicator">
          <span class="no-more">已经到底了</span>
        </div>
      </template>

      <!-- 列表模式：普通渲染（数据量少时） -->
      <template v-else-if="props.posts.length > 0 && displayMode === 'list'">
        <div class="post-list-container" :style="containerStyle">
          <template v-for="post in limitedPosts" :key="post.id">
            <BlockedCardPlaceholder v-if="hidingPostIds.has(post.id)" variant="list" @refresh="handleRefresh" />
            <PostCardList
              v-else
              :post="post"
              :is-favorited="favoritesStore.isFavorited(post.id)"
              :is-new="newPostIds.has(post.id)"
              @toggle-favorite="handleFavorite(post.id)"
              @share="handleShare(post.id)"
              @block-post="handleBlockPost(post.id)"
              @block-post-and-author="handleBlockPostAndAuthor(post)"
              @view-author="handleViewAuthor(post)"
              @find-similar="handleFindSimilar(post)"
            />
          </template>
        </div>
        <div v-if="props.loading && props.hasMore !== false && !shouldUsePagination" class="load-more-indicator">
          <LoadingPlaceholder inline variant="list" :count="2" />
        </div>
        <div v-if="props.onLoadMore && props.hasMore === false && !shouldUsePagination" class="load-more-indicator">
          <span class="no-more">已经到底了</span>
        </div>
      </template>

      <!-- 虚拟滚动网格 -->
      <div
        v-else-if="props.posts.length > 0 && shouldUseVirtualScroll"
        class="post-grid-container"
        :style="containerStyle"
      >
        <div class="post-grid-virtual" :style="{ height: `${totalVirtualHeight}px`, position: 'relative' }">
          <div
            v-for="virtualRow in virtualRows"
            :key="virtualRow.index"
            class="post-row"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${cardHeight}px`,
              transform: `translateY(${virtualRow.start}px)`,
              gap: `${gap}px`,
            }"
          >
            <PostCardLarge
              v-for="post in rowItems[virtualRow.index]"
              :key="post.id"
              :post="post"
              :class="{ 'post-hiding': hidingPostIds.has(post.id) }"
              :style="{ width: `${cardWidth}px`, height: `${cardHeight}px` }"
              :is-favorited="favoritesStore.isFavorited(post.id)"
              :is-new="newPostIds.has(post.id)"
              @toggle-favorite="handleFavorite(post.id)"
              @share="handleShare(post.id)"
              @block-post="handleBlockPost(post.id)"
              @block-post-and-author="handleBlockPostAndAuthor(post)"
              @view-author="handleViewAuthor(post)"
              @find-similar="handleFindSimilar(post)"
            />
          </div>
        </div>

        <div v-if="props.loading && props.hasMore !== false" class="load-more-indicator">
          <LoadingPlaceholder inline variant="grid" :count="isMobile ? 4 : 3" />
        </div>

        <div v-if="props.onLoadMore && props.hasMore === false" class="load-more-indicator">
          <span class="no-more">已经到底了</span>
        </div>
      </div>

      <!-- 普通网格（分页模式或数据量少时） -->
      <div v-else-if="props.posts.length > 0" class="post-grid-container" :style="containerStyle">
        <!-- 分割线前的帖子 -->
        <div v-if="separatorPosition > 0" class="post-grid" :style="gridStyle">
          <template v-for="post in limitedPosts.slice(0, separatorPosition)" :key="post.id">
            <BlockedCardPlaceholder v-if="hidingPostIds.has(post.id)" variant="card" @refresh="handleRefresh" />
            <PostCardLarge
              v-else
              :post="post"
              :is-favorited="favoritesStore.isFavorited(post.id)"
              :is-new="newPostIds.has(post.id)"
              @toggle-favorite="handleFavorite(post.id)"
              @share="handleShare(post.id)"
              @block-post="handleBlockPost(post.id)"
              @block-post-and-author="handleBlockPostAndAuthor(post)"
              @view-author="handleViewAuthor(post)"
              @find-similar="handleFindSimilar(post)"
            />
          </template>
        </div>

        <!-- 分割线 -->
        <div v-if="separatorPosition > 0" ref="separatorRef" class="time-separator">
          <span class="separator-line"></span>
          <span class="separator-text">以下是 3 天前的内容</span>
          <span class="separator-line"></span>
        </div>

        <!-- 分割线后的帖子（或全部帖子） -->
        <div class="post-grid" :style="gridStyle">
          <template
            v-for="post in separatorPosition > 0 ? limitedPosts.slice(separatorPosition) : limitedPosts"
            :key="post.id"
          >
            <BlockedCardPlaceholder v-if="hidingPostIds.has(post.id)" variant="card" @refresh="handleRefresh" />
            <PostCardLarge
              v-else
              :post="post"
              :is-favorited="favoritesStore.isFavorited(post.id)"
              :is-new="newPostIds.has(post.id)"
              @toggle-favorite="handleFavorite(post.id)"
              @share="handleShare(post.id)"
              @block-post="handleBlockPost(post.id)"
              @block-post-and-author="handleBlockPostAndAuthor(post)"
              @view-author="handleViewAuthor(post)"
              @find-similar="handleFindSimilar(post)"
            />
          </template>

          <LoadingPlaceholder
            v-if="props.loading && props.hasMore !== false && !shouldUsePagination"
            inline
            variant="grid"
            :count="isMobile ? 4 : 6"
          />
        </div>

        <div v-if="props.onLoadMore && props.hasMore === false && !shouldUsePagination" class="load-more-indicator">
          <span class="no-more">已经到底了</span>
        </div>
      </div>

      <div v-else-if="props.loading" class="skeleton-wrapper">
        <LoadingPlaceholder :variant="skeletonVariant" :count="isMobile ? 4 : 6" />
      </div>

      <div v-else>
        <EmptyState title="暂无帖子" description="试试调整筛选条件" />
      </div>

      <PaginationControl
        v-if="shouldRenderBottomPagination && props.posts.length > 0"
        class="pagination-block bottom"
        compact
        :current="props.currentPage || 1"
        :total="props.total || 0"
        :page-size="props.pageSize || 1"
        :show-summary="false"
        @page-change="handlePageChange"
      />
    </template>

    <!-- 卡片展开浮层 -->
    <PostExpandedOverlay />
  </div>
</template>

<style scoped>
.post-feed-list {
  min-height: 300px;
  position: relative;
}

.refresh-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 10px 8px;
  color: var(--opz-text-secondary);
}

/* 下拉刷新 */
.pull-refresh-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: height 0.2s ease-out;
}

.pull-refresh-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--opz-text-secondary);
}

.pull-icon {
  width: 24px;
  height: 24px;
  transition: transform 0.2s ease;
}

.pull-icon.can-refresh {
  transform: rotate(180deg);
}

.pull-refresh-content.refreshing .pull-icon {
  animation: spin 1s linear infinite;
}

.pull-text {
  font-size: 12px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.post-grid-container {
  position: relative;
}

/* 列表模式容器 */
.post-list-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  max-width: 900px;
  margin: 0 auto;
}

/* 虚拟滚动模式下容器不使用 grid */
.post-list-container:has(.post-list-virtual) {
  display: block;
  max-width: 1812px;
}

/* 虚拟滚动行 */
.post-list-row {
  display: grid;
  grid-template-columns: 1fr;
  contain: layout style;
  will-change: transform;
}

/* 宽屏两列布局（单个卡片最大 900px） */
@media (min-width: 1200px) {
  .post-list-container {
    grid-template-columns: repeat(2, minmax(0, 900px));
    max-width: 1812px;
  }

  .post-list-row {
    grid-template-columns: repeat(2, minmax(0, 900px));
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .post-list-container {
    gap: 8px;
  }
}

.post-row {
  display: flex;
  flex-direction: row;
  contain: layout style;
  will-change: transform;
}

.post-grid {
  display: grid;
  width: 100%;
  padding: 0;
}

.skeleton-wrapper {
  opacity: 0.85;
}

.load-more-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 12px 0 4px;
  color: var(--opz-text-secondary);
  font-size: 13px;
}

.no-more {
  color: var(--opz-text-tertiary);
}

.pagination-block {
  margin: 4px 0 12px;
}

.pagination-block.bottom {
  margin-top: 12px;
  margin-bottom: 0;
  display: flex;
  justify-content: flex-end;
}

/* 时间分割线 */
.time-separator {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0;
  padding: 0 8px;
}

.separator-line {
  flex: 1;
  height: 1px;
  background: var(--n-border-color, rgba(0, 0, 0, 0.1));
}

.separator-text {
  color: var(--opz-text-tertiary);
  font-size: 13px;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .time-separator {
    margin: 16px 0;
  }

  .separator-text {
    font-size: 12px;
  }
}

/* 帖子隐藏动画（虚拟滚动用） */
:deep(.post-hiding) {
  animation: post-hide 0.3s ease-out forwards;
  pointer-events: none;
}

@keyframes post-hide {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.8);
  }
}
</style>
