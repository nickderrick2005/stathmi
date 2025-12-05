import type {
  AuthorAutocompleteResponse,
  PaginatedPosts,
  UserProfile,
  UserProfileExtended,
  UserProfileSort,
  UserSettings,
  UserNamesResponse,
} from '@opz-hub/shared';
import { apiClient } from './client';
import type { PaginationParams } from './posts';

// 用户帖子筛选参数
export interface UserPostsParams extends PaginationParams {
  channelId?: string;
  sort?: UserProfileSort;
}

export function fetchUserProfile(userId: string) {
  return apiClient<UserProfile>(`/users/${userId}`);
}

export function fetchUserPosts(userId: string, params?: UserPostsParams) {
  const query: Record<string, string | number> = {};

  if (typeof params?.limit === 'number') {
    query.limit = params.limit;
  }
  if (typeof params?.offset === 'number') {
    query.offset = params.offset;
  }
  if (params?.channelId) {
    query.channelId = params.channelId;
  }
  if (params?.sort) {
    query.sort = params.sort;
  }

  return apiClient<PaginatedPosts>(`/users/${userId}/posts`, { query });
}

export function fetchUserSettings() {
  return apiClient<UserSettings>('/user/settings');
}

export function updateUserSettings(payload: Partial<UserSettings>) {
  return apiClient<UserSettings>('/user/settings', {
    method: 'PUT',
    body: payload,
    // 重试1次
    retry: 1,
    retryDelay: 1000,
  });
}

// 关注 Feed 上次查看时间
export function fetchFollowingFeedViewedAt() {
  return apiClient<{ viewedAt: string | null }>('/me/following-feed-viewed-at');
}

export function updateFollowingFeedViewedAt(viewedAt: string) {
  return apiClient<{ success: boolean }>('/me/following-feed-viewed-at', {
    method: 'PUT',
    body: { viewedAt },
  });
}

// 更新用户性取向（不影响关注的频道）
export function updateUserOrientations(orientations: string[]) {
  return apiClient<{ success: boolean }>('/me/orientations', {
    method: 'PUT',
    body: { orientations },
  });
}

// 清除用户所有数据（settings, follows, favorites, blocks 等）
export function clearUserData() {
  return apiClient<{ success: boolean }>('/me/data', {
    method: 'DELETE',
    body: {}, // 显式发送空 body
  });
}

// 批量获取用户名称和角色信息
export function fetchUserNames(ids: string[]) {
  if (!ids.length) return Promise.resolve({ users: [] } as UserNamesResponse);
  return apiClient<UserNamesResponse>('/users/names', {
    method: 'POST',
    body: { ids },
  });
}

// 获取用户扩展资料（包含统计和推荐作品）
export function fetchUserProfileExtended(userId: string) {
  return apiClient<UserProfileExtended>(`/users/${userId}/profile`);
}

// 更新用户推荐作品
export function updateFeaturedPost(postId: string | null) {
  return updateUserSettings({ featuredPostId: postId });
}

// 作者自动补全
export function searchAuthors(query: string, limit = 10) {
  if (!query.trim()) {
    return Promise.resolve({ authors: [] } as AuthorAutocompleteResponse);
  }
  return apiClient<AuthorAutocompleteResponse>('/users/autocomplete', {
    query: { q: query, limit },
  });
}
