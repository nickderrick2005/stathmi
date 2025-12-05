<script setup lang="ts">
/**
 * 表格式极简模式
 * HackerNews 风格的帖子列表
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Post, Attachment } from '@opz-hub/shared';
import { getValidImages } from '@/utils/post-helpers';
import { useExpandedPost } from '@/composables/useExpandedPost';
import { useDiscordLink } from '@/composables/useDiscordLink';
import { useFollowingSegment } from '@/composables/useFeedSegment';
import { useFavoritesStore } from '@/stores/favorites';
import { useMetadataStore } from '@/stores/metadata';
import { usePersistentFiltersStore } from '@/stores/filters';
import { usePreferencesStore } from '@/stores/preferences';
import { useQuickConfirm } from '@/composables/useQuickConfirm';
import { useRouter } from 'vue-router';
import PostActionMenu from '../PostActionMenu.vue';
import PostTitleBadges from '../PostTitleBadges.vue';
import ImageViewer from '@/components/common/ImageViewer.vue';
import heartIcon from '@/assets/icons/heart.svg';
import messageIcon from '@/assets/icons/message.svg';
import linkIcon from '@/assets/icons/link.svg';

// 列宽配置（localStorage 持久化）
const STORAGE_KEY = 'opz-table-minimal-col-widths';
const DEFAULT_AUTHOR_WIDTH = 100;
const MIN_AUTHOR_WIDTH = 60;
const MAX_AUTHOR_WIDTH = 200;

const authorColWidth = ref(DEFAULT_AUTHOR_WIDTH);

// 从 localStorage 加载列宽
function loadColumnWidths() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (typeof data.authorWidth === 'number') {
        authorColWidth.value = Math.max(MIN_AUTHOR_WIDTH, Math.min(MAX_AUTHOR_WIDTH, data.authorWidth));
      }
    }
  } catch {
    // 忽略解析错误
  }
}

// 保存列宽到 localStorage
function saveColumnWidths() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ authorWidth: authorColWidth.value }));
  } catch {
    // 忽略存储错误
  }
}

// 拖动状态
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartWidth = ref(0);

function startDrag(e: MouseEvent) {
  e.preventDefault();
  isDragging.value = true;
  dragStartX.value = e.clientX;
  dragStartWidth.value = authorColWidth.value;
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return;
  // 向左拖动增加作者列宽度（因为作者列在标题列右边）
  const delta = dragStartX.value - e.clientX;
  const newWidth = Math.max(MIN_AUTHOR_WIDTH, Math.min(MAX_AUTHOR_WIDTH, dragStartWidth.value + delta));
  authorColWidth.value = newWidth;
}

function stopDrag() {
  if (!isDragging.value) return;
  isDragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  saveColumnWidths();
}

onMounted(() => {
  loadColumnWidths();
});

onUnmounted(() => {
  // 清理可能残留的事件监听
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
});

const props = defineProps<{
  posts: Post[];
  /** 是否隐藏频道列（在频道页面内使用时） */
  hideChannel?: boolean;
  /** 正在隐藏的帖子ID集合（屏蔽动画用） */
  hidingPostIds?: Set<string>;
}>();

const emit = defineEmits<{
  toggleFavorite: [postId: string];
  share: [postId: string];
  blockPost: [postId: string];
  blockPostAndAuthor: [post: Post];
  viewAuthor: [post: Post];
  findSimilar: [post: Post];
  refresh: [];
}>();

const router = useRouter();
const { expand } = useExpandedPost();
const { openWithJumpChoice } = useDiscordLink();
const followingSegment = useFollowingSegment();
const favoritesStore = useFavoritesStore();
const metadataStore = useMetadataStore();
const filterStore = usePersistentFiltersStore();
const preferencesStore = usePreferencesStore();
const { confirm } = useQuickConfirm();

// 标题字号（基准 13px + offset，桌面端通过 CSS 额外 +1px）
const titleFontSize = computed(() => 13 + preferencesStore.cardTitleFontOffset);

// 获取频道名称
const channelNames = computed(() => {
  const channels = metadataStore.cachedChannels;
  const map: Record<string, string> = {};
  if (channels) {
    for (const channel of channels) {
      map[channel.id] = channel.name;
    }
  }
  return map;
});

