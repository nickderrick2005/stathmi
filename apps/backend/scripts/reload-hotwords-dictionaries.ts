/**
 * 热重载热词词典
 *
 * 1. 重新加载所有词典文件（停用词、黑名单、映射）
 * 2. 清空 Redis 中的聚合数据
 * 3. 重新聚合热词
 */

import 'dotenv/config';
import pino from 'pino';
import { createDatabase } from '../src/services/db.js';
import { HotWordsService } from '../src/services/hotWordsService.js';
import { initializeRedis } from '../src/lib/redis.js';

const logger = pino({ transport: { target: 'pino-pretty' } });

async function main() {
  console.log('=== 热词词典热重载脚本 ===\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL 环境变量未设置');
  }

  const db = createDatabase(dbUrl);

  // 初始化 Redis
  const redis = await initializeRedis(logger);
  if (!redis) {
    console.error('Redis 不可用，无法执行热重载');
    process.exit(1);
  }

  const service = new HotWordsService(db);

  console.log('1. 重新加载词典文件...');
  console.log('2. 清空 Redis 聚合数据...');
  console.log('3. 重新聚合热词...\n');

  const startTime = Date.now();
  const result = await service.reloadAndReaggregate();
  const elapsed = Date.now() - startTime;

  console.log('=== 完成 ===');
  console.log(`停用词数量: ${result.stopWordsCount}`);
  console.log(`黑名单数量: ${result.blacklistCount}`);
  console.log(`耗时: ${elapsed}ms`);

  // 显示聚合后的热词数量
  const contentCount = await redis.zcard('hot:content:aggregated');
  const searchQueryCount = await redis.zcard('hot:search:query:aggregated');
  const searchTokensCount = await redis.zcard('hot:search:tokens:aggregated');

  console.log(`\n聚合结果:`);
  console.log(`  内容热词: ${contentCount}`);
  console.log(`  搜索热词(完整): ${searchQueryCount}`);
  console.log(`  搜索热词(分词): ${searchTokensCount}`);

  await db.destroy();
  redis.disconnect();
}

main().catch((err) => {
  console.error('执行失败:', err);
  process.exit(1);
});
