/**
 * 诊断帖子内容和图片缺失问题
 *
 * 运行方式：
 *   cd apps/backend && npx tsx src/scripts/diagnose-content-missing.ts
 *
 * 功能：
 * 1. 统计数据库中 first_message_content 和 attachment_urls 为空的帖子
 * 2. 按时间段分析缺失情况
 * 3. 输出诊断报告
 */
import 'dotenv/config';
import { createDatabase } from '../services/db.js';
import { sql } from 'kysely';

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const db = createDatabase(databaseUrl);

  console.log(`\n🔍 诊断帖子内容和图片缺失问题...\n`);

  // ========================================
  // 1. 整体统计
  // ========================================
  console.log('📊 整体统计\n');

  const stats = await db
    .selectFrom('posts_main')
    .select([
      sql<number>`COUNT(*)`.as('total'),
      sql<number>`COUNT(*) FILTER (WHERE is_deleted = false)`.as('active'),
      sql<number>`COUNT(*) FILTER (WHERE first_message_content IS NULL OR first_message_content = '')`.as(
        'no_content'
      ),
      sql<number>`COUNT(*) FILTER (WHERE attachment_urls IS NULL OR attachment_urls::text = '[]' OR attachment_urls::text = 'null')`.as(
        'no_attachments'
      ),
      sql<number>`COUNT(*) FILTER (WHERE (first_message_content IS NULL OR first_message_content = '') AND is_deleted = false)`.as(
        'active_no_content'
      ),
    ])
    .executeTakeFirstOrThrow();

  console.log(`  总帖子数: ${stats.total}`);
  console.log(`  活跃帖子数 (未删除): ${stats.active}`);
  console.log(`  无内容的帖子数: ${stats.no_content} (${((Number(stats.no_content) / Number(stats.total)) * 100).toFixed(2)}%)`);
  console.log(`  无附件的帖子数: ${stats.no_attachments} (${((Number(stats.no_attachments) / Number(stats.total)) * 100).toFixed(2)}%)`);
  console.log(`  活跃但无内容的帖子: ${stats.active_no_content}`);

  // ========================================
  // 2. 按时间段分析（最近7天、最近30天）
  // ========================================
  console.log('\n📊 按时间段分析\n');

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const recentStats = await db
    .selectFrom('posts_main')
    .select([
      sql<number>`COUNT(*) FILTER (WHERE created_at >= ${sevenDaysAgo})`.as('last_7d_total'),
      sql<number>`COUNT(*) FILTER (WHERE created_at >= ${sevenDaysAgo} AND (first_message_content IS NULL OR first_message_content = ''))`.as(
        'last_7d_no_content'
      ),
      sql<number>`COUNT(*) FILTER (WHERE created_at >= ${thirtyDaysAgo})`.as('last_30d_total'),
      sql<number>`COUNT(*) FILTER (WHERE created_at >= ${thirtyDaysAgo} AND (first_message_content IS NULL OR first_message_content = ''))`.as(
        'last_30d_no_content'
      ),
    ])
    .executeTakeFirstOrThrow();

  console.log(`  最近 7 天:`);
  console.log(`    总帖子: ${recentStats.last_7d_total}`);
  console.log(`    无内容: ${recentStats.last_7d_no_content} (${((Number(recentStats.last_7d_no_content) / Math.max(Number(recentStats.last_7d_total), 1)) * 100).toFixed(2)}%)`);

  console.log(`  最近 30 天:`);
  console.log(`    总帖子: ${recentStats.last_30d_total}`);
  console.log(`    无内容: ${recentStats.last_30d_no_content} (${((Number(recentStats.last_30d_no_content) / Math.max(Number(recentStats.last_30d_total), 1)) * 100).toFixed(2)}%)`);

  // ========================================
  // 3. 采样最近无内容的帖子
  // ========================================
  console.log('\n📊 最近无内容的帖子示例\n');

  const samples = await db
    .selectFrom('posts_main')
    .select(['thread_id', 'title', 'created_at', 'first_message_content', 'attachment_urls'])
    .where('is_deleted', '=', false)
    .where((eb) =>
      eb.or([eb('first_message_content', 'is', null), eb('first_message_content', '=', '')])
    )
    .orderBy('created_at', 'desc')
    .limit(10)
    .execute();

  for (const post of samples) {
    console.log(`  帖子 ID: ${post.thread_id}`);
    console.log(`    标题: ${post.title?.slice(0, 40)}...`);
    console.log(`    创建时间: ${post.created_at}`);
    console.log(`    内容: ${post.first_message_content ? '有' : '❌ 无'}`);
    console.log(`    附件: ${post.attachment_urls ? JSON.stringify(post.attachment_urls) : '❌ 无'}`);
    console.log('');
  }

  // ========================================
  // 4. 诊断建议
  // ========================================
  console.log('='.repeat(60));
  console.log('\n📋 诊断建议\n');

  const recentNoContentRatio =
    Number(recentStats.last_7d_no_content) / Math.max(Number(recentStats.last_7d_total), 1);

  if (recentNoContentRatio > 0.5) {
    console.log('⚠️  最近 7 天超过 50% 的帖子缺少内容');
    console.log('   这通常意味着 Discord Bot 在写入数据时没有获取到首楼内容');
    console.log('   需要检查 Discord Bot 的数据采集逻辑');
    console.log('');
  }

  if (Number(stats.active_no_content) > 100) {
    console.log('⚠️  有大量活跃帖子缺少内容');
    console.log('   建议运行数据修复脚本，从 Discord 重新获取内容');
    console.log('');
  }

  console.log('📝 数据来源说明:');
  console.log('   - first_message_content: 由 Discord Bot 从帖子首楼获取并写入');
  console.log('   - attachment_urls: 由 Discord Bot 从帖子首楼的附件获取并写入');
  console.log('   - 如果这些字段为空，需要检查 Discord Bot 的数据采集逻辑');
  console.log('');

  await db.destroy();
};

main().catch((error) => {
  console.error('\n❌ 诊断脚本执行失败:', error);
  process.exit(1);
});
