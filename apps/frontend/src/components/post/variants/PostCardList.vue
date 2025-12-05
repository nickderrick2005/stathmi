<script setup lang="ts">
/**
 * 列表模式卡片（Discord 风格横向长条形）
 */
import { computed, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { Post, WordMeta } from '@opz-hub/shared';
import { useAttachments } from '@/composables/useAttachments';
import { useExpandedPost } from '@/composables/useExpandedPost';
import { useAuthorFallback } from '@/composables/useAuthorFallback';
import { useFollowingSegment } from '@/composables/useFeedSegment';
import { useDiscordLink } from '@/composables/useDiscordLink';
import { usePreferencesStore } from '@/stores/preferences';
import { useQuickConfirm } from '@/composables/useQuickConfirm';
import { useMetadataStore } from '@/stores/metadata';
import { usePersistentFiltersStore } from '@/stores/filters';
import { getChannelDefaultImage } from '@/utils/constants';
import PostImageGrid from '../PostImageGrid.vue';
import PostActionMenu from '../PostActionMenu.vue';
import PostTitleBadges from '../PostTitleBadges.vue';
import ImageViewer from '@/components/common/ImageViewer.vue';
import starFilledIcon from '@/assets/icons/star-filled.svg';
import checkIcon from '@/assets/icons/check.svg';
import heartIcon from '@/assets/icons/heart.svg';
import messageIcon from '@/assets/icons/message.svg';
import linkIcon from '@/assets/icons/link.svg';

const props = defineProps<{
  post: Post;
  isFavorited?: boolean;
  isNew?: boolean;
}>();

const emit = defineEmits<{
  toggleFavorite: [];
  share: [];
  blockPost: [];
  blockPostAndAuthor: [];
  viewAuthor: [];
  findSimilar: [];
}>();

// 展开状态
const { expand } = useExpandedPost();
const cardRef = ref<HTMLElement | null>(null);

// 处理附件
const { allImages } = useAttachments(props.post);

// 图片查看器状态
const showImageViewer = ref(false);

function openImageViewer() {
  if (allImages.value.length === 0) return;
  showImageViewer.value = true;
}

// Router & Stores
const router = useRouter();
const route = useRoute();
const followingSegment = useFollowingSegment();
const preferencesStore = usePreferencesStore();
const metadataStore = useMetadataStore();
const filtersStore = usePersistentFiltersStore();
const { openWithJumpChoice } = useDiscordLink();
const { confirm } = useQuickConfirm();

// 加载词元数据（利用 store 缓存，多个卡片共享同一请求）
onMounted(async () => {
  const channelId = props.post.categoryId;
  await (channelId ? metadataStore.getChannelWordMeta(channelId) : metadataStore.getGlobalWordMeta());
});

// 作者信息回退
const postRef = computed(() => props.post);
const { useRoleIcon, avatarSrc, handleAvatarError, authorDisplayName, authorColor } = useAuthorFallback(postRef);

// 作者颜色（根据配置决定是否使用角色颜色）
const displayAuthorColor = computed(() => {
  if (!preferencesStore.authorRoleColorEnabled) return undefined;
  return authorColor.value;
});

// 频道默认封面图
const fallbackImage = computed(() => getChannelDefaultImage(props.post.categoryId));

// 根据分区生成默认背景色（当没有默认图片时使用）
const fallbackColor = computed(() => {
  const colors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  ];
  const hash = props.post.categoryId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
});

// 显示标题（截断到最大100字符）
const displayTitle = computed(() => {
  const title = props.post.title || '无标题';
  return title.slice(0, 100);
});

