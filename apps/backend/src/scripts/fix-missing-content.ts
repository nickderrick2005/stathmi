/**
 * 修复缺失内容的帖子
 *
 * 运行方式：
 *   cd apps/backend && npx tsx src/scripts/fix-missing-content.ts [--dry-run] [--limit=100]
 *
 * 环境变量：
 *   DISCORD_BOT_TOKEN - Discord Bot Token（必需）
 *   DATABASE_URL - 数据库连接字符串（必需）
 *
 * 功能：
 * 1. 查找数据库中缺少内容的帖子
 * 2. 从 Discord API 获取首楼内容和附件
 * 3. 更新数据库
 * 4. 触发 Meilisearch 重新同步
 */
import 'dotenv/config';
import { createDatabase } from '../services/db.js';
import { createDiscordFetcher } from '../services/discordFetcher.js';
import { sql } from 'kysely';

const parseArgs = () => {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    limit: parseInt(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? '100', 10),
    daysBack: parseInt(args.find((arg) => arg.startsWith('--days='))?.split('=')[1] ?? '30', 10),
  };
};

const main = async () => {
  const { dryRun, limit, daysBack } = parseArgs();

  console.log(`\n🔧 修复缺失内容的帖子\n`);
  console.log(`模式: ${dryRun ? '检查模式 (dry-run)' : '修复模式'}`);
  console.log(`限制: ${limit} 条`);
  console.log(`时间范围: 最近 ${daysBack} 天`);

  // 检查环境变量
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const fetcher = createDiscordFetcher();
  if (!fetcher) {
    throw new Error('DISCORD_BOT_TOKEN is required');
  }

  const db = createDatabase(databaseUrl);
  const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  // 查找缺少内容的帖子
  console.log(`\n📊 查找缺少内容的帖子...\n`);

  const postsToFix = await db
    .selectFrom('posts_main')
    .select(['thread_id', 'first_message_id', 'title', 'created_at'])
    .where('is_deleted', '=', false)
    .where('created_at', '>=', cutoffDate)
    .where((eb) =>
      eb.or([eb('first_message_content', 'is', null), eb('first_message_content', '=', '')])
    )
    .orderBy('created_at', 'desc')
    .limit(limit)
    .execute();

  console.log(`找到 ${postsToFix.length} 个需要修复的帖子\n`);

  if (postsToFix.length === 0) {
    console.log('✅ 没有需要修复的帖子');
    await db.destroy();
    return;
  }

  if (dryRun) {
    console.log('📋 需要修复的帖子:');
    for (const post of postsToFix.slice(0, 20)) {
      console.log(`  - ${post.thread_id}: ${post.title?.slice(0, 40)}...`);
    }
    if (postsToFix.length > 20) {
      console.log(`  ... 还有 ${postsToFix.length - 20} 个`);
    }
    await db.destroy();
    return;
  }

  // 开始修复
  console.log('🔄 开始从 Discord 获取内容...\n');

  let fixed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < postsToFix.length; i++) {
    const post = postsToFix[i];
    process.stdout.write(`\r  进度: ${i + 1}/${postsToFix.length} (已修复: ${fixed}, 失败: ${failed})`);

    try {
      const content = await fetcher.fetchMessage(
        String(post.thread_id),
        String(post.first_message_id)
      );

      if (!content) {
        failed++;
        continue;
      }

      if (!content.content && content.attachmentUrls.length === 0) {
        // Discord 上也没有内容
        skipped++;
        continue;
      }

      // 更新数据库
      await db
        .updateTable('posts_main')
        .set({
          first_message_content: content.content || null,
          attachment_urls: JSON.stringify(content.attachmentUrls),
        })
        .where('thread_id', '=', post.thread_id)
        .execute();

      // 插入同步事件，触发 Meilisearch 重新同步
      await db
        .insertInto('web_app.post_sync_events' as any)
        .values({
          post_id: post.thread_id,
          action: 'UPDATE',
        })
        .execute();

      fixed++;
    } catch (error) {
      console.error(`\n❌ 修复帖子 ${post.thread_id} 失败:`, error);
      failed++;
    }
  }

  console.log(`\n\n✅ 修复完成!`);
  console.log(`  - 成功修复: ${fixed}`);
  console.log(`  - 失败: ${failed}`);
  console.log(`  - 跳过（Discord 上也没内容）: ${skipped}`);

  if (fixed > 0) {
    console.log(`\n📝 已触发 ${fixed} 个帖子的 Meilisearch 重新同步`);
    console.log('   如果 syncer 正在运行，内容会自动同步到搜索索引');
  }

  await db.destroy();
};

main().catch((error) => {
  console.error('\n❌ 修复脚本执行失败:', error);
  process.exit(1);
});
