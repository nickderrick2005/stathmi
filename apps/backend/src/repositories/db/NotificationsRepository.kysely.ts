import type { Kysely, Selectable } from 'kysely';
import type { NotificationItem } from '@opz-hub/shared';
import type { DB, UserNotifications } from '../../types/database.js';
import type { NotificationsRepository } from '../notificationsRepository.js';
import { wrapDbError } from '../../utils/dbErrors.js';

type NotificationRow = Pick<
  Selectable<UserNotifications>,
  'id' | 'type' | 'post_id' | 'author_id' | 'is_read' | 'metadata' | 'created_at'
>;

const mapRowToNotification = (row: NotificationRow): NotificationItem => {
  return {
    id: String(row.id),
    type: row.type as NotificationItem['type'],
    postId: String(row.post_id),
    authorId: String(row.author_id),
    createdAt: row.created_at.toISOString(),
    isRead: row.is_read ?? false,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
};

export class KyselyNotificationsRepository implements NotificationsRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async list(userId: string, limit: number, cursor?: string): Promise<NotificationItem[]> {
    return wrapDbError('KyselyNotificationsRepository.list', async () => {
      let builder = this.db
        .withSchema('web_app')
        .selectFrom('user_notifications')
        .select(['id', 'type', 'post_id', 'author_id', 'is_read', 'metadata', 'created_at'])
        .where('user_id', '=', userId)
        .orderBy('created_at', 'desc')
        .limit(limit);

      if (cursor) {
        // cursor 在运行时就是 string，和 BigIntString SELECT 类型兼容
        builder = builder.where('id', '<', cursor as never);
      }

      const rows = await builder.execute();
      return rows.map(mapRowToNotification);
    });
  }

  async countUnread(userId: string): Promise<number> {
    return wrapDbError('KyselyNotificationsRepository.countUnread', async () => {
      const result = await this.db
        .withSchema('web_app')
        .selectFrom('user_notifications')
        .select((eb) => eb.fn.countAll<number>().as('value'))
        .where('user_id', '=', userId)
        .where('is_read', '=', false)
        .executeTakeFirst();
      return Number(result?.value ?? 0);
    });
  }

  async markReadUpTo(userId: string, cursor?: string): Promise<number> {
    return wrapDbError('KyselyNotificationsRepository.markReadUpTo', async () => {
      let builder = this.db
        .withSchema('web_app')
        .updateTable('user_notifications')
        .set({ is_read: true })
        .where('user_id', '=', userId)
        .where('is_read', '=', false);

      if (cursor) {
        builder = builder.where('id', '<=', cursor as never);
      }

      const result = await builder.executeTakeFirst();
      return Number(result.numUpdatedRows ?? 0);
    });
  }
}