// 格式化时间（桌面端简洁版）
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = (Date.now() - date.getTime()) / 3600000;

  if (hours < 1) return '刚刚';
  if (hours < 24) return `${Math.floor(hours)}h`;
  if (hours < 168) return `${Math.floor(hours / 24)}天前`;
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

// 格式化时间（移动端，与 PostCardLarge 统一）
function formatTimeMobile(post: Post): string {
  const format = (ts: string) => {
    const date = new Date(ts);
    const hours = (Date.now() - date.getTime()) / 3600000;
    if (hours < 24) return '今天';
    if (hours < 168) return `${Math.floor(hours / 24)}天前`;
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  };

  if (!post.updatedAt) return format(post.createdAt);

  const created = new Date(post.createdAt).getTime();
  const updated = new Date(post.updatedAt).getTime();
  // 编辑过（差>1分钟）显示更新时间带↑
  return updated - created > 60000 ? `${format(post.updatedAt)}↑` : format(post.createdAt);
}

// 格式化数字
function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// 行引用（用于展开动画）
const rowRefs = ref<Record<string, HTMLElement | null>>({});

function setRowRef(postId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (el: any) => {
    rowRefs.value[postId] = el as HTMLElement | null;
  };
}

// 点击标题展开
function handleTitleClick(post: Post) {
  const rowEl = rowRefs.value[post.id];
  if (rowEl) {
    const rect = rowEl.getBoundingClientRect();
    expand(post, rect);
  }
}

// 跳转到 Discord
function handleOpenDiscord(post: Post) {
  if (post.discordUrl) {
    openWithJumpChoice(post.discordUrl, post.updatedJumpUrl);
  }
}

// 作者主页
function handleViewAuthor(e: Event, post: Post) {
  e.stopPropagation();
  router.push(`/user/${post.authorId}`);
}

// 菜单操作
function handleShare(postId: string) {
  emit('share', postId);
}

function handleBlockPost(postId: string) {
  emit('blockPost', postId);
}

function handleBlockPostAndAuthor(post: Post) {
  emit('blockPostAndAuthor', post);
}

function handleMenuViewAuthor(post: Post) {
  emit('viewAuthor', post);
}

function handleFindSimilar(post: Post) {
  emit('findSimilar', post);
}

// 徽章点击：NEW -> 搜索24小时内作品
function handleBadgeNew() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  router.push({
    path: '/search',
    query: {
      time: 'custom',
      time_from: yesterday.toISOString(),
    },
  });
}

// 徽章点击：收藏 -> 跳转到收藏页
function handleBadgeFavorite() {
  followingSegment.value = 'favorites';
  router.push('/following');
}

// 徽章点击：参与 -> 跳转到Discord参与页
function handleBadgeJoined() {
  followingSegment.value = 'following-discord';
  router.push('/following');
}

// 格式化日期区间显示
function formatDateRange(from: Date, to: Date): string {
  const format = (d: Date) => d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  const fromStr = format(from);
  const toStr = format(to);
  return fromStr === toStr ? fromStr : `${fromStr} - ${toStr}`;
}

