import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useLocalStorage } from '@vueuse/core';
import { toggleEntry, addUnique, removeEntry } from '@/utils/array-helpers';
import type { SearchTimeRange } from '@/types/search';

type Tag = string;
type Keyword = string;

export type FilterRelation = 'AND' | 'OR';

export interface ChannelFilterState {
  activeTags: Tag[];
  followedTags: Tag[];
  activeKeywords: Keyword[];
  followedKeywords: Keyword[];
  customKeywords: Keyword[];
  tagRelation: FilterRelation;
  keywordRelation: FilterRelation;
}

/**
 * 持久化筛选状态 (PersistentFilters)
 *
 * 职责：管理全局生效的筛选条件
 * - 频道/标签/关键词的激活、关注、屏蔽状态
 * - 时间范围筛选（用于 custom 数据源）
 * - 选中的频道列表
 *
 * 数据源：localStorage（通过 @vueuse/core 的 useLocalStorage 自动持久化）
 *
 * 使用场景：
 * - 首页 Feed 的 "custom" 数据源读取 selectedChannels、channelFilters、timeRange
 * - useContentFilter 读取 channelFilters 进行内容过滤
 *
 * 与 searchStore 的边界：
 * - 本 store：持久化的用户偏好筛选，跨页面保持
 * - searchStore：搜索页的临时筛选条件，与 URL query 同步，页面刷新后从 URL 恢复
 */
export interface PersistentFilterState {
  channelFilters: Record<string, ChannelFilterState>;
  categories: Tag[];
  selectedChannels: string[];
  selectedChannelTags: string[];
  timeRange: SearchTimeRange;
  customTimeFrom?: string | null;
  customTimeTo?: string | null;
  includeInvalid: boolean;
}

const createChannelFilterState = (): ChannelFilterState => ({
  activeTags: [],
  followedTags: [],
  activeKeywords: [],
  followedKeywords: [],
  customKeywords: [],
  tagRelation: 'OR',
  keywordRelation: 'OR',
});

const DEFAULT_STATE: PersistentFilterState = {
  channelFilters: {},
  categories: [],
  selectedChannels: [],
  selectedChannelTags: [],
  timeRange: 'all',
  customTimeFrom: null,
  customTimeTo: null,
  includeInvalid: false,
};

const STORAGE_KEY = 'opz-persistent-filters';

