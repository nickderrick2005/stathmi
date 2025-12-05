import { computed } from 'vue';
import type { Post } from '@opz-hub/shared';
import { usePersistentFiltersStore, type ChannelFilterState } from '@/stores/filters';
import { useBlocksStore } from '@/stores/blocks';
import { buildSearchText } from '@/utils/post-helpers';

const GLOBAL_CHANNEL_ID = 'global';

/**
 * 提供基于用户筛选设置的内容过滤逻辑
 * - 激活的标签/关键词：全局筛选，只显示匹配内容
 * - 屏蔽的标签/关键词：全局生效，不显示相关内容（来自 blocksStore，持久化到后端）
 * - 关注的标签/关键词：仅在"关注"流中生效，用于推荐
 */
const EMPTY_CHANNEL_FILTERS: ChannelFilterState = {
  activeTags: [],
  followedTags: [],
  activeKeywords: [],
  followedKeywords: [],
  customKeywords: [],
  tagRelation: 'OR',
  keywordRelation: 'OR',
};

export function useContentFilter() {
  const filterStore = usePersistentFiltersStore();
  const blocksStore = useBlocksStore();

  const channelFilters = computed(() => filterStore.channelFilters);

  function getChannelFilters(channelId: string): ChannelFilterState {
    return channelFilters.value[channelId] ?? EMPTY_CHANNEL_FILTERS;
  }

  function matchActiveTags(postTags: string[] | undefined, state: ChannelFilterState): boolean {
    if (!state.activeTags.length) return true;
    if (!postTags?.length) return false;
    return state.tagRelation === 'AND'
      ? state.activeTags.every((tag) => postTags.includes(tag))
      : postTags.some((tag) => state.activeTags.includes(tag));
  }

  function matchActiveKeywords(searchText: string, state: ChannelFilterState): boolean {
    if (!state.activeKeywords.length) return true;
    return state.keywordRelation === 'AND'
      ? state.activeKeywords.every((keyword) => searchText.includes(keyword.toLowerCase()))
      : state.activeKeywords.some((keyword) => searchText.includes(keyword.toLowerCase()));
  }

  /**
   * 判断帖子是否应该显示（全局过滤规则）
   */
  function shouldShowPost(post: Post): boolean {
    // 先检查全局屏蔽
    if (blocksStore.blockedPostsSet.has(post.id)) return false;
    if (blocksStore.blockedAuthorsSet.has(post.authorId)) return false;

    const channelState = getChannelFilters(post.categoryId);
    const globalState = getChannelFilters(GLOBAL_CHANNEL_ID);
    const searchText = buildSearchText(post);

    const matchesGlobalTags = matchActiveTags(post.tags, globalState);
    const matchesChannelTags = matchActiveTags(post.tags, channelState);
    if (!matchesGlobalTags || !matchesChannelTags) return false;

    const matchesGlobalKeywords = matchActiveKeywords(searchText, globalState);
    const matchesChannelKeywords = matchActiveKeywords(searchText, channelState);
    if (!matchesGlobalKeywords || !matchesChannelKeywords) return false;

    // 检查标签屏蔽（使用 blocksStore 缓存 Set）
    if (post.tags?.some((tag) => blocksStore.blockedTagsSet.has(tag))) return false;

    // 检查关键词屏蔽（全局来自 blocksStore，自定义关键词来自 filterStore）
    const allBlockedKeywords = [
      ...blocksStore.blockedKeywords,
      ...filterStore.customKeywordPool(post.categoryId),
    ];
    const hasBlockedKeyword = allBlockedKeywords.some((keyword) => searchText.includes(keyword.toLowerCase()));
    if (hasBlockedKeyword) return false;

    return true;
  }

  /**
   * 判断帖子是否匹配关注条件（用于"关注"流）
   */
  function hasFollowedMatch(post: Post, searchText?: string): boolean {
    const channelState = getChannelFilters(post.categoryId);
    const globalState = getChannelFilters(GLOBAL_CHANNEL_ID);
    const mergedFollowedTags = new Set([...globalState.followedTags, ...channelState.followedTags]);
    const mergedFollowedKeywords = [...globalState.followedKeywords, ...channelState.followedKeywords];

    if (post.tags?.some((tag) => mergedFollowedTags.has(tag))) return true;

    const text = searchText ?? buildSearchText(post);
    const hasKeyword = mergedFollowedKeywords.some((keyword) => text.includes(keyword.toLowerCase()));
    if (hasKeyword) return true;

    return false;
  }

  /**
   * 过滤帖子列表（应用全局过滤规则）
   * 批量过滤时预计算共享数据，避免重复计算
   * @returns 过滤后的帖子列表及其对应的搜索文本缓存
   */
  function filterPosts(posts: Post[]): Post[] {
    if (posts.length === 0) return [];

    // 获取全局屏蔽的缓存 Set（避免重复创建）
    const blockedPostsSet = blocksStore.blockedPostsSet;
    const blockedAuthorsSet = blocksStore.blockedAuthorsSet;
    const blockedTagsSet = blocksStore.blockedTagsSet;
    const globalBlockedKeywords = blocksStore.blockedKeywords;

    // 预计算全局过滤状态
    const globalState = getChannelFilters(GLOBAL_CHANNEL_ID);

    // 按 categoryId 分组预计算各频道的过滤状态
    const channelStateCache = new Map<string, ChannelFilterState>();
    const channelBlockedKeywordsCache = new Map<string, string[]>();

    function getCachedChannelState(categoryId: string): ChannelFilterState {
      let state = channelStateCache.get(categoryId);
      if (!state) {
        state = getChannelFilters(categoryId);
        channelStateCache.set(categoryId, state);
      }
      return state;
    }

    function getCachedCustomKeywords(categoryId: string): string[] {
      let keywords = channelBlockedKeywordsCache.get(categoryId);
      if (!keywords) {
        keywords = filterStore.customKeywordPool(categoryId);
        channelBlockedKeywordsCache.set(categoryId, keywords);
      }
      return keywords;
    }

    return posts.filter((post) => {
      // 先检查全局屏蔽
      if (blockedPostsSet.has(post.id)) return false;
      if (blockedAuthorsSet.has(post.authorId)) return false;

      const channelState = getCachedChannelState(post.categoryId);
      const searchText = buildSearchText(post);

      // 检查激活标签匹配
      if (!matchActiveTags(post.tags, globalState)) return false;
      if (!matchActiveTags(post.tags, channelState)) return false;

      // 检查激活关键词匹配
      if (!matchActiveKeywords(searchText, globalState)) return false;
      if (!matchActiveKeywords(searchText, channelState)) return false;

      // 检查屏蔽标签
      if (post.tags?.some((tag) => blockedTagsSet.has(tag))) return false;

      // 检查屏蔽关键词（全局来自 blocksStore，自定义来自 filterStore）
      const customKw = getCachedCustomKeywords(post.categoryId);
      const allBlockedKeywords = [...globalBlockedKeywords, ...customKw];
      if (allBlockedKeywords.some((keyword) => searchText.includes(keyword.toLowerCase()))) return false;

      return true;
    });
  }

  /**
   * 过滤关注的帖子列表（应用全局过滤 + 关注匹配）
   */
  function filterFollowedPosts(posts: Post[]): Post[] {
    if (posts.length === 0) return [];

    // 获取全局屏蔽的缓存 Set
    const blockedPostsSet = blocksStore.blockedPostsSet;
    const blockedAuthorsSet = blocksStore.blockedAuthorsSet;
    const blockedTagsSet = blocksStore.blockedTagsSet;
    const globalBlockedKeywords = blocksStore.blockedKeywords;

    const globalState = getChannelFilters(GLOBAL_CHANNEL_ID);
    const channelStateCache = new Map<string, ChannelFilterState>();
    const channelBlockedKeywordsCache = new Map<string, string[]>();

    function getCachedChannelState(categoryId: string): ChannelFilterState {
      let state = channelStateCache.get(categoryId);
      if (!state) {
        state = getChannelFilters(categoryId);
        channelStateCache.set(categoryId, state);
      }
      return state;
    }

    function getCachedCustomKeywords(categoryId: string): string[] {
      let keywords = channelBlockedKeywordsCache.get(categoryId);
      if (!keywords) {
        keywords = filterStore.customKeywordPool(categoryId);
        channelBlockedKeywordsCache.set(categoryId, keywords);
      }
      return keywords;
    }

    return posts.filter((post) => {
      // 全局屏蔽检查
      if (blockedPostsSet.has(post.id)) return false;
      if (blockedAuthorsSet.has(post.authorId)) return false;

      const channelState = getCachedChannelState(post.categoryId);
      // 计算一次 searchText，后续复用
      const searchText = buildSearchText(post);

      // 激活标签/关键词匹配
      if (!matchActiveTags(post.tags, globalState)) return false;
      if (!matchActiveTags(post.tags, channelState)) return false;
      if (!matchActiveKeywords(searchText, globalState)) return false;
      if (!matchActiveKeywords(searchText, channelState)) return false;

      // 屏蔽检查
      if (post.tags?.some((tag) => blockedTagsSet.has(tag))) return false;
      const customKw = getCachedCustomKeywords(post.categoryId);
      const allBlockedKeywords = [...globalBlockedKeywords, ...customKw];
      if (allBlockedKeywords.some((keyword) => searchText.includes(keyword.toLowerCase()))) return false;

      // 复用 searchText
      if (!hasFollowedMatch(post, searchText)) return false;

      return true;
    });
  }

  return {
    getChannelFilters,
    shouldShowPost,
    hasFollowedMatch,
    filterPosts,
    filterFollowedPosts,
  };
}
