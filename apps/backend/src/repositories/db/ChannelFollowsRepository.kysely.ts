import type {
  ChannelFollowExecutor,
  ChannelFollowRow,
  ChannelFollowsRepository,
} from '../channelFollowsRepository.js';
import { wrapDbError } from '../../utils/dbErrors.js';

export class KyselyChannelFollowsRepository implements ChannelFollowsRepository {
  constructor(private readonly db: ChannelFollowExecutor) {}

  private resolveExecutor(executor?: ChannelFollowExecutor): ChannelFollowExecutor {
    return executor ?? this.db;
  }

  async list(userId: string): Promise<ChannelFollowRow[]> {
    return wrapDbError('KyselyChannelFollowsRepository.list', async () => {
      const rows = await this.db
        .withSchema('web_app')
        .selectFrom('user_subarea_follows')
        .select(['subarea_id', 'added_at'])
        .where('user_id', '=', userId)
        .where('status', '=', 'active')
        .orderBy('added_at', 'desc')
        .execute();

      return rows.map((row) => ({
        channelId: row.subarea_id,
        createdAt: row.added_at.toISOString(),
      }));
    });
  }

  async exists(userId: string, channelId: string): Promise<boolean> {
    return wrapDbError('KyselyChannelFollowsRepository.exists', async () => {
      const row = await this.db
        .withSchema('web_app')
        .selectFrom('user_subarea_follows')
        .select('subarea_id')
        .where('user_id', '=', userId)
        .where('subarea_id', '=', channelId)
        .where('status', '=', 'active')
        .executeTakeFirst();
      return Boolean(row);
    });
  }

  async insert(userId: string, channelId: string, executor?: ChannelFollowExecutor): Promise<void> {
    const db = this.resolveExecutor(executor);
    return wrapDbError('KyselyChannelFollowsRepository.insert', async () => {
      const now = new Date();
      await db
        .withSchema('web_app')
        .insertInto('user_subarea_follows')
        .values({
          user_id: userId,
          subarea_id: channelId,
          status: 'active',
          added_at: now,
          removed_at: null,
        })
        .onConflict((oc) =>
          oc.columns(['user_id', 'subarea_id']).doUpdateSet({
            status: 'active',
            removed_at: null,
            added_at: now,
          })
        )
        .execute();
    });
  }

  async remove(userId: string, channelId: string): Promise<boolean> {
    return wrapDbError('KyselyChannelFollowsRepository.remove', async () => {
      // 使用软删除，将 status 设为 removed
      const result = await this.db
        .withSchema('web_app')
        .updateTable('user_subarea_follows')
        .set({
          status: 'removed',
          removed_at: new Date(),
        })
        .where('user_id', '=', userId)
        .where('subarea_id', '=', channelId)
        .where('status', '=', 'active')
        .executeTakeFirst();

      return Number(result.numUpdatedRows ?? 0) > 0;
    });
  }

  async upsertMany(userId: string, channelIds: string[], executor?: ChannelFollowExecutor): Promise<void> {
    if (channelIds.length === 0) {
      return;
    }
    const db = this.resolveExecutor(executor);
    return wrapDbError('KyselyChannelFollowsRepository.upsertMany', async () => {
      const now = new Date();
      await db
        .withSchema('web_app')
        .insertInto('user_subarea_follows')
        .values(
          channelIds.map((channelId) => ({
            user_id: userId,
            subarea_id: channelId,
            status: 'active' as const,
            added_at: now,
            removed_at: null,
          }))
        )
        .onConflict((oc) =>
          oc.columns(['user_id', 'subarea_id']).doUpdateSet({
            status: 'active',
            removed_at: null,
            added_at: now,
          })
        )
        .execute();
    });
  }
}
