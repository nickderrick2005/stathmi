import { computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { useLocalStorage } from '@vueuse/core';
import { useFollowsStore } from './follows';

/**
 * Feed 筛选状态 Store
 *
 * 职责：管理 trending 和 following 页面的筛选条件
 * - 频道筛选（默认为用户关注的频道）
 * - 是否包含无效帖子
 *
 * 数据源：localStorage（自动持久化）
 */
export interface FeedFiltersState {
  trendingChannels: string[];
  followingChannels: string[];
  trendingIncludeInvalid: boolean;
  followingIncludeInvalid: boolean;
  // 标记是否已初始化默认频道（避免重复覆盖用户选择）
  trendingInitialized: boolean;
  followingInitialized: boolean;
}

const STORAGE_KEY = 'opz-feed-filters';

const DEFAULT_STATE: FeedFiltersState = {
  trendingChannels: [],
  followingChannels: [],
  trendingIncludeInvalid: false,
  followingIncludeInvalid: false,
  trendingInitialized: false,
  followingInitialized: false,
};

export const useFeedFiltersStore = defineStore('feedFilters', () => {
  const state = useLocalStorage<FeedFiltersState>(STORAGE_KEY, DEFAULT_STATE, {
    deep: true,
    listenToStorageChanges: true,
    mergeDefaults: true,
  });

  const followsStore = useFollowsStore();

  // 初始化：当关注频道加载完成后，设置默认筛选频道
  // - trending 默认"已关注"频道
  // - following 默认"全部"频道（空数组）
  watch(
    () => followsStore.hasLoadedChannels,
    (loaded) => {
      if (!loaded) return;

      const followedIds = Array.from(followsStore.followedChannelIds);

      // trending 默认已关注频道
      if (!state.value.trendingInitialized && followedIds.length > 0) {
        state.value.trendingChannels = followedIds;
        state.value.trendingInitialized = true;
      }
      // following 默认全部频道（空数组），只标记已初始化
      if (!state.value.followingInitialized) {
        state.value.followingChannels = [];
        state.value.followingInitialized = true;
      }
    },
    { immediate: true }
  );

  // Getters
  const trendingChannels = computed(() => state.value.trendingChannels);
  const followingChannels = computed(() => state.value.followingChannels);
  const trendingIncludeInvalid = computed(() => state.value.trendingIncludeInvalid);
  const followingIncludeInvalid = computed(() => state.value.followingIncludeInvalid);

  // 是否有激活的筛选条件（用于 UI 指示）
  const hasTrendingFilters = computed(
    () => state.value.trendingChannels.length > 0 || state.value.trendingIncludeInvalid
  );
  const hasFollowingFilters = computed(
    () => state.value.followingChannels.length > 0 || state.value.followingIncludeInvalid
  );

  // Actions
  function setTrendingChannels(channels: string[]) {
    state.value.trendingChannels = channels;
    state.value.trendingInitialized = true;
  }

  function setFollowingChannels(channels: string[]) {
    state.value.followingChannels = channels;
    state.value.followingInitialized = true;
  }

  function toggleTrendingChannel(channelId: string) {
    const index = state.value.trendingChannels.indexOf(channelId);
    if (index === -1) {
      state.value.trendingChannels.push(channelId);
    } else {
      state.value.trendingChannels.splice(index, 1);
    }
    state.value.trendingInitialized = true;
  }

  function toggleFollowingChannel(channelId: string) {
    const index = state.value.followingChannels.indexOf(channelId);
    if (index === -1) {
      state.value.followingChannels.push(channelId);
    } else {
      state.value.followingChannels.splice(index, 1);
    }
    state.value.followingInitialized = true;
  }

  function setTrendingIncludeInvalid(value: boolean) {
    state.value.trendingIncludeInvalid = value;
  }

  function setFollowingIncludeInvalid(value: boolean) {
    state.value.followingIncludeInvalid = value;
  }

  // 重置为关注频道
  function resetTrendingToFollowed() {
    state.value.trendingChannels = Array.from(followsStore.followedChannelIds);
    state.value.trendingInitialized = true;
  }

  function resetFollowingToFollowed() {
    state.value.followingChannels = Array.from(followsStore.followedChannelIds);
    state.value.followingInitialized = true;
  }

  // 清除所有频道筛选（显示全部）
  function clearTrendingChannels() {
    state.value.trendingChannels = [];
    state.value.trendingInitialized = true;
  }

  function clearFollowingChannels() {
    state.value.followingChannels = [];
    state.value.followingInitialized = true;
  }

  return {
    // State
    trendingChannels,
    followingChannels,
    trendingIncludeInvalid,
    followingIncludeInvalid,
    hasTrendingFilters,
    hasFollowingFilters,

    // Actions
    setTrendingChannels,
    setFollowingChannels,
    toggleTrendingChannel,
    toggleFollowingChannel,
    setTrendingIncludeInvalid,
    setFollowingIncludeInvalid,
    resetTrendingToFollowed,
    resetFollowingToFollowed,
    clearTrendingChannels,
    clearFollowingChannels,
  };
});
