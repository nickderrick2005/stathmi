import 'dotenv/config';
import { Redis } from 'ioredis';
import { createDatabase } from '../src/services/db.js';
import { HotWordsService } from '../src/services/hotWordsService.js';
import { initializeRedis } from '../src/lib/redis.js';

const BATCH_SIZE = 1000;

// 简单的 logger 适配
const logger = {
  info: (msg: string) => console.log(msg),
  warn: (msg: string) => console.warn(msg),
  error: (data: unknown, msg?: string) => console.error(msg, data),
} as any;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL required');

  const db = createDatabase(dbUrl);

  // 初始化 Redis
  const redis = await initializeRedis(logger);
  if (!redis) {
    console.error('Redis not available');
    process.exit(1);
  }

  const service = new HotWordsService(db);

  // 重置分析进度
  await redis.set('hot:content:last_analyzed_id', '0');
  console.log('Reset last_analyzed_id to 0');

  // 循环分析直到完成
  let iteration = 0;
  let lastId = '0';

  while (true) {
    const beforeId = await redis.get('hot:content:last_analyzed_id') || '0';
    await service.analyzeContentWords(BATCH_SIZE);
    const afterId = await redis.get('hot:content:last_analyzed_id') || '0';

    iteration++;
    console.log(`Iteration ${iteration}: analyzed up to ID ${afterId}`);

    if (afterId === beforeId) {
      console.log('No more posts to analyze');
      break;
    }
    lastId = afterId;
  }

  // 聚合
  console.log('Aggregating hot words...');
  await service.aggregateContentHotWords();
  console.log('Aggregation complete');

  // 检查结果
  const count = await redis.zcard('hot:content:aggregated');
  console.log(`Total hot words: ${count}`);

  await db.destroy();
  redis.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
