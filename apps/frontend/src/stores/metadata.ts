import { defineStore } from 'pinia';
import type { Channel, Tag, WordMeta } from '@opz-hub/shared';
import { fetchChannels, fetchChannelTags, fetchGlobalPopularTags } from '@/api/channels';
import { fetchHotWordsMeta as fetchHotWordsMetaApi } from '@/api/search';
import { fetchRecommendedTags } from '@/api/tags';
import { CHANNEL_FOLDING_THRESHOLD } from '@/utils/constants';

/**
 * 元数据缓存 Store
 *
 * 职责：缓存低频变动的元数据（channels、tags）以减少API请求
 * 策略：内存缓存 + TTL（1小时），页面刷新后失效
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface MetadataState {
  channels: CacheEntry<Channel[]> | null;
  channelTags: Record<string, CacheEntry<Tag[]>>;
  globalTags: CacheEntry<Tag[]> | null;
  wordMetaGlobal: CacheEntry<WordMeta[]> | null;
  wordMetaByChannel: Record<string, CacheEntry<WordMeta[]>>;
}

// 缓存有效期：1小时（毫秒）
const CACHE_TTL = 60 * 60 * 1000;
const DEFAULT_WORD_META_LIMIT = 2000;
const DEFAULT_WORD_META_PER_CHANNEL_LIMIT = 200;

function isCacheValid<T>(entry: CacheEntry<T> | null | undefined): boolean {
  if (!entry) return false;
  const now = Date.now();
  return now - entry.timestamp < CACHE_TTL;
}

/**
 * 按词频分数和排名对 WordMeta 进行排序
 * @param items WordMeta 数组
 * @returns 排序后的新数组（不修改原数组）
 */
export function sortWordMeta(items: WordMeta[]): WordMeta[] {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.rank - b.rank;
  });
}

