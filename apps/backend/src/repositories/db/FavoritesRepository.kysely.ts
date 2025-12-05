import type { Kysely } from 'kysely';
import type { FavoriteRecord } from '@opz-hub/shared';
import type { DB } from '../../types/database.js';
import type { FavoritesRepository } from '../favoritesRepository.js';
import { wrapDbError } from '../../utils/dbErrors.js';

const DEFAULT_TYPE_NAME = '默认';

export class KyselyFavoritesRepository implements FavoritesRepository {
  constructor(private readonly db: Kysely<DB>) {}

  /**
   * 获取或创建默认收藏夹，返回 favorite_id
   */
  private async getOrCreateDefaultType(userId: string): Promise<string> {
    // 尝试获取已有的默认收藏夹
    const existing = await this.db
      .selectFrom('user_favorite_types')
      .select('favorite_id')
      .where('user_id', '=', userId)
      .where('type_name', '=', DEFAULT_TYPE_NAME)
      .executeTakeFirst();

    if (existing) {
      return String(existing.favorite_id);
    }

    // 创建默认收藏夹
    const inserted = await this.db
      .insertInto('user_favorite_types')
      .values({
        user_id: userId,
        type_name: DEFAULT_TYPE_NAME,
        created_at: new Date(),
      })
      .returning('favorite_id')
      .executeTakeFirstOrThrow();

    return String(inserted.favorite_id);
  }

  async list(userId: string): Promise<FavoriteRecord[]> {
    return wrapDbError('KyselyFavoritesRepository.list', async () => {
      const rows = await this.db
        .selectFrom('user_favorite_posts')
        .select(['thread_id', 'added_at'])
        .where('user_id', '=', userId)
        .orderBy('added_at', 'desc')
        .execute();

      return rows.map((row) => ({
        postId: String(row.thread_id),
        createdAt: row.added_at.toISOString(),
      }));
    });
  }

  async exists(userId: string, postId: string): Promise<boolean> {
    return wrapDbError('KyselyFavoritesRepository.exists', async () => {
      const row = await this.db
        .selectFrom('user_favorite_posts')
        .select('thread_id')
        .where('user_id', '=', userId)
        .where('thread_id', '=', postId)
        .executeTakeFirst();

      return row !== undefined;
    });
  }

  async insert(userId: string, postId: string): Promise<void> {
    return wrapDbError('KyselyFavoritesRepository.insert', async () => {
      const favoriteId = await this.getOrCreateDefaultType(userId);

      await this.db
        .insertInto('user_favorite_posts')
        .values({
          user_id: userId,
          thread_id: postId,
          favorite_as: favoriteId,
          favorite_type_name: DEFAULT_TYPE_NAME,
          added_at: new Date(),
        })
        .onConflict((oc) => oc.columns(['user_id', 'thread_id']).doNothing())
        .execute();
    });
  }

  async remove(userId: string, postId: string): Promise<boolean> {
    return wrapDbError('KyselyFavoritesRepository.remove', async () => {
      const result = await this.db
        .deleteFrom('user_favorite_posts')
        .where('user_id', '=', userId)
        .where('thread_id', '=', postId)
        .executeTakeFirst();

      return Number(result.numDeletedRows ?? 0) > 0;
    });
  }
}
