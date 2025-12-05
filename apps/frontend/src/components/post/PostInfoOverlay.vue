<script setup lang="ts">
/**
 * 帖子信息蒙版层
 * 卡片底部 1/3 区域，显示标题、作者、时间、标签等信息
 */
import { computed, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NTag, NSkeleton } from 'naive-ui';
import type { Post, WordMeta } from '@opz-hub/shared';
import { useMetadataStore } from '@/stores/metadata';
import { usePersistentFiltersStore } from '@/stores/filters';
import { usePreferencesStore } from '@/stores/preferences';
import { useQuickConfirm } from '@/composables/useQuickConfirm';

const props = defineProps<{
  post: Post;
}>();

const route = useRoute();
const router = useRouter();
const metadataStore = useMetadataStore();
const filtersStore = usePersistentFiltersStore();
const preferencesStore = usePreferencesStore();
const { confirm } = useQuickConfirm();
const isExpanded = ref(false);

// 排序比较函数（用于 computed 内部 sort）
const compareWordMeta = (a: WordMeta, b: WordMeta) => {
  if (b.score !== a.score) return b.score - a.score;
  return a.rank - b.rank;
};

const normalizedText = computed(() => `${props.post.title} ${props.post.content || ''}`.toLowerCase());

// 从 store 缓存读取词元数据，优先使用当前频道的词元，若无则回退到全局热词
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

// 仅在首次加载且缓存为空时显示
const metaLoading = computed(() => {
  return wordMeta.value.length === 0 && !metadataStore.cachedWordMetaGlobal;
});

// 首次挂载时触发一次加载（利用 store 缓存，多个卡片共享同一请求）
onMounted(async () => {
  try {
    const channelId = props.post.categoryId;
    await (channelId ? metadataStore.getChannelWordMeta(channelId) : metadataStore.getGlobalWordMeta());
  } catch (error) {
    console.error('[PostInfoOverlay] Failed to load metadata', error);
  }
});

// 当帖子切换时重置展开状态
watch(
  () => props.post.id,
  () => {
    isExpanded.value = false;
  }
);

const metaByWord = computed(() => {
  const map = new Map<string, WordMeta>();
  for (const item of wordMeta.value) {
    map.set(item.word.toLowerCase(), item);
  }
  return map;
});

const tagWords = computed<WordMeta[]>(() => {
  // 只展示该帖自身的标签，按词频对齐元数据，如果缺失则按原顺序降权
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

// 合并标签和关键词，按分数排序，限制最多 20 个
const allWords = computed(() => [...tagWords.value, ...keywordWords.value].sort(compareWordMeta).slice(0, 20));
// 默认显示前5个
const primaryWords = computed(() => allWords.value.slice(0, 5));
const extraWords = computed(() => allWords.value.slice(5));
const hiddenCount = computed(() => extraWords.value.length);
const displayWords = computed(() => (isExpanded.value ? allWords.value : primaryWords.value));

// 截断标题到最大 100 字符
const displayTitle = computed(() => {
  return props.post.title.slice(0, 100);
});

// 点击标签/热词处理：custom 页面筛选，其他页面跳转搜索
async function handleWordClick(e: Event, word: WordMeta) {
  const routeName = route.name;
  const channelId = props.post.categoryId;

  if (routeName === 'custom' && channelId) {
    // custom 页面：清空当前频道筛选，设置选中的标签/关键词
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

// 根据标题长度分档确定字号，并应用用户偏移
const titleTier = computed(() => {
  const len = displayTitle.value.length;
  const offset = preferencesStore.cardTitleFontOffset;
  let base: number;
  if (len <= 20) base = 15;
  else if (len <= 40) base = 14;
  else if (len <= 65) base = 13;
  else if (len <= 85) base = 12;
  else base = 11;
  return { fontSize: base + offset };
});

// 标签字号偏移
const tagFontSize = computed(() => 11 + preferencesStore.cardContentFontOffset);
</script>

<template>
  <div
    class="post-info-overlay"
    :style="{ '--title-font-size': `${titleTier.fontSize}px`, '--tag-font-size': `${tagFontSize}px` }"
  >
    <div class="info-content">
      <!-- 收起按钮（展开时显示在标签区上方居中） -->
      <button v-if="isExpanded && hiddenCount > 0" class="collapse-button" @click.stop="isExpanded = false">
        收起 ↓
      </button>

      <!-- 标签区：横向滚动 + 抽屉展开 -->
      <div class="tags-container" :class="{ expanded: isExpanded }">
        <!-- 标签行 -->
        <div class="tags-row">
          <div class="tags-scroll" :class="{ expanded: isExpanded }">
            <template v-if="metaLoading && !displayWords.length">
              <NSkeleton class="tag-skeleton" />
              <NSkeleton class="tag-skeleton" />
              <NSkeleton class="tag-skeleton wide" />
            </template>
            <template v-else>
              <NTag
                v-for="word in displayWords"
                :key="word.word"
                size="small"
                :bordered="false"
                class="post-tag clickable"
                @click.stop="handleWordClick($event, word)"
              >
                {{ word.word }}
              </NTag>
            </template>
          </div>
          <!-- 展开按钮（收起时显示在右侧） -->
          <NTag
            v-if="!isExpanded && hiddenCount > 0"
            size="small"
            :bordered="false"
            class="post-tag expand-tag"
            @click.stop="isExpanded = true"
          >
            +{{ hiddenCount }}
          </NTag>
        </div>
      </div>

      <!-- 标题 -->
      <div class="post-title">
        {{ displayTitle }}
      </div>

      <!-- 底部信息区（由 PostFooter 组件通过 slot 插入） -->
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
/* 蒙版容器 - 负边距消除子像素渲染缝隙 */
.post-info-overlay {
  position: absolute;
  bottom: -3px;
  left: -3px;
  right: -3px;
  pointer-events: none;
}

/* 内容区 */
.info-content {
  position: relative;
  padding: 56px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--opz-text-primary);
  pointer-events: auto;
  /* 创建层叠上下文，让 ::before 的 z-index 生效 */
  isolation: isolate;
}

/* 毛玻璃背景层 - 用 mask 实现渐变过渡，适配主题 */
.info-content::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--opz-bg-base) 85%, transparent) 0%,
    color-mix(in srgb, var(--opz-bg-base) 65%, transparent) 55%,
    color-mix(in srgb, var(--opz-bg-base) 35%, transparent) 85%,
    transparent 100%
  );
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  /* mask 让顶部渐变消失，实现 blur 的柔和过渡 */
  mask-image: linear-gradient(to top, black 0%, black 70%, transparent 100%);
  -webkit-mask-image: linear-gradient(to top, black 0%, black 70%, transparent 100%);
  z-index: -1;
}

