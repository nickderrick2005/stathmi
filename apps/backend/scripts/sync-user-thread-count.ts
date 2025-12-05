import 'dotenv/config';
import { createDatabase } from '../src/services/db.js';

/**
 * 同步用户创建帖子数
 *
 * 功能：
 * - 从 posts_main 统计每个作者的 is_valid = true 的帖子数
 * - 更新到 user_data.user_thread_count
 *
 * 使用：
 * - 运行：pnpm --filter @opz-hub/backend tsx scripts/sync-user-thread-count.ts
 */

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}
const db = createDatabase(dbUrl);

async function syncUserThreadCount() {
  console.log('开始同步用户帖子数...\n');

  // 统计每个作者的有效帖子数
  const authorCounts = await db
    .selectFrom('posts_main')
    .select(['author_id', db.fn.count<number>('thread_id').as('valid_count')])
    .where('is_valid', '=', true)
    .groupBy('author_id')
    .execute();

  console.log(`找到 ${authorCounts.length} 个作者有有效帖子\n`);

  let updated = 0;
  let notFound = 0;

  for (const { author_id, valid_count } of authorCounts) {
    // 更新 user_data 表
    const result = await db
      .updateTable('user_data')
      .set({ user_thread_count: Number(valid_count) })
      .where('user_id', '=', author_id)
      .executeTakeFirst();

    if (result.numUpdatedRows > 0n) {
      updated++;
    } else {
      notFound++;
    }

    // 进度报告
    if ((updated + notFound) % 100 === 0) {
      console.log(`进度: ${updated + notFound}/${authorCounts.length}`);
    }
  }

  // 将没有有效帖子的用户的 thread_count 设为 0
  const resetResult = await db
    .updateTable('user_data')
    .set({ user_thread_count: 0 })
    .where(
      'user_id',
      'not in',
      authorCounts.map((a) => a.author_id)
    )
    .where('user_thread_count', '>', 0)
    .executeTakeFirst();

  console.log('\n=== 同步完成 ===');
  console.log(`更新成功: ${updated}`);
  console.log(`用户不存在: ${notFound}`);
  console.log(`重置为0: ${resetResult.numUpdatedRows}`);
}

syncUserThreadCount()
  .then(async () => {
    console.log('\n✅ 完成!');
    await db.destroy();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('\n❌ 同步失败:', error);
    await db.destroy();
    process.exit(1);
  });
