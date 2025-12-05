import type { Kysely } from 'kysely';
import type { DB } from '../types/database.js';
import { configurePostsIndex, createSearchClient } from '../services/search.js';
import { PostSyncEventStore } from './post-sync-event-store.js';
import { PostSyncEngine } from './post-sync-engine.js';
import { PostSyncWorker } from './post-sync-worker.js';
import { PostgresListener } from './postgres-listener.js';

type Logger = {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
};

const parseNumberEnv = (key: string, defaultValue: number): number => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
};

export const startPostSync = async (db: Kysely<DB>, logger: Logger) => {
  const concurrency = parseNumberEnv('MEILI_SYNC_CONCURRENCY', 8);
  const pollIntervalMs = parseNumberEnv('MEILI_SYNC_POLL_MS', 1000);
  const maxRetries = parseNumberEnv('MEILI_SYNC_MAX_RETRIES', 5);
  const channel = process.env.MEILI_SYNC_CHANNEL ?? 'post_sync_channel';

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for PostSync worker.');
  }

  const searchClient = createSearchClient();
  await configurePostsIndex(searchClient);

  const engine = new PostSyncEngine(db, searchClient);
  const store = new PostSyncEventStore(db);
  const listener = new PostgresListener(databaseUrl, channel, logger);

  const worker = new PostSyncWorker(store, engine, {
    concurrency,
    pollIntervalMs,
    maxRetries,
    listener,
    logger,
  });

  if (process.env.MEILI_SEED_ON_START === 'true') {
    logger.info?.('[PostSync] Seeding Meilisearch index from Postgres...');
    await engine.syncAllPosts();
    logger.info?.('[PostSync] Seed completed');
  }

  await worker.start();
  return worker;
};