@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 标题 - 字号根据标题长度分档调整 */
.post-title {
  font-size: var(--title-font-size, 14px);
  font-weight: 600;
  line-height: 1.4;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* 标签容器 - 融入毛玻璃背景 */
.tags-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.25s ease;
  max-height: 28px;
  overflow: hidden;
}

.tags-container.expanded {
  max-height: 200px;
}

/* 标签行 */
.tags-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 标签滚动区 */
.tags-scroll {
  flex: 1;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  flex-wrap: nowrap;
  transition: all 0.25s ease;
}

.tags-scroll::-webkit-scrollbar {
  display: none;
}

/* 展开后允许换行 */
.tags-scroll.expanded {
  flex-wrap: wrap;
  overflow-x: visible;
}

/* 标签骨架屏 */
.tag-skeleton {
  width: 48px;
  height: 20px;
  border-radius: 4px;
  flex-shrink: 0;
}

.tag-skeleton.wide {
  width: 72px;
}

/* 标签样式 - 融入毛玻璃 */
.post-tag {
  font-size: var(--tag-font-size, 11px);
  height: calc(var(--tag-font-size, 11px) + 9px);
  padding: 0 8px;
  line-height: calc(var(--tag-font-size, 11px) + 7px);
  background: transparent !important;
  color: var(--opz-text-primary) !important;
  border: 1px solid color-mix(in srgb, var(--opz-text-primary) 30%, transparent);
  border-radius: 4px;
  box-shadow: none;
  transition: all 0.2s ease;
  font-weight: 400;
  letter-spacing: 0.2px;
  flex-shrink: 0;
  white-space: nowrap;
}

.post-tag.clickable {
  cursor: pointer;
}

.post-tag:hover {
  background: color-mix(in srgb, var(--opz-text-primary) 10%, transparent) !important;
  border-color: color-mix(in srgb, var(--opz-text-primary) 50%, transparent);
}

/* 展开按钮 */
.expand-tag {
  flex-shrink: 0;
  border-style: dashed;
  cursor: pointer;
}

/* 收起按钮 - 居中胶囊式 */
.collapse-button {
  align-self: center;
  padding: 4px 14px;
  font-size: var(--tag-font-size, 11px);
  font-weight: 500;
  color: var(--opz-text-primary);
  background: color-mix(in srgb, var(--opz-bg-base) 70%, transparent);
  border: 1px dashed color-mix(in srgb, var(--opz-text-primary) 40%, transparent);
  border-radius: 999px;
  cursor: pointer;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  transition: all 0.2s ease;
  animation: slideDown 0.2s ease;
}

.collapse-button:hover {
  background: color-mix(in srgb, var(--opz-bg-base) 85%, transparent);
  border-color: color-mix(in srgb, var(--opz-text-primary) 60%, transparent);
}

.collapse-button:active {
  transform: scale(0.96);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 桌面端字号增大 */
@media (min-width: 601px) {
  .post-title {
    font-size: calc(var(--title-font-size, 14px) + 2px);
  }

  .post-tag {
    font-size: calc(var(--tag-font-size, 11px) + 1px);
    height: calc(var(--tag-font-size, 11px) + 10px);
    line-height: calc(var(--tag-font-size, 11px) + 8px);
  }
}
</style>
