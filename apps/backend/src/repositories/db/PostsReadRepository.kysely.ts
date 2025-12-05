import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { DB } from '../../types/database.js';
import { wrapDbError } from '../../utils/dbErrors.js';
import type { PostsReadRepository, PostTitle } from './postsReadRepository.js';
import { mapDbRowToPost, type PostDbRow } from '../../domain/post.js';

export class KyselyPostsReadRepository implements PostsReadRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async findById(id: string, includeInvalid = false) {
    return wrapDbError('KyselyPostsReadRepository.findById', async () => {
      let query = this.buildBaseQuery().where('p.thread_id', '=', id).where('p.is_deleted', '=', false);

      if (!includeInvalid) {
        query = query.where('p.is_valid', '=', true);
      }

      const row = await query.executeTakeFirst();
      return row ? mapDbRowToPost(row as PostDbRow) : null;
    });
  }

  async findByIds(ids: string[], includeInvalid = false) {
    return wrapDbError('KyselyPostsReadRepository.findByIds', async () => {
      if (ids.length === 0) {
        return [];
      }
      let query = this.buildBaseQuery().where('p.thread_id', 'in', ids).where('p.is_deleted', '=', false);

      if (!includeInvalid) {
        query = query.where('p.is_valid', '=', true);
      }

      const rows = await query.execute();
      return rows.map((row) => mapDbRowToPost(row as PostDbRow));
    });
  }

  async findByThreadOrMessageIds(ids: string[], includeInvalid = false) {
    return wrapDbError('KyselyPostsReadRepository.findByThreadOrMessageIds', async () => {
      const uniqueIds = Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));
      if (uniqueIds.length === 0) {
        return [];
      }

      let query = this.buildBaseQuery()
        .where('p.is_deleted', '=', false)
        .where((eb) =>
          eb.or([
            eb('p.thread_id', 'in', uniqueIds),
            eb('p.first_message_id', 'in', uniqueIds),
          ])
        );

      if (!includeInvalid) {
        query = query.where('p.is_valid', '=', true);
      }

      const rows = await query.execute();
      return rows.map((row) => mapDbRowToPost(row as PostDbRow));
    });
  }

  async listLatest(limit: number, offset: number, includeInvalid = false) {
    return wrapDbError('KyselyPostsReadRepository.listLatest', async () => {
      let query = this.buildBaseQuery()
        .where('p.is_deleted', '=', false)
        .orderBy('p.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      if (!includeInvalid) {
        query = query.where('p.is_valid', '=', true);
      }

      const rows = await query.execute();
      return rows.map((row) => mapDbRowToPost(row as PostDbRow));
    });
  }

  async count(includeInvalid = false): Promise<number> {
    return wrapDbError('KyselyPostsReadRepository.count', async () => {
      let query = this.db
        .selectFrom('posts_main as p')
        .select((eb) => eb.fn.countAll<number>().as('value'))
        .where('p.is_deleted', '=', false);

      if (!includeInvalid) {
        query = query.where('p.is_valid', '=', true);
      }

      const result = await query.executeTakeFirstOrThrow();
      return Number(result.value);
    });
  }

  private buildBaseQuery() {
    return this.db
      .selectFrom('posts_main as p')
      .leftJoin('user_data as u', 'p.author_id', 'u.user_id')
      .select([
        'p.thread_id',
        'p.title',
        'p.first_message_content',
        'p.author_id',
        'p.attachment_urls',
        'p.jump_url',
        'p.updated_jump_url',
        'p.tags',
        'p.channel_id',
        'p.channel_name',
        'p.created_at',
        'p.updated_at',
        'p.last_active_at',
        'p.reply_count',
        'p.reaction_count',
        'p.is_deleted',
        'p.is_valid',
        // 优先使用昵称/全局名，其次用户名
        sql<string>`COALESCE(u.user_nickname, u.user_global_name, u.user_username)`.as('user_name'),
        (eb) => eb.ref('u.user_avatar_url').as('user_avatar'),

        // 聚合用户的active角色IDs（转为TEXT避免bigint精度丢失）
        sql<unknown>`(
          SELECT COALESCE(json_agg(role_id::text), '[]'::json)
          FROM public.user_roles ur
          WHERE ur.user_id = p.author_id
          AND ur.is_active = true
        )`.as('user_discord_roles'),
      ]);
  }

  async getPostTitlesByIds(ids: string[]): Promise<PostTitle[]> {
    return wrapDbError('KyselyPostsReadRepository.getPostTitlesByIds', async () => {
      if (ids.length === 0) {
        return [];
      }

      const rows = await this.db
        .selectFrom('posts_main')
        .select(['thread_id', 'title'])
        .where('thread_id', 'in', ids)
        .where('is_deleted', '=', false)
        .execute();

      // 按请求顺序返回
      const map = new Map(rows.map((row) => [String(row.thread_id), row.title]));
      return ids
        .filter((id) => map.has(id))
        .map((id) => ({ id, title: map.get(id)! }));
    });
  }
}