// 点击时间 -> 搜索该时间段
async function handleTimeClick(e: Event, dateStr: string) {
  e.stopPropagation();
  const postDate = new Date(dateStr);
  // 搜索该天的帖子
  const dayStart = new Date(postDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(postDate);
  dayEnd.setHours(23, 59, 59, 999);

  const confirmed = await confirm(e, `搜索 ${formatDateRange(dayStart, dayEnd)} 的帖子？`);
  if (!confirmed) return;

  router.push({
    path: '/search',
    query: {
      time: 'custom',
      time_from: dayStart.toISOString(),
      time_to: dayEnd.toISOString(),
    },
  });
}

// 点击频道 -> 跳转到 custom 页面并筛选该频道
function handleChannelClick(e: Event, categoryId: string) {
  e.stopPropagation();
  filterStore.updateSelectedChannels([categoryId]);
  router.push('/custom');
}

// 图片查看器状态
const showImageViewer = ref(false);
const viewerImages = ref<Attachment[]>([]);

function openImageViewer(post: Post) {
  const images = getValidImages(post);
  if (images.length === 0) return;
  viewerImages.value = images;
  showImageViewer.value = true;
}
</script>

<template>
  <div class="post-table-minimal" :style="{ '--title-font-size': `${titleFontSize}px` }">
    <!-- 表头 -->
    <div class="table-header">
      <div class="col col-link"></div>
      <div class="col col-main">
        标题
        <!-- 拖动手柄：调整标题/作者列宽 -->
        <div class="col-resize-handle" @mousedown="startDrag" />
      </div>
      <div class="col col-author" :style="{ width: `${authorColWidth}px` }">作者</div>
      <div v-if="!props.hideChannel" class="col col-channel">频道</div>
      <div class="col col-time">发布</div>
      <div class="col col-updated">更新</div>
      <div class="col col-stats">互动</div>
      <div class="col col-menu"></div>
    </div>

    <!-- 数据行 -->
    <template v-for="post in props.posts" :key="post.id">
      <!-- 被屏蔽的行：显示刷新按钮 -->
      <div v-if="props.hidingPostIds?.has(post.id)" class="table-row row-blocked">
        <div class="blocked-row-content">
          <span class="blocked-text">已屏蔽</span>
          <button type="button" class="refresh-btn" @click="emit('refresh')">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <path d="M8 1V4L11 2.5L8 1Z" fill="currentColor" />
            </svg>
            <span>刷新</span>
          </button>
        </div>
      </div>

      <!-- 正常数据行 -->
      <div v-else :ref="setRowRef(post.id)" class="table-row" @click="handleTitleClick(post)">
        <!-- PC端：跳转按钮 -->
        <div class="col col-link">
          <button type="button" class="link-btn" title="前往 Discord" @click.stop="handleOpenDiscord(post)">
            <img :src="linkIcon" alt="跳转" class="link-icon" />
          </button>
        </div>

        <!-- 主内容区：移动端两行，PC端单行 -->
        <div class="col col-main">
          <!-- 第一行：标题 + 徽章 -->
          <div class="row-line-1">
            <span class="title-text">{{ post.title }}</span>
            <PostTitleBadges
              :post="post"
              :is-favorited="favoritesStore.isFavorited(post.id)"
              show-favorite
              show-joined
              @click-new="handleBadgeNew"
              @click-favorite="handleBadgeFavorite"
              @click-joined="handleBadgeJoined"
            />
          </div>
          <!-- 第二行：元信息（移动端显示） -->
          <div class="row-line-2">
            <div class="meta-left">
              <button type="button" class="author-link" @click="handleViewAuthor($event, post)">
                @{{ post.authorName || post.authorId.slice(0, 8) }}
              </button>
              <span class="meta-sep">·</span>
              <span class="meta-time">{{ formatTimeMobile(post) }}</span>
            </div>
            <span class="meta-stats">
              <img :src="heartIcon" alt="" class="stat-icon" />{{ formatNumber(post.reactionCount) }}
              <img :src="messageIcon" alt="" class="stat-icon" />{{ formatNumber(post.messageCount) }}
            </span>
          </div>
        </div>

        <!-- PC端：作者列 -->
        <div class="col col-author" :style="{ width: `${authorColWidth}px` }">
          <button type="button" class="author-link" @click="handleViewAuthor($event, post)">
            @{{ post.authorName || post.authorId.slice(0, 8) }}
          </button>
        </div>

        <!-- PC端：频道列 -->
        <div v-if="!props.hideChannel" class="col col-channel">
          <button type="button" class="channel-link" @click="handleChannelClick($event, post.categoryId)">
            {{ channelNames[post.categoryId] || '未知' }}
          </button>
        </div>

        <!-- PC端：发布时间列 -->
        <div class="col col-time">
          <button type="button" class="time-link" @click="handleTimeClick($event, post.createdAt)">
            {{ formatTime(post.createdAt) }}
          </button>
        </div>

        <!-- PC端：更新时间列 -->
        <div class="col col-updated">
          <button
            v-if="post.updatedAt"
            type="button"
            class="time-link"
            @click="handleTimeClick($event, post.updatedAt)"
          >
            {{ formatTime(post.updatedAt) }}
          </button>
          <span v-else class="no-update">-</span>
        </div>

        <!-- PC端：互动列 -->
        <div class="col col-stats">
          <span class="stat"
            ><img :src="heartIcon" alt="" class="stat-icon" />{{ formatNumber(post.reactionCount) }}</span
          >
          <span class="stat"
            ><img :src="messageIcon" alt="" class="stat-icon" />{{ formatNumber(post.messageCount) }}</span
          >
        </div>

        <!-- 菜单列 -->
        <div class="col col-menu" @click.stop>
          <div class="menu-wrapper">
            <PostActionMenu
              :post-id="post.id"
              :author-id="post.authorId"
              :has-images="getValidImages(post).length > 0"
              show-favorite
              :is-favorited="favoritesStore.isFavorited(post.id)"
              variant="compact"
              @toggle-favorite="emit('toggleFavorite', post.id)"
              @view-images="openImageViewer(post)"
              @share="handleShare(post.id)"
              @view-author="handleMenuViewAuthor(post)"
              @find-similar="handleFindSimilar(post)"
              @block-post="handleBlockPost(post.id)"
              @block-post-and-author="handleBlockPostAndAuthor(post)"
            />
            <!-- 移动端跳转按钮 -->
            <button type="button" class="mobile-link-btn" title="前往 Discord" @click="handleOpenDiscord(post)">
              <img :src="linkIcon" alt="跳转" class="link-icon" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <div v-if="props.posts.length === 0" class="empty-state">暂无帖子</div>

    <!-- 图片查看器 -->
    <ImageViewer v-model:show="showImageViewer" :images="viewerImages" />
  </div>
</template>

<style scoped>
.post-table-minimal {
  width: 100%;
  font-size: 13px;
}

.table-header {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 2px solid var(--opz-border);
  font-weight: 600;
  color: var(--opz-text-secondary);
  position: sticky;
  top: 0;
  background: var(--opz-bg-base);
  z-index: 10;
}

.table-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--opz-border-light, rgba(0, 0, 0, 0.06));
  cursor: pointer;
  transition: background 0.15s ease;
}

