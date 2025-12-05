import type { MarkNotificationsReadResponse, NotificationListResult, NotificationUnreadCount } from '@opz-hub/shared';
import { apiClient } from './client';

export interface NotificationListParams {
  limit?: number;
  cursor?: string;
}

export function listNotifications(params?: NotificationListParams) {
  const query: Record<string, string | number> = {};

  if (typeof params?.limit === 'number') {
    query.limit = params.limit;
  }

  if (params?.cursor) {
    query.cursor = params.cursor;
  }

  return apiClient<NotificationListResult>('/notifications', {
    query,
  });
}

export function fetchUnreadNotificationCount() {
  return apiClient<NotificationUnreadCount>('/notifications/unread');
}

export function markNotificationsRead(cursor?: string) {
  const body = cursor ? { cursor } : {};

  return apiClient<MarkNotificationsReadResponse>('/notifications/read', {
    method: 'POST',
    body,
  });
}
