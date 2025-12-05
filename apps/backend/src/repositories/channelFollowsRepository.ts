import type { Kysely, Transaction } from 'kysely';
import type { DB } from '../types/database.js';

export type ChannelFollowExecutor = Kysely<DB> | Transaction<DB>;

export interface ChannelFollowRow {
  channelId: string;
  createdAt: string;
}

export interface ChannelFollowsRepository {
  list(userId: string): Promise<ChannelFollowRow[]>;
  exists(userId: string, channelId: string): Promise<boolean>;
  insert(userId: string, channelId: string, executor?: ChannelFollowExecutor): Promise<void>;
  remove(userId: string, channelId: string): Promise<boolean>;
  upsertMany(userId: string, channelIds: string[], executor?: ChannelFollowExecutor): Promise<void>;
}
