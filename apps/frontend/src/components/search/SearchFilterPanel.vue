<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { NSwitch } from 'naive-ui';
import { useSearchStore } from '@/stores/search';
import { useMetadataStore } from '@/stores/metadata';
import TimeRangeSelector from '@/components/filters/TimeRangeSelector.vue';
import ChipButton from '@/components/common/ChipButton.vue';
import RelationAndIcon from '@/assets/icons/relation-and.svg?raw';
import RelationOrIcon from '@/assets/icons/relation-or.svg?raw';
import type { SearchTimeRange } from '@/types/search';
import type { Channel, WordMeta, Post } from '@opz-hub/shared';

const props = defineProps<{
  expanded: boolean;
  posts?: Post[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:expanded': [value: boolean];
}>();

const searchStore = useSearchStore();
const metadataStore = useMetadataStore();

const filters = computed(() => searchStore.filters);

// 是否有任何活跃的筛选条件（不包含搜索词，搜索词单独删除）
const hasAnyFilters = computed(() => {
  const f = filters.value;
  return (
    f.tags.length > 0 ||
    f.selectedKeywords.length > 0 ||
    f.category !== undefined ||
    f.timeRange !== 'all' ||
    f.includeInvalid === true
  );
});

// 频道列表
const channels = computed<Channel[]>(() => metadataStore.cachedChannels || []);
const loadingChannels = ref(false);

// 每次展开增加的数量
const STEP = 20;

// 展开数量状态
const tagsLimit = ref(STEP);
const keywordsLimit = ref(STEP);

// 标签数据：选中频道时从 metadata 获取，否则从搜索结果聚合
const allTags = computed(() => {
  const selected = filters.value.tags;
  let baseTags: string[];

  // 选中频道时，直接使用 metadata 中的标签（减少运算，且覆盖该频道所有标签）
  if (filters.value.category) {
    baseTags = hotWords.value.filter((w) => w.type === 'tag').map((w) => w.word);
  } else {
    // 未选中频道时，从搜索结果中聚合
    const tagSet = new Set<string>();
    for (const post of props.posts || []) {
      if (post.tags) {
        for (const tag of post.tags) {
          tagSet.add(tag);
        }
      }
    }
    baseTags = Array.from(tagSet);
  }

  // 确保已选中的标签始终显示（即使不在当前列表中）
  const baseSet = new Set(baseTags);
  const missingSelected = selected.filter((t) => !baseSet.has(t));
  return [...missingSelected, ...baseTags];
});

const visibleTags = computed(() => allTags.value.slice(0, tagsLimit.value));
const hasMoreTags = computed(() => allTags.value.length > tagsLimit.value);

// 热词/标签数据（来自 metadata）
const hotWords = computed<WordMeta[]>(() => {
  const category = filters.value.category;
  if (category) {
    return metadataStore.cachedWordMetaForChannel(category) || metadataStore.cachedWordMetaGlobal || [];
  }
  return metadataStore.cachedWordMetaGlobal || [];
});

// 从搜索结果中匹配热词（只检查标题降低计算压力）
const allKeywords = computed(() => {
  const selected = filters.value.selectedKeywords;
  const posts = props.posts || [];

  const keywords = hotWords.value.filter((w) => w.type === 'keyword').map((w) => w.word);

  let baseKeywords: string[];
  if (posts.length === 0) {
    baseKeywords = [];
  } else {
    // 合并所有帖子标题用于匹配
    const titles = posts.map((p) => p.title?.toLowerCase() || '').join(' ');
    baseKeywords = keywords.filter((kw) => titles.includes(kw.toLowerCase()));
  }

  // 确保已选中的热词始终显示（即使不在当前列表中）
  const baseSet = new Set(baseKeywords);
  const missingSelected = selected.filter((k) => !baseSet.has(k));
  return [...missingSelected, ...baseKeywords];
});

const visibleKeywords = computed(() => allKeywords.value.slice(0, keywordsLimit.value));
const hasMoreKeywords = computed(() => allKeywords.value.length > keywordsLimit.value);

function expandTags() {
  tagsLimit.value += STEP;
}

function expandKeywords() {
  keywordsLimit.value += STEP;
}

// 处理时间范围变化
function handleTimeRangeChange(payload: {
  timeRange: SearchTimeRange;
  timeFrom?: string | null;
  timeTo?: string | null;
}) {
  if (payload.timeRange === 'custom') {
    searchStore.patch({
      timeRange: 'custom',
      customTimeFrom: payload.timeFrom ?? null,
      customTimeTo: payload.timeTo ?? null,
    });
    return;
  }
  searchStore.patch({ timeRange: payload.timeRange, customTimeFrom: null, customTimeTo: null });
}

// 处理 includeInvalid 变化
function handleIncludeInvalidChange(value: boolean) {
  searchStore.patch({ includeInvalid: value });
}

// 处理频道选择
function handleChannelSelect(channelId: string | null) {
  searchStore.patch({ category: channelId ?? undefined });
}

// 防抖更新标签到 store
const debouncedPatchTags = useDebounceFn((tags: string[], relation: 'AND' | 'OR') => {
  searchStore.patch({ tags, tagRelation: relation });
}, 300);

// 防抖更新热词到 store
const debouncedPatchKeywords = useDebounceFn((keywords: string[]) => {
  searchStore.patch({ selectedKeywords: keywords });
}, 300);

// 处理标签选择（即时更新+防抖）
function handleTagToggle(tag: string) {
  const current = filters.value.tags;
  const newTags = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
  debouncedPatchTags(newTags, filters.value.tagRelation);
}

// 处理热词选择（热词作为搜索关键词，不使用标签匹配逻辑）
function handleKeywordToggle(keyword: string) {
  const current = filters.value.selectedKeywords;
  const newKeywords = current.includes(keyword)
    ? current.filter((k) => k !== keyword)
    : [...current, keyword];
  debouncedPatchKeywords(newKeywords);
}

// 切换标签匹配逻辑
function toggleTagRelation() {
  const newRelation = filters.value.tagRelation === 'OR' ? 'AND' : 'OR';
  debouncedPatchTags(filters.value.tags, newRelation);
}

// 收起面板
function collapse() {
  emit('update:expanded', false);
}

// 清空搜索关键词
function clearSearchQuery() {
  searchStore.patch({ q: '' });
}

// 清空所有筛选条件（保留搜索词）
function clearAllFilters() {
  searchStore.patch({
    tags: [],
    tagRelation: 'OR',
    selectedKeywords: [],
    category: undefined,
    timeRange: 'all',
    customTimeFrom: null,
    customTimeTo: null,
    includeInvalid: false,
  });
}

// 加载元数据
onMounted(async () => {
  loadingChannels.value = true;
  try {
    await Promise.all([metadataStore.getChannels(), metadataStore.getGlobalWordMeta()]);
  } finally {
    loadingChannels.value = false;
  }
});

// 频道变化时加载对应热词
watch(
  () => filters.value.category,
  async (channelId) => {
    if (channelId) {
      await metadataStore.getChannelWordMeta(channelId);
    }
  }
);
</script>

<template>
  <div v-if="expanded" class="filter-panel-wrapper">
    <!-- 移动端遮罩背景 -->
    <div class="mobile-backdrop" @click="collapse"></div>

    <div class="filter-panel" :class="{ 'is-loading': loading }">
      <!-- 移动端拖拽条 -->
      <div class="mobile-drag-handle">
        <span class="drag-bar"></span>
      </div>

      <!-- 加载遮罩 -->
      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>

      <!-- 搜索关键词（从 URL 或搜索框输入） -->
      <div v-if="filters.q.trim()" class="filter-section">
        <div class="section-header">
          <span class="section-title">搜索词</span>
        </div>
        <div class="chip-row">
          <ChipButton size="small" variant="closable" @close="clearSearchQuery">
            {{ filters.q }}
          </ChipButton>
        </div>
      </div>

      <!-- 频道筛选 -->
      <div class="filter-section">
        <div class="section-header">
          <span class="section-title">频道</span>
        </div>
        <div class="chip-row">
          <ChipButton size="small" :active="!filters.category" @click="handleChannelSelect(null)"> 全部 </ChipButton>
          <ChipButton
            v-for="channel in channels"
            :key="channel.id"
            size="small"
            :active="filters.category === channel.id"
            @click="handleChannelSelect(channel.id)"
          >
            {{ channel.name }}
          </ChipButton>
        </div>
      </div>

      <!-- 时间范围 -->
      <div class="filter-section">
        <TimeRangeSelector
          :time-range="filters.timeRange"
          :custom-from="filters.customTimeFrom"
          :custom-to="filters.customTimeTo"
          borderless
          @change="handleTimeRangeChange"
        />
      </div>

      <!-- 标签筛选 -->
      <div v-if="allTags.length > 0" class="filter-section">
        <div class="section-header">
          <span class="section-title">标签</span>
          <button
            v-if="filters.tags.length > 1"
            type="button"
            class="relation-toggle"
            :class="{ active: filters.tagRelation === 'AND' }"
            :title="filters.tagRelation === 'AND' ? '切换为「任一」关系' : '切换为「全部」关系'"
            @click="toggleTagRelation"
          >
            <span v-html="filters.tagRelation === 'AND' ? RelationAndIcon : RelationOrIcon"></span>
            <span class="relation-text">{{ filters.tagRelation === 'AND' ? '全部' : '任一' }}</span>
          </button>
        </div>
        <div class="chip-row">
          <ChipButton
            v-for="tag in visibleTags"
            :key="tag"
            size="small"
            :active="filters.tags.includes(tag)"
            @click="handleTagToggle(tag)"
          >
            {{ tag }}
          </ChipButton>
          <button v-if="hasMoreTags" type="button" class="expand-btn" @click="expandTags">
            +{{ Math.min(STEP, allTags.length - tagsLimit) }}
          </button>
        </div>
      </div>

      <!-- 热词筛选（热词作为搜索关键词，在标题/内容中全文匹配） -->
      <div v-if="allKeywords.length > 0" class="filter-section">
        <div class="section-header">
          <span class="section-title">热词</span>
        </div>
        <div class="chip-row">
          <ChipButton
            v-for="keyword in visibleKeywords"
            :key="keyword"
            size="small"
            :active="filters.selectedKeywords.includes(keyword)"
            @click="handleKeywordToggle(keyword)"
          >
            {{ keyword }}
          </ChipButton>
          <button v-if="hasMoreKeywords" type="button" class="expand-btn" @click="expandKeywords">
            +{{ Math.min(STEP, allKeywords.length - keywordsLimit) }}
          </button>
        </div>
      </div>

      <!-- 底部选项行 -->
      <div class="filter-footer">
        <div class="footer-options">
          <!-- includeInvalid 开关 -->
          <div class="option-item">
            <span class="option-label">显示无效作品</span>
            <NSwitch :value="filters.includeInvalid" size="small" @update:value="handleIncludeInvalidChange" />
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="footer-actions">
          <button v-if="hasAnyFilters" type="button" class="footer-btn danger" @click="clearAllFilters">清空筛选</button>
          <button type="button" class="footer-btn" @click="collapse">
            <svg class="collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span class="collapse-text">收起</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.filter-panel-wrapper {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 100;
}

