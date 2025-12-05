import type { NotificationItem } from '@opz-hub/shared';

export interface NotificationsRepository {
  list(userId: string, limit: number, cursor?: string): Promise<NotificationItem[]>;
  countUnread(userId: string): Promise<number>;
  markReadUpTo(userId: string, cursor?: string): Promise<number>;
}
