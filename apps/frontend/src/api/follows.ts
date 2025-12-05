import type { ChannelFollowResponse, FollowResponse, SuccessResponse, TagFollowResponse } from '@opz-hub/shared';
import { apiClient } from './client';

export function listFollows() {
  return apiClient<FollowResponse[]>('/follows');
}

export function listTagFollows() {
  return apiClient<TagFollowResponse[]>('/follows/tags');
}

export function followAuthor(authorId: string) {
  return apiClient<SuccessResponse>('/follows', {
    method: 'POST',
    body: { authorId },
  });
}

export function unfollowAuthor(authorId: string) {
  return apiClient<SuccessResponse>(`/follows/${authorId}`, {
    method: 'DELETE',
  });
}

export function followTag(tagId: string) {
  return apiClient<SuccessResponse>('/follows/tags', {
    method: 'POST',
    body: { tagId },
  });
}

export function unfollowTag(tagId: string) {
  return apiClient<SuccessResponse>(`/follows/tags/${tagId}`, {
    method: 'DELETE',
  });
}

// 频道关注 API
// TODO: 等待后端接口 /api/follows/channels
export function listChannelFollows() {
  return apiClient<ChannelFollowResponse[]>('/follows/channels');
}

export function followChannel(channelId: string) {
  return apiClient<SuccessResponse>('/follows/channels', {
    method: 'POST',
    body: { channelId },
  });
}

export function unfollowChannel(channelId: string) {
  return apiClient<SuccessResponse>(`/follows/channels/${channelId}`, {
    method: 'DELETE',
  });
}
