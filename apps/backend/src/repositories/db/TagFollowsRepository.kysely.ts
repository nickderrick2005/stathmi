import type { TagFollowExecutor, TagFollowRow, TagFollowsRepository } from '../tagFollowsRepository.js';
import { wrapDbError } from '../../utils/dbErrors.js';

const toIsoString = (value: Date | string | null | undefined): string => {
  if (!value) return new Date(0).toISOString();
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString();
};

export class KyselyTagFollowsRepository implements TagFollowsRepository {
  constructor(private readonly db: TagFollowExecutor) {}

  private resolveExecutor(executor?: TagFollowExecutor): TagFollowExecutor {
    return executor ?? this.db;
  }

  async list(userId: string): Promise<TagFollowRow[]> {
    return wrapDbError('KyselyTagFollowsRepository.list', async () => {
      const rows = await this.db
        .withSchema('web_app')
        .selectFrom('user_follow_tags as uft')
        .select(['uft.tag_id', 'uft.created_at'])
        .where('uft.user_id', '=', userId)
        .orderBy('uft.created_at', 'desc')
        .execute();

      return rows.map((row) => ({
        tagId: String(row.tag_id),
        createdAt: toIsoString(row.created_at as unknown as Date | string),
      }));
    });
  }

  async exists(userId: string, tagId: string): Promise<boolean> {
    return wrapDbError('KyselyTagFollowsRepository.exists', async () => {
      const row = await this.db
        .withSchema('web_app')
        .selectFrom('user_follow_tags')
        .select('tag_id')
        .where('user_id', '=', userId)
        .where('tag_id', '=', tagId)
        .executeTakeFirst();
      return Boolean(row);
    });
  }

  async insert(userId: string, tagId: string, executor?: TagFollowExecutor): Promise<void> {
    const db = this.resolveExecutor(executor);
    return wrapDbError('KyselyTagFollowsRepository.insert', async () => {
      await db
        .withSchema('web_app')
        .insertInto('user_follow_tags')
        .values({
          user_id: userId,
          tag_id: tagId,
        })
        .onConflict((oc) => oc.columns(['user_id', 'tag_id']).doNothing())
        .execute();
    });
  }

  async remove(userId: string, tagId: string): Promise<boolean> {
    return wrapDbError('KyselyTagFollowsRepository.remove', async () => {
      const result = await this.db
        .withSchema('web_app')
        .deleteFrom('user_follow_tags')
        .where('user_id', '=', userId)
        .where('tag_id', '=', tagId)
        .executeTakeFirst();

      return Number(result.numDeletedRows ?? 0) > 0;
    });
  }
}