.table-row:hover {
  background: var(--opz-bg-soft);
}

.table-row:nth-child(even) {
  background: var(--opz-bg-stripe, rgba(0, 0, 0, 0.02));
}

.table-row:nth-child(even):hover {
  background: var(--opz-bg-soft);
}

/* 被屏蔽行 */
.table-row.row-blocked {
  background: var(--opz-bg-soft);
  cursor: default;
}

.table-row.row-blocked:hover {
  background: var(--opz-bg-soft);
}

.blocked-row-content {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 16px;
}

.blocked-text {
  color: var(--opz-text-tertiary);
  font-size: 13px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--opz-border);
  border-radius: 6px;
  background: var(--opz-bg-base);
  color: var(--opz-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.refresh-btn:hover {
  background: var(--opz-bg-elevated, #f5f5f5);
  color: var(--opz-primary);
  border-color: var(--opz-primary);
}

.col {
  flex-shrink: 0;
  padding: 0 8px;
}

.col-link {
  width: 40px;
  text-align: center;
}

/* 主内容区：PC端只显示标题，移动端显示两行 */
.col-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
}

/* 列宽调整手柄 */
.col-resize-handle {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 20px;
  cursor: col-resize;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 默认显示拖动指示点 */
.col-resize-handle::before {
  content: '';
  width: 4px;
  height: 14px;
  border-radius: 2px;
  background: var(--opz-border, rgba(0, 0, 0, 0.15));
  transition: all 0.15s ease;
}

.col-resize-handle:hover::before {
  background: var(--opz-primary, #4a90e2);
  height: 18px;
}

.col-resize-handle:active::before {
  background: var(--opz-primary, #4a90e2);
}

.table-header .col-main {
  position: relative;
}

.row-line-1 {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* PC端隐藏第二行 */
.row-line-2 {
  display: none;
}

.col-author {
  /* 宽度由内联样式动态设置 */
  flex-shrink: 0;
}

.col-channel {
  width: 70px;
  color: var(--opz-text-tertiary);
}

.col-time {
  width: 55px;
  color: var(--opz-text-tertiary);
}

.col-updated {
  width: 55px;
  color: var(--opz-text-tertiary);
}

.no-update {
  color: var(--opz-text-tertiary);
  opacity: 0.5;
}

/* 频道链接 */
.channel-link {
  border: none;
  background: transparent;
  color: var(--opz-text-tertiary);
  font-size: inherit;
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.channel-link:hover {
  color: var(--opz-primary, #4a90e2);
  text-decoration: underline;
}

/* 时间链接 */
.time-link {
  border: none;
  background: transparent;
  color: var(--opz-text-tertiary);
  font-size: inherit;
  cursor: pointer;
  padding: 0;
}

.time-link:hover {
  color: var(--opz-primary, #4a90e2);
  text-decoration: underline;
}

.col-stats {
  width: 100px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--opz-text-tertiary);
}

.col-menu {
  width: 40px;
  text-align: center;
}

.menu-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 跳转按钮 */
.link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--opz-text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.link-btn:hover {
  background: var(--opz-bg-soft);
  color: var(--opz-primary, #4a90e2);
}

.link-icon {
  width: 16px;
  height: 16px;
  opacity: 0.6;
}

.link-btn:hover .link-icon {
  opacity: 1;
}

/* 移动端跳转按钮（默认隐藏） */
.mobile-link-btn {
  display: none;
}

/* 标题 */
.title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--opz-text-primary);
  font-size: var(--title-font-size, 13px);
}

/* 桌面端整体字号增大 1px */
@media (min-width: 769px) {
  .post-table-minimal {
    font-size: 14px;
  }

  .title-text {
    font-size: calc(var(--title-font-size, 13px) + 1px);
  }

  .stat {
    font-size: 13px;
  }
}

.table-row:hover .title-text {
  color: var(--opz-primary, #4a90e2);
}

/* 作者链接 */
.author-link {
  border: none;
  background: transparent;
  color: var(--opz-text-secondary);
  font-size: inherit;
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  display: block;
}

.author-link:hover {
  color: var(--opz-primary, #4a90e2);
  text-decoration: underline;
}

/* 统计 */
.stat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  vertical-align: middle;
}

.stat-icon {
  width: 13px;
  height: 13px;
  opacity: 0.65;
  vertical-align: middle;
  flex-shrink: 0;
}

/* 空状态 */
.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--opz-text-tertiary);
}

/* 移动端第二行元信息 */
.meta-sep {
  color: var(--opz-text-tertiary);
  margin: 0 2px;
}

.meta-time {
  color: var(--opz-text-tertiary);
}

.meta-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--opz-text-tertiary);
  font-size: 12px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  /* 隐藏PC端独立列 */
  .col-link,
  .col-author,
  .col-channel,
  .col-time,
  .col-updated,
  .col-stats {
    display: none;
  }

  /* 隐藏列宽调整手柄 */
  .col-resize-handle {
    display: none;
  }

  /* 隐藏表头 */
  .table-header {
    display: none;
  }

  /* 显示移动端第二行 */
  .row-line-2 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    margin-top: 4px;
  }

  .meta-left {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .meta-left .author-link {
    max-width: 100px;
    flex-shrink: 1;
  }

  /* 标题可换行，最多3行 */
  .title-text {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    line-height: 1.4;
  }

  .table-row {
    padding: 12px 8px;
  }

  .col-main {
    padding: 0;
  }

  /* 菜单区：竖向布局 */
  .col-menu {
    width: auto;
  }

  .menu-wrapper {
    flex-direction: column;
    gap: 4px;
  }

  /* 显示移动端跳转按钮 */
  .mobile-link-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--opz-text-tertiary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mobile-link-btn:hover {
    background: var(--opz-bg-soft);
  }

  .mobile-link-btn .link-icon {
    opacity: 0.7;
  }
}

/* 暗色主题 */
:root[data-theme='dark'] .stat-icon,
:root[data-theme='dark'] .link-icon {
  filter: invert(1);
}

:root[data-theme='dark'] .table-row:nth-child(even) {
  background: var(--opz-bg-stripe, rgba(255, 255, 255, 0.02));
}

:root[data-theme='dark'] .table-header {
  background: var(--opz-bg-base);
}
</style>