export const useMetadataStore = defineStore('metadata', {
  state: (): MetadataState => ({
    channels: null,
    channelTags: {},
    globalTags: null,
    wordMetaGlobal: null,
    wordMetaByChannel: {},
  }),

  getters: {
    // 获取缓存的频道列表（如果有效）
    cachedChannels: (state): Channel[] | null => {
      return isCacheValid(state.channels) ? state.channels!.data : null;
    },

    // 获取缓存的标签列表（如果有效）
    cachedTagsForChannel:
      (state) =>
      (channelId: string): Tag[] | null => {
        const entry = state.channelTags[channelId];
        return isCacheValid(entry) && entry ? entry.data : null;
      },

    // 获取全站热门标签（如果有效）
    cachedGlobalTags: (state): Tag[] | null => {
      return isCacheValid(state.globalTags) ? state.globalTags!.data : null;
    },

    // 获取全站热词/标签元数据（如果有效）
    cachedWordMetaGlobal: (state): WordMeta[] | null => {
      return isCacheValid(state.wordMetaGlobal) ? state.wordMetaGlobal!.data : null;
    },

    // 获取频道热词/标签元数据（如果有效）
    cachedWordMetaForChannel:
      (state) =>
      (channelId: string): WordMeta[] | null => {
        const entry = state.wordMetaByChannel[channelId];
        return isCacheValid(entry) && entry ? entry.data : null;
      },

    // 主要展示频道（帖子数 >= 阈值）
    mainChannels(): Channel[] {
      const channels = this.cachedChannels;
      if (!channels) return [];
      return channels.filter((c) => (c.postCount ?? 0) >= CHANNEL_FOLDING_THRESHOLD);
    },

    // 折叠频道（帖子数 < 阈值）
    foldedChannels(): Channel[] {
      const channels = this.cachedChannels;
      if (!channels) return [];
      return channels.filter((c) => (c.postCount ?? 0) < CHANNEL_FOLDING_THRESHOLD);
    },
  },

  actions: {
    // 获取频道列表（带缓存）
    async getChannels(forceRefresh = false): Promise<Channel[]> {
      // 如果不强制刷新且缓存有效，直接返回缓存
      if (!forceRefresh && this.cachedChannels) {
        return this.cachedChannels;
      }

      // 否则请求API并更新缓存
      const data = await fetchChannels();
      this.channels = {
        data,
        timestamp: Date.now(),
      };

      return data;
    },

    // 获取指定频道的标签列表
    async getChannelTags(channelId: string, forceRefresh = false): Promise<Tag[]> {
      const cached = this.cachedTagsForChannel(channelId);
      if (!forceRefresh && cached) {
        return cached;
      }

      const data = await fetchChannelTags(channelId);
      this.channelTags[channelId] = {
        data,
        timestamp: Date.now(),
      };

      return data;
    },

    // 获取全站热门标签
    async getGlobalPopularTags(forceRefresh = false): Promise<Tag[]> {
      if (!forceRefresh && this.cachedGlobalTags) {
        return this.cachedGlobalTags;
      }

      const data = await fetchGlobalPopularTags();
      this.globalTags = {
        data,
        timestamp: Date.now(),
      };

      return data;
    },

    async loadHotWordsMeta(limit?: number, perChannelLimit?: number): Promise<void> {
      const resolvedLimit = typeof limit === 'number' ? limit : DEFAULT_WORD_META_LIMIT;
      const resolvedPerChannel =
        typeof perChannelLimit === 'number' ? perChannelLimit : DEFAULT_WORD_META_PER_CHANNEL_LIMIT;
      const { global, channels } = await fetchHotWordsMetaApi(resolvedLimit, resolvedPerChannel);
      const timestamp = Date.now();
      this.wordMetaGlobal = { data: sortWordMeta(global), timestamp };
      this.wordMetaByChannel = channels.reduce<Record<string, CacheEntry<WordMeta[]>>>((acc, channel) => {
        acc[channel.channelId] = { data: sortWordMeta(channel.items), timestamp };
        return acc;
      }, {});
    },

    async getGlobalWordMeta(options?: { limit?: number; perChannelLimit?: number; forceRefresh?: boolean }) {
      const forceRefresh = options?.forceRefresh ?? false;
      const isValid = isCacheValid(this.wordMetaGlobal);
      if (!forceRefresh && isValid) {
        return this.wordMetaGlobal!.data;
      }

      await this.loadHotWordsMeta(
        options?.limit ?? DEFAULT_WORD_META_LIMIT,
        options?.perChannelLimit ?? DEFAULT_WORD_META_PER_CHANNEL_LIMIT
      );
      return this.wordMetaGlobal?.data ?? [];
    },

    async getChannelWordMeta(
      channelId: string,
      options?: { limit?: number; perChannelLimit?: number; forceRefresh?: boolean }
    ): Promise<WordMeta[]> {
      const forceRefresh = options?.forceRefresh ?? false;
      const targetLimit = options?.limit ?? DEFAULT_WORD_META_LIMIT;
      const targetPerChannel = options?.perChannelLimit ?? DEFAULT_WORD_META_PER_CHANNEL_LIMIT;

      // 如果全局数据已加载且缓存有效，直接返回（频道数据来自同一请求）
      if (!forceRefresh && isCacheValid(this.wordMetaGlobal)) {
        const cached = this.cachedWordMetaForChannel(channelId);
        // 有缓存直接返回，无缓存回退到全局
        return cached ?? this.wordMetaGlobal!.data;
      }

      await this.loadHotWordsMeta(targetLimit, targetPerChannel);
      const refreshed = this.cachedWordMetaForChannel(channelId);
      if (refreshed) return refreshed;

      // 渠道未返回专属词元时回退到全局榜单
      return this.wordMetaGlobal?.data ?? [];
    },

    // 批量获取多个频道的标签（单次 API 请求）
    async getMultipleChannelTags(channelIds: string[], forceRefresh = false): Promise<Tag[]> {
      if (channelIds.length === 0) return [];

      // 检查缓存（仅当所有频道都有缓存时才使用）
      if (!forceRefresh) {
        const cachedResults: Tag[][] = [];
        let allCached = true;
        for (const channelId of channelIds) {
          const cached = this.cachedTagsForChannel(channelId);
          if (cached) {
            cachedResults.push(cached);
          } else {
            allCached = false;
            break;
          }
        }
        if (allCached) {
          return cachedResults.flat();
        }
      }

      // 使用批量 API 一次获取所有频道的标签
      const tags = await fetchRecommendedTags(channelIds);

      // 更新各频道的缓存
      const tagsByChannel = new Map<string, Tag[]>();
      for (const tag of tags) {
        const list = tagsByChannel.get(tag.channelId) ?? [];
        list.push(tag);
        tagsByChannel.set(tag.channelId, list);
      }
      const timestamp = Date.now();
      for (const [channelId, channelTags] of tagsByChannel) {
        this.channelTags[channelId] = { data: channelTags, timestamp };
      }

      return tags;
    },

    // 清除所有缓存
    clearCache() {
      this.channels = null;
      this.channelTags = {};
      this.globalTags = null;
      this.wordMetaGlobal = null;
      this.wordMetaByChannel = {};
    },

    // 清除指定频道的标签缓存
    clearChannelTagsCache(channelId: string) {
      delete this.channelTags[channelId];
    },
  },
});