export const usePersistentFiltersStore = defineStore('persistentFilters', () => {
  // 使用 VueUse 的 useLocalStorage 自动持久化
  const state = useLocalStorage<PersistentFilterState>(STORAGE_KEY, DEFAULT_STATE, {
    deep: true,
    listenToStorageChanges: true,
    // 合并策略：确保嵌套对象的默认值
    mergeDefaults: (storageValue, defaults) => {
      const merged = { ...defaults, ...storageValue };
      // 规范化 channelFilters
      if (merged.channelFilters && typeof merged.channelFilters === 'object') {
        const normalized: Record<string, ChannelFilterState> = {};
        Object.entries(merged.channelFilters).forEach(([channelId, rawState]) => {
          if (!rawState || typeof rawState !== 'object') return;
          const s = rawState as Partial<ChannelFilterState>;
          normalized[channelId] = {
            activeTags: s.activeTags ?? [],
            followedTags: s.followedTags ?? [],
            activeKeywords: s.activeKeywords ?? [],
            followedKeywords: s.followedKeywords ?? [],
            customKeywords: s.customKeywords ?? [],
            tagRelation: s.tagRelation ?? 'OR',
            keywordRelation: s.keywordRelation ?? 'OR',
          };
        });
        merged.channelFilters = normalized;
      }
      return merged;
    },
  });

  // 判断是否有激活的筛选条件（不含屏蔽）
  const hasActiveFilters = computed(() => {
    // 选中了频道标签
    if (state.value.selectedChannelTags.length > 0) return true;
    // 时间范围不是全部
    if (state.value.timeRange !== 'all') return true;
    // 检查当前选中频道的激活标签或关键词
    const channels = state.value.selectedChannels;
    if (channels.length > 0) {
      // 只检查选中的频道
      for (const channelId of channels) {
        const channelState = state.value.channelFilters[channelId];
        if (channelState?.activeTags.length) return true;
        if (channelState?.activeKeywords.length) return true;
      }
    }
    return false;
  });

  // Getters
  const getTagState = (channelId: string, tag: string) => {
    const channelState = state.value.channelFilters[channelId];
    if (!channelState) return 'default';
    if (channelState.followedTags.includes(tag)) return 'followed';
    return 'default';
  };

  const getKeywordState = (channelId: string, keyword: string) => {
    const channelState = state.value.channelFilters[channelId];
    if (!channelState) return 'default';
    if (channelState.followedKeywords.includes(keyword)) return 'followed';
    return 'default';
  };

  // 自定义关键词池（用于前端过滤）
  const customKeywordPool = (channelId: string) => {
    const channelState = state.value.channelFilters[channelId];
    if (!channelState) return [];
    return channelState.customKeywords;
  };

  // Actions
  function ensureChannelFilters(channelId: string) {
    if (!channelId) {
      throw new Error('[filters] channelId is required for channel-scoped actions');
    }

    if (!state.value.channelFilters[channelId]) {
      state.value.channelFilters[channelId] = createChannelFilterState();
    }

    return state.value.channelFilters[channelId];
  }

  function toggleActiveTag(channelId: string, tag: string) {
    const channelState = ensureChannelFilters(channelId);
    channelState.activeTags = toggleEntry(channelState.activeTags, tag);
  }

  function toggleActiveKeyword(channelId: string, keyword: string) {
    const channelState = ensureChannelFilters(channelId);
    channelState.activeKeywords = toggleEntry(channelState.activeKeywords, keyword);
  }

  function followTag(channelId: string, tag: string) {
    const channelState = ensureChannelFilters(channelId);
    channelState.followedTags = addUnique(channelState.followedTags, tag);
  }

  function unfollowTag(channelId: string, tag: string) {
    const channelState = ensureChannelFilters(channelId);
    channelState.followedTags = removeEntry(channelState.followedTags, tag);
  }

  function followKeyword(channelId: string, keyword: string) {
    const channelState = ensureChannelFilters(channelId);
    channelState.followedKeywords = addUnique(channelState.followedKeywords, keyword);
  }

  function unfollowKeyword(channelId: string, keyword: string) {
    const channelState = ensureChannelFilters(channelId);
    channelState.followedKeywords = removeEntry(channelState.followedKeywords, keyword);
  }

  // 屏蔽时从激活列表中移除（实际屏蔽由 blocksStore 处理）
  function removeFromActive(channelId: string, type: 'tag' | 'keyword', value: string) {
    const channelState = ensureChannelFilters(channelId);
    if (type === 'tag') {
      channelState.activeTags = removeEntry(channelState.activeTags, value);
    } else {
      channelState.activeKeywords = removeEntry(channelState.activeKeywords, value);
    }
  }

  function addCustomKeyword(channelId: string, keyword: string) {
    const channelState = ensureChannelFilters(channelId);
    channelState.customKeywords = addUnique(channelState.customKeywords, keyword);
  }

  function removeCustomKeyword(channelId: string, keyword: string) {
    const channelState = ensureChannelFilters(channelId);
    channelState.customKeywords = removeEntry(channelState.customKeywords, keyword);
  }

  // 清空并设置单个标签（用于卡片点击快速筛选）
  function setActiveTag(channelId: string, tag: string) {
    const channelState = ensureChannelFilters(channelId);
    channelState.activeTags = [tag];
    channelState.activeKeywords = [];
  }

  // 清空并设置单个关键词（用于卡片点击快速筛选）
  function setActiveKeyword(channelId: string, keyword: string) {
    const channelState = ensureChannelFilters(channelId);
    channelState.activeTags = [];
    channelState.activeKeywords = [keyword];
  }

  function toggleTagRelation(channelId: string) {
    const channelState = ensureChannelFilters(channelId);
    channelState.tagRelation = channelState.tagRelation === 'AND' ? 'OR' : 'AND';
  }

  function toggleKeywordRelation(channelId: string) {
    const channelState = ensureChannelFilters(channelId);
    channelState.keywordRelation = channelState.keywordRelation === 'AND' ? 'OR' : 'AND';
  }

  function toggleCategory(category: string) {
    state.value.categories = toggleEntry(state.value.categories, category);
  }

  function updateSelectedChannels(channels: string[]) {
    state.value.selectedChannels = channels;
  }

  function updateSelectedChannelTags(tags: string[]) {
    state.value.selectedChannelTags = tags;
  }

  function setTimeRange(range: SearchTimeRange) {
    state.value.timeRange = range;
    if (range !== 'custom') {
      state.value.customTimeFrom = null;
      state.value.customTimeTo = null;
    }
  }

  function setCustomTimeRange(payload: { from?: string | null; to?: string | null }) {
    state.value.customTimeFrom = payload.from ?? null;
    state.value.customTimeTo = payload.to ?? null;
    state.value.timeRange = 'custom';
  }

  function setIncludeInvalid(value: boolean) {
    state.value.includeInvalid = value;
  }

  // 重置指定频道的激活筛选（不影响屏蔽和关注）
  function resetActiveFilters(channelId: string) {
    const channelState = state.value.channelFilters[channelId];
    if (channelState) {
      channelState.activeTags = [];
      channelState.activeKeywords = [];
    }
  }

  return {
    // 直接暴露响应式状态属性（方便模板访问）
    channelFilters: computed(() => state.value.channelFilters),
    categories: computed(() => state.value.categories),
    selectedChannels: computed(() => state.value.selectedChannels),
    selectedChannelTags: computed(() => state.value.selectedChannelTags),
    timeRange: computed(() => state.value.timeRange),
    customTimeFrom: computed(() => state.value.customTimeFrom),
    customTimeTo: computed(() => state.value.customTimeTo),
    includeInvalid: computed(() => state.value.includeInvalid),
    hasActiveFilters,

    // Getters
    getTagState,
    getKeywordState,
    customKeywordPool,

    // Actions
    ensureChannelFilters,
    toggleActiveTag,
    toggleActiveKeyword,
    followTag,
    unfollowTag,
    followKeyword,
    unfollowKeyword,
    removeFromActive,
    addCustomKeyword,
    removeCustomKeyword,
    setActiveTag,
    setActiveKeyword,
    toggleTagRelation,
    toggleKeywordRelation,
    toggleCategory,
    updateSelectedChannels,
    updateSelectedChannelTags,
    setTimeRange,
    setCustomTimeRange,
    setIncludeInvalid,
    resetActiveFilters,
  };
});