// 内容预览（桌面端显示，最多120字符）
const contentPreview = computed(() => {
  if (!props.post.content) return '';
  // 移除 markdown 格式符号，只保留纯文本
  const text = props.post.content
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/`[^`]+`/g, '') // 移除行内代码
    .replace(/!\[.*?\]\(.*?\)/g, '') // 移除图片
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // 链接保留文字
    .replace(/[#*_~>-]/g, '') // 移除格式符号
    .replace(/\n+/g, ' ') // 换行转空格
    .trim();
  return text.slice(0, 120);
});

// 根据标题长度分档确定字号，并应用用户偏移（参考 PostInfoOverlay）
const titleFontSize = computed(() => {
  const len = displayTitle.value.length;
  const offset = preferencesStore.cardTitleFontOffset;
  // 桌面端基础字号+1
  const isDesktop = typeof window !== 'undefined' && window.innerWidth > 600;
  let base: number;
  if (len <= 30) base = isDesktop ? 16 : 15;
  else if (len <= 60) base = isDesktop ? 15 : 14;
  else base = isDesktop ? 14 : 13;
  return base + offset;
});

// 标签展开状态
const tagsExpanded = ref(false);
const MAX_VISIBLE_WORDS = 5;

// 排序比较函数
const compareWordMeta = (a: WordMeta, b: WordMeta) => {
  if (b.score !== a.score) return b.score - a.score;
  return a.rank - b.rank;
};

// 标题+内容的小写文本（用于匹配关键词）
const normalizedText = computed(() => `${props.post.title} ${props.post.content || ''}`.toLowerCase());

// 从 store 缓存读取词元数据，优先使用当前频道的词元
const wordMeta = computed<WordMeta[]>(() => {
  const channelId = props.post.categoryId;
  if (channelId) {
    const channelMeta = metadataStore.cachedWordMetaForChannel(channelId);
    if (channelMeta && channelMeta.length > 0) {
      return channelMeta;
    }
  }
  return metadataStore.cachedWordMetaGlobal ?? [];
});

// 词元映射表
const metaByWord = computed(() => {
  const map = new Map<string, WordMeta>();
  for (const item of wordMeta.value) {
    map.set(item.word.toLowerCase(), item);
  }
  return map;
});

// 标签词（带元数据）
const tagWords = computed<WordMeta[]>(() => {
  const fallbackBase = props.post.tags.length + 1;
  return props.post.tags.map((tag, index) => {
    const meta = metaByWord.value.get(tag.toLowerCase());
    return {
      word: tag,
      type: 'tag',
      score: meta?.score ?? fallbackBase - index,
      rank: meta?.rank ?? index + 1,
    } as WordMeta;
  });
});

// 热词（从词元中筛选出在帖子中出现的关键词）
const keywordWords = computed<WordMeta[]>(() => {
  const text = normalizedText.value;
  const seen = new Set<string>();
  const keywords = wordMeta.value.filter((item) => item.type === 'keyword');
  return keywords
    .filter((item) => {
      const key = item.word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return key && text.includes(key);
    })
    .sort(compareWordMeta);
});

// 合并标签和热词，按分数排序，限制最多 20 个
const allWords = computed(() => [...tagWords.value, ...keywordWords.value].sort(compareWordMeta).slice(0, 20));

// 显示的词
const displayWords = computed(() => {
  if (tagsExpanded.value) return allWords.value;
  return allWords.value.slice(0, MAX_VISIBLE_WORDS);
});

// 隐藏的词数量
const hiddenWordCount = computed(() => Math.max(0, allWords.value.length - MAX_VISIBLE_WORDS));

// 切换展开
function toggleTagsExpand(e: Event) {
  e.stopPropagation();
  tagsExpanded.value = !tagsExpanded.value;
}

// 点击标签/热词处理：custom 页面筛选，其他页面跳转搜索
async function handleWordClick(e: Event, word: WordMeta) {
  e.stopPropagation();
  const routeName = route.name;
  const channelId = props.post.categoryId;

  if (routeName === 'custom' && channelId) {
    // custom 页面：设置选中的标签/关键词
    if (word.type === 'tag') {
      filtersStore.setActiveTag(channelId, word.word);
    } else {
      filtersStore.setActiveKeyword(channelId, word.word);
    }
    // 确保当前频道被选中
    if (!filtersStore.selectedChannels.includes(channelId)) {
      filtersStore.updateSelectedChannels([channelId]);
    }
  } else {
    // 其他页面：确认后跳转到搜索页
    const typeLabel = word.type === 'tag' ? '标签' : '关键词';
    const confirmed = await confirm(e, `搜索${typeLabel}「${word.word}」？`);
    if (!confirmed) return;

    const query = word.type === 'tag' ? { tags: word.word } : { q: word.word };
    router.push({ name: 'search', query });
  }
}

// 格式化时间辅助函数
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 1) return '刚刚';
  if (diffHours < 24) return `${Math.floor(diffHours)}h`;
  if (diffDays < 7) return `${Math.floor(diffDays)}天`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周`;
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

// 移动端时间（优先显示更新时间，带↑符号）
const mobileTime = computed(() => {
  if (!props.post.updatedAt) return formatTimeAgo(props.post.createdAt);
  const created = new Date(props.post.createdAt).getTime();
  const updated = new Date(props.post.updatedAt).getTime();
  // 编辑过（差>1分钟）显示更新时间
  return updated - created > 60000 ? `${formatTimeAgo(props.post.updatedAt)}↑` : formatTimeAgo(props.post.createdAt);
});

// 桌面端发布时间
const createdTime = computed(() => formatTimeAgo(props.post.createdAt));

// 桌面端更新时间（如果有且与发布时间不同）
const updatedTime = computed(() => {
  if (!props.post.updatedAt) return null;
  const created = new Date(props.post.createdAt).getTime();
  const updated = new Date(props.post.updatedAt).getTime();
  // 差>1分钟才算更新过
  return updated - created > 60000 ? formatTimeAgo(props.post.updatedAt) : null;
});

// 格式化数字
function formatNumber(num: number | undefined | null): string {
  if (!num) return '0';
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

// 格式化日期区间显示
function formatDateRange(from: Date, to: Date): string {
  const format = (d: Date) => d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  const fromStr = format(from);
  const toStr = format(to);
  return fromStr === toStr ? fromStr : `${fromStr} - ${toStr}`;
}

// 点击时间搜索该日期前后的帖子
async function searchByDate(e: Event, dateStr?: string) {
  e.stopPropagation();
  const date = new Date(dateStr || props.post.updatedAt || props.post.createdAt);
  // 前一天 00:00:00
  const fromDate = new Date(date);
  fromDate.setDate(fromDate.getDate() - 1);
  fromDate.setHours(0, 0, 0, 0);
  // 当天 23:59:59.999
  const toDate = new Date(date);
  toDate.setHours(23, 59, 59, 999);

  const confirmed = await confirm(e, `搜索 ${formatDateRange(fromDate, toDate)} 的帖子？`);
  if (!confirmed) return;

  router.push({
    path: '/search',
    query: {
      time: 'custom',
      time_from: fromDate.toISOString(),
      time_to: toDate.toISOString(),
    },
  });
}

// 预加载 markdown 渲染器
let preloaded = false;
function preloadMarkdownRenderer() {
  if (preloaded) return;
  preloaded = true;
  import('@/utils/markdown-renderer');
}

// 徽章点击：NEW -> 搜索24小时内作品
async function handleBadgeNew(e: Event) {
  const confirmed = await confirm(e, '查看24小时内的新帖子？');
  if (!confirmed) return;

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
function handleBadgeFavorite(e: Event) {
  e.stopPropagation();
  followingSegment.value = 'favorites';
  router.push('/following');
}

// 徽章点击：参与 -> 跳转到Discord参与页
function handleBadgeJoined(e: Event) {
  e.stopPropagation();
  followingSegment.value = 'following-discord';
  router.push('/following');
}

// 处理卡片点击
function handleCardClick() {
  if (cardRef.value) {
    const rect = cardRef.value.getBoundingClientRect();
    expand(props.post, rect);
  }
}

// 跳转到 Discord
function handleOpenDiscord() {
  openWithJumpChoice(props.post.discordUrl, props.post.updatedJumpUrl);
}
</script>

<template>
  <div
    ref="cardRef"
    class="post-card-list"
    :style="authorColor ? { '--role-color': authorColor } : undefined"
    @click="handleCardClick"
    @mouseenter="preloadMarkdownRenderer"
  >
    <!-- 左：内容区域 -->
    <div class="card-content-section">
      <!-- 标题 + 徽章 + 菜单 -->
      <div class="title-row">
        <div class="title-with-badges">
          <span class="post-title" :style="{ fontSize: `${titleFontSize}px` }">{{ displayTitle }}</span>
          <PostTitleBadges :post="post" :is-new="isNew" @click-new="handleBadgeNew" />
        </div>
        <div class="menu-wrapper">
          <PostActionMenu
            :post-id="post.id"
            :author-id="post.authorId"
            :has-images="allImages.length > 0"
            show-favorite
            :is-favorited="isFavorited"
            variant="compact"
            @toggle-favorite="emit('toggleFavorite')"
            @view-images="openImageViewer"
            @share="emit('share')"
            @view-author="emit('viewAuthor')"
            @find-similar="emit('findSimilar')"
            @block-post="emit('blockPost')"
            @block-post-and-author="emit('blockPostAndAuthor')"
          />
          <button type="button" class="link-btn" title="前往 Discord" @click.stop="handleOpenDiscord">
            <img :src="linkIcon" alt="跳转" class="link-icon" />
          </button>
        </div>
      </div>

      <!-- 标签/热词行 -->
      <div v-if="allWords.length > 0" class="tags-row" :class="{ expanded: tagsExpanded }">
        <button
          v-for="word in displayWords"
          :key="word.word"
          type="button"
          class="tag-chip tag-clickable"
          @click="handleWordClick($event, word)"
        >
          {{ word.word }}
        </button>
        <button
          v-if="hiddenWordCount > 0 && !tagsExpanded"
          type="button"
          class="tag-chip tag-expand"
          @click="toggleTagsExpand"
        >
          +{{ hiddenWordCount }}
        </button>
        <button
          v-if="tagsExpanded && allWords.length > MAX_VISIBLE_WORDS"
          type="button"
          class="tag-chip tag-collapse"
          @click="toggleTagsExpand"
        >
          收起
        </button>
      </div>

      <!-- 内容预览（桌面端） -->
      <p v-if="contentPreview" class="content-preview">{{ contentPreview }}</p>

      <!-- 底部：作者 + 统计 -->
      <div class="content-bottom">
        <button class="author-info" @click.stop="emit('viewAuthor')">
          <img
            :src="avatarSrc"
            class="author-avatar"
            :class="{ 'role-icon': useRoleIcon }"
            @error="handleAvatarError"
          />
          <span class="author-name" :style="displayAuthorColor ? { color: displayAuthorColor } : undefined">
            {{ authorDisplayName }}
          </span>
        </button>

        <div class="post-stats">
          <!-- 收藏状态 -->
          <button
            v-if="isFavorited"
            type="button"
            class="stat stat-btn favorited"
            title="已收藏 - 点击查看收藏列表"
            @click="handleBadgeFavorite"
          >
            <img :src="starFilledIcon" alt="" class="stat-icon" />
          </button>
          <!-- 已加入状态 -->
          <button
            v-if="post.isFollowedByUser"
            type="button"
            class="stat stat-btn joined"
            title="已参与 - 点击查看参与列表"
            @click="handleBadgeJoined"
          >
            <img :src="checkIcon" alt="" class="stat-icon" />
          </button>
          <span class="stat" title="点赞">
            <img :src="heartIcon" alt="" class="stat-icon" />
            {{ formatNumber(post.reactionCount) }}
          </span>
          <span class="stat" title="回复">
            <img :src="messageIcon" alt="" class="stat-icon" />
            {{ formatNumber(post.messageCount) }}
          </span>
          <!-- 移动端：单时间 -->
          <button type="button" class="stat stat-btn time mobile-only" title="搜索该时间段" @click="searchByDate($event)">
            {{ mobileTime }}
          </button>
          <!-- 桌面端：发布+更新时间 -->
          <button type="button" class="stat stat-btn time desktop-only" title="搜索该时间段" @click="searchByDate($event, post.createdAt)">
            {{ createdTime }}
          </button>
          <button
            v-if="updatedTime"
            type="button"
            class="stat stat-btn time desktop-only updated"
            title="搜索该时间段"
            @click="searchByDate($event, post.updatedAt!)"
          >
            {{ updatedTime }}↑
          </button>
        </div>
      </div>
    </div>

    <!-- 右：图片区域（只有有图时才显示） -->
    <div v-if="allImages.length > 0" class="card-image-section">
      <PostImageGrid :images="allImages" :fallback-image="fallbackImage" :fallback-color="fallbackColor" @click="openImageViewer" />
    </div>

    <!-- 图片查看器 -->
    <ImageViewer v-model:show="showImageViewer" :images="allImages" />
  </div>
</template>

<style scoped>
.post-card-list {
  position: relative;
  display: flex;
  gap: 16px;
  padding: 12px 12px 12px 20px;
  min-height: 150px;
  background: var(--opz-bg-card);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: all 0.2s ease;
}

/* 左侧角色色条（内嵌圆角） */
.post-card-list::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  background: var(--role-color, var(--opz-border));
  border-radius: 2px;
  opacity: 0.85;
  transition: opacity 0.2s ease;
}

.post-card-list:hover {
  background: var(--opz-bg-soft);
  transform: translateX(2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.post-card-list:hover::before {
  opacity: 1;
}

.post-card-list:active {
  transform: translateX(1px);
}

/* 内容区域：弹性填充，桌面端均匀分布 */
.card-content-section {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

@media (min-width: 601px) {
  .card-content-section {
    justify-content: space-between;
    gap: 8px;
  }
}

/* 图片区域：宽度固定，高度自适应但有上限 */
.card-image-section {
  width: 160px;
  min-height: 96px;
  max-height: 140px;
  flex-shrink: 0;
  align-self: stretch;
  border-radius: 8px;
  overflow: hidden;
}

/* 标题行：标题 + 徽章 + 菜单 */
.title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

/* 菜单包装器 */
.menu-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

/* 跳转按钮 */
.link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.link-btn:hover {
  background: var(--opz-bg-elevated);
}

.link-btn:active {
  transform: scale(0.95);
}

.link-icon {
  width: 16px;
  height: 16px;
  opacity: 0.6;
}

.link-btn:hover .link-icon {
  opacity: 1;
}

:root[data-theme='dark'] .link-icon {
  filter: invert(1);
}

/* 标题与徽章容器 - 内联布局 */
.title-with-badges {
  flex: 1;
  min-width: 0;
  line-height: 1.4;
}

.post-title {
  font-weight: 600;
  color: var(--opz-text-primary);
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* 让徽章跟在标题文字后面 */
.title-with-badges :deep(.title-badge) {
  display: inline-flex;
  vertical-align: middle;
  margin-left: 6px;
}

.post-card-list:hover .post-title {
  color: var(--opz-primary);
}


/* 标签行 - 圆角胶囊样式 */
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  overflow: hidden;
  max-height: 24px;
  transition: max-height 0.2s ease;
}

.tags-row.expanded {
  max-height: 200px;
}

/* 内容预览（仅桌面端显示） */
.content-preview {
  display: none;
}

@media (min-width: 601px) {
  .content-preview {
    display: -webkit-box;
    flex: 1;
    min-height: 0;
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--opz-text-tertiary);
    overflow: hidden;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--opz-text-secondary);
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

:root[data-theme='dark'] .tag-chip {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

.tag-clickable {
  cursor: pointer;
  transition: all 0.15s ease;
}

.tag-clickable:hover {
  background: var(--opz-primary-soft, rgba(74, 144, 226, 0.15));
  border-color: var(--opz-primary, #4a90e2);
  color: var(--opz-primary, #4a90e2);
}

.tag-expand,
.tag-collapse {
  cursor: pointer;
  color: var(--opz-text-secondary);
  background: transparent;
  border: 1px solid var(--opz-border);
  transition: all 0.15s ease;
}

.tag-expand:hover,
.tag-collapse:hover {
  background: var(--opz-bg-elevated, #f5f5f5);
  color: var(--opz-text-primary);
}

.content-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 移动端：确保底部贴底 */
@media (max-width: 600px) {
  .content-bottom {
    margin-top: auto;
  }
}

.author-info {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

/* 桌面端：作者胶囊样式（反色背景确保文字可读） */
@media (min-width: 601px) {
  .author-info {
    padding: 4px 10px 4px 6px;
    background: rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 999px;
    transition: all 0.15s ease;
  }

  .author-info:hover {
    background: rgba(0, 0, 0, 0.1);
    border-color: var(--role-color, rgba(0, 0, 0, 0.15));
  }

  :root[data-theme='dark'] .author-info {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.1);
  }

  :root[data-theme='dark'] .author-info:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--role-color, rgba(255, 255, 255, 0.18));
  }
}

.author-info:hover .author-name {
  text-decoration: underline;
}

.author-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
}

.author-avatar.role-icon {
  border-radius: 5px;
  object-fit: contain;
}

.author-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--opz-text-secondary);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--opz-text-tertiary);
}

.stat {
  display: flex;
  align-items: center;
  gap: 3px;
}

.stat-icon {
  width: 14px;
  height: 14px;
  opacity: 0.6;
}

/* 可点击的状态按钮 */
.stat-btn {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.stat-btn:hover {
  opacity: 0.8;
}

.stat-btn.favorited .stat-icon {
  opacity: 1;
  filter: none;
}

.stat-btn.joined .stat-icon {
  opacity: 1;
  filter: none;
}

.stat.time {
  color: var(--opz-text-quaternary, var(--opz-text-tertiary));
}

/* 更新时间样式（带↑符号，颜色区分） */
.stat.time.updated {
  color: var(--opz-primary, #4a90e2);
}

/* 默认：显示桌面端，隐藏移动端 */
.mobile-only {
  display: none;
}

.desktop-only {
  display: flex;
}

/* 响应式：移动端调整 */
@media (max-width: 600px) {
  /* 移动端：显示单时间，隐藏桌面端双时间 */
  .mobile-only {
    display: flex;
  }

  .desktop-only {
    display: none;
  }

  .post-card-list {
    gap: 10px;
    padding: 10px 10px 10px 14px;
    min-height: 90px;
  }

  .post-card-list::before {
    left: 4px;
    top: 8px;
    bottom: 8px;
    width: 2px;
  }

  .card-image-section {
    width: 90px;
    min-height: 70px;
    max-height: 100px;
  }

  .tags-row {
    gap: 4px;
    max-height: 20px;
  }

  .tags-row.expanded {
    max-height: 150px;
  }

  .tag-chip {
    padding: 1px 6px;
    font-size: 10px;
    max-width: 80px;
  }

  .content-bottom {
    gap: 6px;
  }

  .author-avatar {
    width: 18px;
    height: 18px;
  }

  .author-name {
    font-size: 12px;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .post-stats {
    gap: 6px;
    font-size: 11px;
  }

  .stat-icon {
    width: 12px;
    height: 12px;
  }

  .title-row {
    gap: 4px;
  }

  .post-title {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

/* 暗色主题 */
:root[data-theme='dark'] .stat-icon {
  filter: invert(1);
}

:root[data-theme='dark'] .post-card-list {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.3);
}

:root[data-theme='dark'] .post-card-list:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
</style>
