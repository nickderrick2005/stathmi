import type { Kysely } from 'kysely';
import type { DB } from '../../types/database.js';
import { wrapDbError } from '../../utils/dbErrors.js';

export class KyselyPostMembersRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listParticipatedThreadIds(
    userId: string,
    limit: number,
    offset: number,
    includeInvalid = false
  ): Promise<{ threadIds: string[]; total: number }> {
    return wrapDbError('KyselyPostMembersRepository.listParticipatedThreadIds', async () => {
      const base = this.db
        .selectFrom('post_members as pm')
        .innerJoin('posts_main as p', 'pm.thread_id', 'p.thread_id')
        .where('pm.user_id', '=', userId)
        .where('pm.is_leave', '=', false)
        .where('p.is_deleted', '=', false);

      const rowsPromise = (includeInvalid ? base : base.where('p.is_valid', '=', true))
        .select(['pm.thread_id', 'p.last_active_at'])
        .orderBy('p.last_active_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();

      const totalPromise = (includeInvalid ? base : base.where('p.is_valid', '=', true))
        .select((eb) => eb.fn.countAll<string>().as('value'))
        .executeTakeFirstOrThrow();

      const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);
      const threadIds = rows.map((row) => String(row.thread_id));
      const total = Number(totalRow.value);
      return { threadIds, total };
    });
  }

  // 查询传入的帖子 ID，而不是用户的全部参与记录
  async filterParticipatedThreadIds(userId: string, threadIds: string[]): Promise<Set<string>> {
    if (threadIds.length === 0) return new Set();

    return wrapDbError('KyselyPostMembersRepository.filterParticipatedThreadIds', async () => {
      const rows = await this.db
        .selectFrom('post_members')
        .select('thread_id')
        .where('user_id', '=', userId)
        .where('is_leave', '=', false)
        .where('thread_id', 'in', threadIds)
        .execute();

      return new Set(rows.map((row) => String(row.thread_id)));
    });
  }
}
