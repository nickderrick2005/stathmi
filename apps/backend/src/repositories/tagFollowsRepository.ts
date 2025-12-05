import type { Kysely, Transaction } from 'kysely';
import type { DB } from '../types/database.js';

export type TagFollowExecutor = Kysely<DB> | Transaction<DB>;

export interface TagFollowRow {
  tagId: string;
  createdAt: string;
}

export interface TagFollowsRepository {
  list(userId: string): Promise<TagFollowRow[]>;
  exists(userId: string, tagId: string): Promise<boolean>;
  insert(userId: string, tagId: string, executor?: TagFollowExecutor): Promise<void>;
  remove(userId: string, tagId: string): Promise<boolean>;
}
