import type { PaginatedPosts, Post, FavoriteResponse, SearchSortParam, PostTitlesResponse } from '@opz-hub/shared';
import type { SearchTimeRange } from '@/types/search';
import { apiClient } from './client';

export interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
  channels?: string[];
  tags?: string[];
  tagRelation?: 'AND' | 'OR';
  keywords?: string[];
  keywordRelation?: 'AND' | 'OR';
  sort?: SearchSortParam;
  timeRange?: SearchTimeRange;
  timeFrom?: string;
  timeTo?: string;
  includeInvalid?: boolean;
}

function toPaginationQuery(params?: PaginationParams) {
  const query: Record<string, string | number> = {};

  if (typeof params?.limit === 'number') {
    query.limit = params.limit;
  }

  if (typeof params?.offset === 'number') {
    query.offset = params.offset;
  }

  if (typeof params?.cursor === 'string' && params.cursor) {
    query.cursor = params.cursor;
  }

  if (params?.channels?.length) {
    query.channels = params.channels.join(',');
  }

  if (params?.tags?.length) {
    query.tags = params.tags.join(',');
  }

  if (params?.tagRelation) {
    query.tagRelation = params.tagRelation;
  }

  if (params?.keywords?.length) {
    query.q = params.keywords.join(' ');
  }

  if (params?.keywordRelation) {
    query.keywordRelation = params.keywordRelation;
  }

  if (params?.sort) {
    query.sort = params.sort;
  }

  if (params?.timeRange && (params.timeRange !== 'all' || params.timeFrom || params.timeTo)) {
    query.timeRange = params.timeRange;
  }

  if (params?.timeFrom) {
    query.timeFrom = params.timeFrom;
  }

  if (params?.timeTo) {
    query.timeTo = params.timeTo;
  }

  if (params?.includeInvalid) {
    query.include_invalid = 'true';
  }

  return query;
}

// ============================================================================
// 工厂函数：创建分页帖子获取器
// ============================================================================

type PaginatedFetcher = (params?: PaginationParams) => Promise<PaginatedPosts>;

const createPaginatedFetcher = (endpoint: string): PaginatedFetcher => {
  return (params?: PaginationParams) =>
    apiClient<PaginatedPosts>(endpoint, {
      query: toPaginationQuery(params),
    });
};

/**
 * 收藏帖子获取器：将全量收藏转换为分页格式
 */
const createFavoritesFetcher = (): PaginatedFetcher => {
  return async (params?: PaginationParams): Promise<PaginatedPosts> => {
    const favorites = await apiClient<FavoriteResponse[]>('/favorites');
    // 按收藏时间降序排序
    const sorted = favorites.slice().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const posts = sorted.map((f) => f.post);
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 40;
    return {
      posts: posts.slice(offset, offset + limit),
      total: posts.length,
    };
  };
};

/**
 * 帖子数据源映射表
 * 键名与 PostSource 类型对应，值为对应的 API 获取函数
 */
export const postFetchers = {
  latest: createPaginatedFetcher('/posts/latest'),
  trending: createPaginatedFetcher('/posts/trending'),
  'trending-recommended': createPaginatedFetcher('/posts/trending/recommended'),
  'trending-new-hot': createPaginatedFetcher('/posts/trending/new-hot'),
  'trending-hidden-gems': createPaginatedFetcher('/posts/trending/hidden-gems'),
  following: createPaginatedFetcher('/posts/following'),
  'following-all': createPaginatedFetcher('/posts/following/all'),
  'following-authors': createPaginatedFetcher('/posts/following/authors'),
  'following-tags': createPaginatedFetcher('/posts/following/tags'),
  'following-discord': createPaginatedFetcher('/posts/following/discord'),
  'following-recent-updates': createPaginatedFetcher('/posts/following/recent-updates'),
  favorites: createFavoritesFetcher(),
  custom: createPaginatedFetcher('/posts/custom'),
} as const;

export type PostSourceKey = keyof typeof postFetchers;

// ============================================================================
// 向后兼容：导出独立函数（代理到 postFetchers）
// ============================================================================

export const fetchLatestPosts = postFetchers.latest;
export const fetchTrendingPosts = postFetchers.trending;
export const fetchTrendingRecommendedPosts = postFetchers['trending-recommended'];
export const fetchTrendingNewHotPosts = postFetchers['trending-new-hot'];
export const fetchTrendingHiddenGems = postFetchers['trending-hidden-gems'];
export const fetchFollowingPosts = postFetchers.following;
export const fetchFollowingAll = postFetchers['following-all'];
export const fetchFollowingAuthors = postFetchers['following-authors'];
export const fetchFollowingTags = postFetchers['following-tags'];
export const fetchFollowingDiscord = postFetchers['following-discord'];
export const fetchFollowingRecentUpdates = postFetchers['following-recent-updates'];
export const fetchCustomFeed = postFetchers.custom;

// ============================================================================
// 特殊获取器（需要动态路径参数）
// ============================================================================

export function fetchPostsByIds(ids: string[]) {
  if (!ids.length) {
    return Promise.resolve<Post[]>([]);
  }

  return apiClient<Post[]>('/posts', {
    query: { ids: ids.join(',') },
  });
}

export function fetchPostsByAuthor(authorId: string, params?: PaginationParams) {
  return apiClient<PaginatedPosts>(`/posts/author/${authorId}`, {
    query: toPaginationQuery(params),
  });
}

export function fetchPostsByChannel(channelId: string, params?: PaginationParams) {
  return apiClient<PaginatedPosts>(`/posts/channel/${channelId}`, {
    query: toPaginationQuery(params),
  });
}

export function fetchPostsByTag(tagName: string, params?: PaginationParams) {
  return apiClient<PaginatedPosts>(`/posts/tag/${tagName}`, {
    query: toPaginationQuery(params),
  });
}

// 批量获取旅程标题
export function fetchPostTitles(ids: string[]) {
  if (!ids.length) return Promise.resolve({ titles: [] } as PostTitlesResponse);
  return apiClient<PostTitlesResponse>('/posts/titles', {
    method: 'POST',
    body: { ids },
  });
}
