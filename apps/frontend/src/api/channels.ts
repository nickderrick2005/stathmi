import type { Channel, Tag } from '@opz-hub/shared';
import { apiClient } from './client';

// 获取所有分类（频道）列表
export async function fetchChannels(): Promise<Channel[]> {
  return apiClient<Channel[]>('/channels');
}

// 获取指定频道下的所有标签
export async function fetchChannelTags(channelId: string): Promise<Tag[]> {
  return apiClient<Tag[]>(`/channels/${channelId}/tags`);
}

// 获取全站热门标签
export async function fetchGlobalPopularTags(): Promise<Tag[]> {
  return apiClient<Tag[]>('/channels/tags/popular');
}
