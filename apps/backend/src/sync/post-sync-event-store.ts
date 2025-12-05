import type { Kysely } from 'kysely';
import type { DB } from '../types/database.js';
import type { SyncAction } from './post-sync-engine.js';

export interface SyncEvent {
  id: string;
  post_id: string;
  action: SyncAction;
  retries: number;
  last_error: string | null;
  created_at: Date;
}

const toSyncEvent = (row: unknown): SyncEvent => row as SyncEvent;

export class PostSyncEventStore {
  constructor(private readonly db: Kysely<DB>) {}

  async pollPostIds(limit: number, maxRetries: number): Promise<string[]> {
    const rows = await this.db
      .withSchema('web_app')
      .selectFrom('post_sync_events')
      .select(['post_id'])
      .where('retries', '<', maxRetries)
      .orderBy('created_at', 'asc')
      .limit(limit)
      .execute();

    const seen = new Set<string>();
    for (const row of rows) {
      const id = String((row as { post_id: unknown }).post_id);
      if (id) {
        seen.add(id);
      }
    }

    return Array.from(seen);
  }

  async getLatestEvent(postId: string, maxRetries: number): Promise<SyncEvent | null> {
    const row = await this.db
      .withSchema('web_app')
      .selectFrom('post_sync_events')
      .selectAll()
      .where('post_id', '=', postId)
      .where('retries', '<', maxRetries)
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirst();

    if (!row) return null;
    return toSyncEvent(row);
  }

  async ackUntil(postId: string, upToId: string | number): Promise<void> {
    await this.db
      .withSchema('web_app')
      .deleteFrom('post_sync_events')
      .where('post_id', '=', postId as never)
      .where('id', '<=', upToId as never)
      .execute();
  }

  async markFailed(eventId: string | number, nextRetries: number, error: unknown): Promise<void> {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error, null, 2);

    await this.db
      .withSchema('web_app')
      .updateTable('post_sync_events')
      .set({
        retries: nextRetries,
        last_error: message?.slice(0, 500) ?? null, // 避免异常过长
      })
      .where('id', '=', eventId as never)
      .execute();
  }
}
