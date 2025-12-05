<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NSwitch } from 'naive-ui';
import type { Tag } from '@opz-hub/shared';
import type { ChannelFilterState } from '@/stores/filters';
import { usePersistentFiltersStore } from '@/stores/filters';
import { useBlocksStore } from '@/stores/blocks';
import { getFeaturedTags, getHotKeywords } from '@/utils/filter-options';
import TimeRangeSelector from '@/components/filters/TimeRangeSelector.vue';
import FilterSection from '@/components/filters/FilterSection.vue';
import BlockedContentSection from '@/components/filters/BlockedContentSection.vue';
import type { SearchTimeRange } from '@/types/search';
import { notifySuccess, notifyError } from '@/utils/notifications';

const EMPTY_CHANNEL_FILTER_STATE: ChannelFilterState = {
  activeTags: [],
  followedTags: [],
  activeKeywords: [],
  followedKeywords: [],
  customKeywords: [],
  tagRelation: 'OR',
  keywordRelation: 'OR',
};

// 直接使用 store
const filtersStore = usePersistentFiltersStore();
const blocksStore = useBlocksStore();
const router = useRouter();
const route = useRoute();

const selectedChannelId = ref<string>('');
const featuredTags = ref<Tag[]>([]);
// 所有热词
const allKeywords = ref<string[]>([]);
const metaLoading = ref(false);
// 前端分页
const KEYWORDS_PAGE_SIZE = 20;
const currentKeywordsLimit = ref(KEYWORDS_PAGE_SIZE);

const GLOBAL_CHANNEL_ID = 'global';

// 当前频道的筛选状态
const currentChannelFilters = computed<ChannelFilterState>(() => {
  const targetId = selectedChannelId.value || GLOBAL_CHANNEL_ID;
  return filtersStore.channelFilters[targetId] ?? EMPTY_CHANNEL_FILTER_STATE;
});

// 当前频道 ID（用于传递给子组件）
const currentChannelId = computed(() => selectedChannelId.value || GLOBAL_CHANNEL_ID);

// 当前频道是否有激活的筛选
const hasActiveFiltersInChannel = computed(() => {
  const filters = currentChannelFilters.value;
  return filters.activeTags.length > 0 || filters.activeKeywords.length > 0;
});

// 将 Tag[] 转换为 FilterSection 需要的格式
const tagItems = computed(() => featuredTags.value.map((tag) => ({ id: tag.id, label: tag.name })));

// 标签描述
const tagDescription = computed(() => {
  return currentChannelId.value && currentChannelId.value !== GLOBAL_CHANNEL_ID
    ? '点击筛选，点X屏蔽，左上角切换匹配逻辑'
    : '全站热门标签,选择频道后精准筛选';
});

// 是否为特定频道（非全局）
const isChannelSelected = computed(() => {
  return Boolean(currentChannelId.value && currentChannelId.value !== GLOBAL_CHANNEL_ID);
});

// 当前显示的热词（前端分页）
const displayKeywords = computed(() => allKeywords.value.slice(0, currentKeywordsLimit.value));

// 是否还有更多热词可显示（仅特定频道）
const canLoadMoreKeywords = computed(() => {
  return isChannelSelected.value && currentKeywordsLimit.value < allKeywords.value.length;
});

async function loadWordMetaForChannel(channelId: string) {
  // 从 store 一次性获取所有热词（store 默认 200/频道）
  metaLoading.value = true;
  try {
    const [tags, keywords] = await Promise.all([getFeaturedTags(channelId), getHotKeywords(channelId)]);
    featuredTags.value = tags;
    allKeywords.value = keywords;
  } catch (error) {
    console.error('[PersistentFilters] Failed to load hot words meta', error);
    featuredTags.value = [];
    allKeywords.value = [];
  } finally {
    metaLoading.value = false;
  }
}

// 显示更多热词
function loadMoreKeywords() {
  currentKeywordsLimit.value += KEYWORDS_PAGE_SIZE;
}

watch(selectedChannelId, (channelId, previous) => {
  if (channelId === previous) return;
  // 频道变化时重置分页
  currentKeywordsLimit.value = KEYWORDS_PAGE_SIZE;
  loadWordMetaForChannel(channelId);
});

// 监听 store 的 selectedChannels 变化，自动同步
watch(
  () => filtersStore.selectedChannels,
  (newChannels) => {
    if (newChannels && newChannels.length > 0) {
      selectedChannelId.value = newChannels[0] ?? '';
    } else {
      selectedChannelId.value = ''; // 全部频道
    }
  },
  { immediate: true }
);

onMounted(async () => {
  // 初始加载标签（可能是特定频道，也可能是全局）
  await loadWordMetaForChannel(selectedChannelId.value);
});

// 先跳转再修改 store 确保 watch 能检测到变化
async function handleTagToggle(payload: { channelId: string; value: string }) {
  if (route.name !== 'custom') {
    await router.push({ name: 'custom' });
  }
  filtersStore.toggleActiveTag(payload.channelId, payload.value);
}

async function handleTagBlock(payload: { channelId: string; value: string }) {
  // 使用 blocksStore 进行全局屏蔽（持久化到后端）
  try {
    await blocksStore.blockTag(payload.value);
    // 同时从本地激活列表中移除
    filtersStore.removeFromActive(payload.channelId, 'tag', payload.value);
    notifySuccess('已屏蔽该标签');
  } catch {
    notifyError('屏蔽失败，请重试');
  }
}

async function handleTagUnblock(payload: { channelId: string; value: string }) {
  try {
    await blocksStore.unblockTag(payload.value);
    notifySuccess('已取消屏蔽');
  } catch {
    notifyError('操作失败，请重试');
  }
}

