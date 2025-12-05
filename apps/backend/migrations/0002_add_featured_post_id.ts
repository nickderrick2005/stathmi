import { type Kysely, sql } from 'kysely';

/**
 * 为 web_app.user_settings 增加 featured_post_id（用户代表作）
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('web_app.user_settings')
    .addColumn('featured_post_id', 'bigint')
    .execute();

  // 可选：为查询添加索引（按需启用）
  await sql`CREATE INDEX IF NOT EXISTS idx_user_settings_featured_post_id ON web_app.user_settings (featured_post_id)`.execute(
    db
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('web_app.user_settings').dropColumn('featured_post_id').execute();
  await sql`DROP INDEX IF EXISTS idx_user_settings_featured_post_id`.execute(db);
}
