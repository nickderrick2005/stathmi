import type { Tag } from '@opz-hub/shared';
import { apiClient } from './client';

export function fetchRecommendedTags(channelIds: string[]) {
  const query: Record<string, string> = {};
  if (channelIds.length) {
    query.channelIds = channelIds.join(',');
  }

  return apiClient<Tag[]>('/tags/recommended', { query });
}

/**
 * 根据标签名列表批量查询标签信息（含频道）
 */
export function fetchTagsByNames(names: string[]): Promise<Tag[]> {
  if (names.length === 0) return Promise.resolve([]);
  return apiClient<Tag[]>('/tags/by-names', { query: { names: names.join(',') } });
}
