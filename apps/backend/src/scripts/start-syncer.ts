import 'dotenv/config';
import { createDatabase } from '../services/db.js';
import { startPostSync } from '../sync/start-post-sync.js';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const db = createDatabase(databaseUrl);
  const worker = await startPostSync(db, console);

  process.on('SIGINT', async () => {
    await worker.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[start-syncer] failed to start', error);
  process.exit(1);
});