async function handleKeywordToggle(payload: { channelId: string; value: string }) {
  if (route.name !== 'custom') {
    await router.push({ name: 'custom' });
  }
  filtersStore.toggleActiveKeyword(payload.channelId, payload.value);
}

async function handleKeywordBlock(payload: { channelId: string; value: string }) {
  try {
    await blocksStore.blockKeyword(payload.value);
    filtersStore.removeFromActive(payload.channelId, 'keyword', payload.value);
    notifySuccess('已屏蔽该关键词');
  } catch {
    notifyError('屏蔽失败，请重试');
  }
}

async function handleKeywordUnblock(payload: { channelId: string; value: string }) {
  try {
    await blocksStore.unblockKeyword(payload.value);
    notifySuccess('已取消屏蔽');
  } catch {
    notifyError('操作失败，请重试');
  }
}

function handleTimeRangeChange(payload: {
  timeRange: SearchTimeRange;
  timeFrom?: string | null;
  timeTo?: string | null;
}) {
  if (payload.timeRange === 'custom') {
    filtersStore.setCustomTimeRange({ from: payload.timeFrom ?? null, to: payload.timeTo ?? null });
    return;
  }
  filtersStore.setTimeRange(payload.timeRange);
}

function handleToggleTagRelation(payload: { channelId: string }) {
  filtersStore.toggleTagRelation(payload.channelId);
}

function handleToggleKeywordRelation(payload: { channelId: string }) {
  filtersStore.toggleKeywordRelation(payload.channelId);
}

async function handleUnblockTag(payload: { channelId: string; tag: string }) {
  try {
    await blocksStore.unblockTag(payload.tag);
    notifySuccess('已取消屏蔽');
  } catch {
    notifyError('操作失败，请重试');
  }
}

async function handleUnblockKeyword(payload: { channelId: string; keyword: string }) {
  try {
    await blocksStore.unblockKeyword(payload.keyword);
    notifySuccess('已取消屏蔽');
  } catch {
    notifyError('操作失败，请重试');
  }
}

function handleRemoveCustomKeyword(payload: { channelId: string; keyword: string }) {
  filtersStore.removeCustomKeyword(payload.channelId, payload.keyword);
}

function handleAddCustomKeyword(payload: { channelId: string; keyword: string }) {
  filtersStore.addCustomKeyword(payload.channelId, payload.keyword);
}

function handleResetFilters() {
  filtersStore.resetActiveFilters(currentChannelId.value);
}
</script>

<template>
  <section class="persistent-filters">
    <!-- 重置筛选按钮 -->
    <button
      v-if="hasActiveFiltersInChannel"
      type="button"
      class="reset-btn"
      @click="handleResetFilters"
    >
      重置当前筛选
    </button>

    <!-- 时间范围选择器 -->
    <TimeRangeSelector
      :time-range="filtersStore.timeRange"
      :custom-from="filtersStore.customTimeFrom"
      :custom-to="filtersStore.customTimeTo"
      @change="handleTimeRangeChange"
    />

    <!-- 标签筛选区：特定频道全部显示 -->
    <FilterSection
      title="标签"
      :description="tagDescription"
      :items="tagItems"
      :active-items="currentChannelFilters.activeTags"
      :blocked-items="blocksStore.blockedTags"
      :loading="metaLoading"
      :channel-id="currentChannelId"
      :relation="currentChannelFilters.tagRelation"
      :skeleton-count="5"
      empty-text="暂无标签"
      :show-all="isChannelSelected"
      @toggle="handleTagToggle"
      @block="handleTagBlock"
      @unblock="handleTagUnblock"
      @toggle-relation="handleToggleTagRelation"
    />

    <!-- 关键词筛选区 -->
    <FilterSection
      title="热门关键词"
      description="点击筛选，点击 X 屏蔽"
      :items="displayKeywords"
      :active-items="currentChannelFilters.activeKeywords"
      :blocked-items="blocksStore.blockedKeywords"
      :loading="metaLoading"
      :channel-id="currentChannelId"
      :relation="currentChannelFilters.keywordRelation"
      :skeleton-count="3"
      empty-text="暂无热词"
      :show-all="isChannelSelected"
      :can-load-more="canLoadMoreKeywords"
      @toggle="handleKeywordToggle"
      @block="handleKeywordBlock"
      @unblock="handleKeywordUnblock"
      @toggle-relation="handleToggleKeywordRelation"
      @load-more="loadMoreKeywords"
    />

    <!-- 已屏蔽内容折叠区 -->
    <BlockedContentSection
      :blocked-tags="blocksStore.blockedTags"
      :blocked-keywords="blocksStore.blockedKeywords"
      :custom-keywords="currentChannelFilters.customKeywords"
      :channel-id="currentChannelId"
      @unblock-tag="handleUnblockTag"
      @unblock-keyword="handleUnblockKeyword"
      @remove-custom-keyword="handleRemoveCustomKeyword"
      @add-custom-keyword="handleAddCustomKeyword"
    />

    <!-- 显示无效作品开关 -->
    <div class="option-row">
      <span class="option-label">显示锁定和无数据作品</span>
      <NSwitch
        :value="filtersStore.includeInvalid"
        size="small"
        @update:value="filtersStore.setIncludeInvalid"
      />
    </div>
  </section>
</template>

<style scoped>
.persistent-filters {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-top: 1px solid var(--opz-border);
}

.option-label {
  font-size: 13px;
  color: var(--opz-text-primary);
}

.reset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.5rem 1rem;
  border: 1px solid var(--opz-warning, #f59e0b);
  border-radius: 8px;
  background: transparent;
  color: var(--opz-warning, #f59e0b);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-btn:hover {
  background: color-mix(in srgb, var(--opz-warning, #f59e0b) 10%, transparent);
}
</style>