.filter-panel {
  position: relative;
  padding: 1rem;
  background: var(--opz-bg-soft);
  border: 1px solid var(--opz-border);
  border-radius: 12px;
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.filter-panel.is-loading {
  pointer-events: none;
}

/* 加载遮罩 */
.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--opz-bg-soft);
  opacity: 0.7;
  border-radius: 12px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--opz-border);
  border-top-color: var(--opz-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 移动端遮罩和拖拽条（桌面端隐藏） */
.mobile-backdrop,
.mobile-drag-handle {
  display: none;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.filter-section + .filter-section {
  padding-top: 0.75rem;
  border-top: 1px solid var(--opz-border);
}

.section-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.relation-toggle {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--opz-border);
  border-radius: 6px;
  background: var(--opz-bg-base);
  color: var(--opz-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.relation-toggle:hover {
  border-color: var(--opz-primary);
  color: var(--opz-primary);
}

.relation-toggle.active {
  background: rgba(14, 165, 233, 0.1);
  border-color: var(--opz-primary);
  color: var(--opz-primary);
}

.relation-toggle :deep(svg) {
  width: 14px;
  height: 14px;
  display: block;
}

.relation-text {
  font-size: 0.7rem;
  font-weight: 600;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.expand-btn {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--opz-border);
  border-radius: 6px;
  background: transparent;
  color: var(--opz-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.expand-btn:hover {
  border-color: var(--opz-primary);
  color: var(--opz-primary);
}

/* 底部选项行 */
.filter-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--opz-border);
}

.footer-options {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 1;
  min-width: 0;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.option-label {
  font-size: 0.8125rem;
  color: var(--opz-text-secondary);
  white-space: nowrap;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.footer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--opz-border);
  border-radius: 8px;
  background: var(--opz-bg-base);
  color: var(--opz-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.footer-btn:hover {
  border-color: var(--opz-primary);
  color: var(--opz-primary);
  background: color-mix(in srgb, var(--opz-primary) 8%, var(--opz-bg-base));
}

.footer-btn.danger:hover {
  border-color: var(--opz-danger, #ef4444);
  color: var(--opz-danger, #ef4444);
  background: color-mix(in srgb, var(--opz-danger, #ef4444) 8%, var(--opz-bg-base));
}

.footer-btn svg {
  width: 14px;
  height: 14px;
}

/* 暗色主题 */
:root[data-theme='dark'] .filter-panel {
  background: var(--opz-bg-soft);
  border-color: var(--opz-border);
}

/* 移动端适配：底部抽屉 */
@media (max-width: 640px) {
  .filter-panel-wrapper {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  /* 半透明遮罩背景 */
  .mobile-backdrop {
    display: block;
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    animation: fade-in 0.2s ease-out;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .filter-panel {
    position: relative;
    max-width: none;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    padding: 0.5rem 1rem 1rem;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0));
    border-radius: 16px 16px 0 0;
    gap: 0.875rem;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
    animation: slide-up 0.25s ease-out;
  }

  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  /* 拖拽条 */
  .mobile-drag-handle {
    display: flex;
    justify-content: center;
    padding: 0.75rem 0;
    cursor: grab;
  }

  .drag-bar {
    width: 36px;
    height: 4px;
    background: var(--opz-border);
    border-radius: 2px;
  }

  .section-title {
    font-size: 0.75rem;
  }

  /* 移动端收起按钮：隐藏图标，只显示文字 */
  .collapse-icon {
    display: none;
  }

  .filter-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--opz-bg-soft);
    padding: 0.75rem 1rem;
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0));
    border-top: 1px solid var(--opz-border);
  }

  /* 给 filter-panel 底部留出 footer 的空间 */
  .filter-panel {
    padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0));
  }

  .footer-options {
    justify-content: space-between;
  }

  .option-label {
    font-size: 0.75rem;
  }

  .footer-actions {
    width: 100%;
    display: flex;
    gap: 0.75rem;
  }

  .footer-btn {
    flex: 1;
    padding: 0.625rem;
    font-size: 0.875rem;
  }
}
</style>
