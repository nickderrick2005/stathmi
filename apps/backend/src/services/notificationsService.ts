import type { MarkNotificationsReadResponse, NotificationListResult } from '@opz-hub/shared';
import type { NotificationsRepository } from '../repositories/notificationsRepository.js';

export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  public async list(userId: string, limit = 20, cursor?: string): Promise<NotificationListResult> {
    const items = await this.repository.list(userId, limit + 1, cursor);
    const hasMore = items.length > limit;
    return {
      items: hasMore ? items.slice(0, limit) : items,
      nextCursor: hasMore ? items[limit].id : undefined,
    };
  }

  public async countUnread(userId: string): Promise<number> {
    return this.repository.countUnread(userId);
  }

  public async markRead(userId: string, cursor?: string): Promise<MarkNotificationsReadResponse> {
    const processed = await this.repository.markReadUpTo(userId, cursor);
    if (processed === 0) {
      return { success: true };
    }
    return { success: true, lastReadAt: new Date().toISOString() };
  }
}
