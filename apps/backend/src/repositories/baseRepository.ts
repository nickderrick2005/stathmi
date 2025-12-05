import type { Kysely, SelectQueryBuilder, Transaction } from 'kysely';
import type { DB } from '../types/database.js';
import { RepositoryError } from '../utils/dbErrors.js';

export type Queryable = Kysely<DB> | Transaction<DB>;

export abstract class BaseRepository {
  constructor(protected readonly db: Queryable) {}

  protected paginate<TB extends keyof DB, O>(
    qb: SelectQueryBuilder<DB, TB, O>,
    pagination: { limit?: number; offset?: number }
  ): SelectQueryBuilder<DB, TB, O> {
    const { limit, offset } = pagination;
    const resolvedLimit = typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 20;
    const resolvedOffset =
      typeof offset === 'number' && Number.isFinite(offset) && offset >= 0 ? Math.trunc(offset) : 0;
    return qb.limit(resolvedLimit).offset(resolvedOffset);
  }

  protected ensureExists<T>(row: T | undefined, message: string): T {
    if (!row) {
      throw new RepositoryError('NOT_FOUND', message);
    }
    return row;
  }

  protected mapBigInt(value: string | bigint | null | undefined): string | null {
    if (value === null || typeof value === 'undefined') {
      return null;
    }
    return typeof value === 'bigint' ? value.toString() : value;
  }
}
