import type { Kysely } from 'kysely';
import type { FollowRecord } from '@opz-hub/shared';
import type { DB } from '../../types/database.js';
import type { AuthorBasicInfo, FollowsRepository } from '../followsRepository.js';
import { wrapDbError } from '../../utils/dbErrors.js';

export class KyselyFollowsRepository implements FollowsRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async list(userId: string): Promise<FollowRecord[]> {
    return wrapDbError('KyselyFollowsRepository.list', async () => {
      const rows = await this.db
        .withSchema('web_app')
        .selectFrom('user_follows')
        .select(['author_id', 'created_at'])
        .where('follower_id', '=', userId)
        .orderBy('created_at', 'desc')
        .execute();

      return rows.map((row) => ({
        authorId: String(row.author_id),
        createdAt: row.created_at.toISOString(),
      }));
    });
  }

  async exists(userId: string, authorId: string): Promise<boolean> {
    return wrapDbError('KyselyFollowsRepository.exists', async () => {
      const row = await this.db
        .withSchema('web_app')
        .selectFrom('user_follows')
        .select('author_id')
        .where('follower_id', '=', userId)
        .where('author_id', '=', authorId)
        .executeTakeFirst();
      return row !== undefined;
    });
  }

  async insert(userId: string, authorId: string): Promise<void> {
    return wrapDbError('KyselyFollowsRepository.insert', async () => {
      await this.db
        .withSchema('web_app')
        .insertInto('user_follows')
        .values({
          follower_id: userId,
          author_id: authorId,
          created_at: new Date(),
        })
        .onConflict((oc) => oc.columns(['follower_id', 'author_id']).doNothing())
        .execute();
    });
  }

  async remove(userId: string, authorId: string): Promise<boolean> {
    return wrapDbError('KyselyFollowsRepository.remove', async () => {
      const result = await this.db
        .withSchema('web_app')
        .deleteFrom('user_follows')
        .where('follower_id', '=', userId)
        .where('author_id', '=', authorId)
        .executeTakeFirst();

      return Number(result.numDeletedRows ?? 0) > 0;
    });
  }

  async authorExists(authorId: string): Promise<boolean> {
    return wrapDbError('KyselyFollowsRepository.authorExists', async () => {
      // 检查作者是否在 posts_main 表中发过帖子
      const row = await this.db
        .selectFrom('posts_main')
        .select('author_id')
        .where('author_id', '=', authorId)
        .limit(1)
        .executeTakeFirst();
      return row !== undefined;
    });
  }

  async getAuthorBasicInfo(authorId: string): Promise<AuthorBasicInfo | null> {
    return wrapDbError('KyselyFollowsRepository.getAuthorBasicInfo', async () => {
      // 从 user_data 表获取作者基本信息
      const row = await this.db
        .selectFrom('user_data')
        .select(['user_id', 'user_username', 'user_nickname', 'user_global_name'])
        .where('user_id', '=', authorId)
        .executeTakeFirst();
      if (!row) return null;
      return {
        id: String(row.user_id),
        username: row.user_username,
        nickname: row.user_nickname ?? undefined,
        globalName: row.user_global_name ?? undefined,
      };
    });
  }
}
