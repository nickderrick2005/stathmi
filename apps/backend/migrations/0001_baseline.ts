import { Kysely, sql } from 'kysely';

/**
 * 创建 web_app schema 和所有网站表
 *
 * 合并版本：包含所有 web_app 表的最终结构
 * 创建日期：2025-12-02
 */

export async function up(db: Kysely<any>): Promise<void> {
  // ===================================================================
  // 1. 创建 web_app schema
  // ===================================================================
  await sql`CREATE SCHEMA IF NOT EXISTS web_app`.execute(db);

  // ===================================================================
  // 2. 创建 web_app.users 表（用户基础信息）
  // ===================================================================
  await db.schema
    .createTable('web_app.users')
    .addColumn('discord_id', 'bigint', (col) => col.primaryKey())
    .addColumn('username', 'text', (col) => col.notNull())
    .addColumn('avatar', 'text')
    .addColumn('orientations', sql`text[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('discord_roles', sql`text[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('is_admin', 'boolean', (col) => col.defaultTo(false).notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`).notNull())
    .addColumn('last_login', 'timestamptz', (col) => col.defaultTo(sql`NOW()`).notNull())
    .addColumn('following_feed_viewed_at', 'timestamptz')
    .execute();

  await db.schema.createIndex('idx_users_last_login').on('web_app.users').column('last_login').execute();

  await db.schema
    .createIndex('idx_users_orientations')
    .on('web_app.users')
    .columns(['orientations'])
    .using('gin')
    .execute();

  await db.schema
    .createIndex('idx_users_discord_roles')
    .on('web_app.users')
    .columns(['discord_roles'])
    .using('gin')
    .execute();

  // ===================================================================
  // 3. 创建 web_app.user_follows 表（用户关注作者）
  // ===================================================================
  await db.schema
    .createTable('web_app.user_follows')
    .addColumn('follower_id', 'bigint', (col) => col.notNull())
    .addColumn('author_id', 'bigint', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`).notNull())
    .addPrimaryKeyConstraint('user_follows_pkey', ['follower_id', 'author_id'])
    .addForeignKeyConstraint('fk_follower', ['follower_id'], 'web_app.users', ['discord_id'], (cb) =>
      cb.onDelete('cascade')
    )
    .execute();

  await db.schema.createIndex('idx_user_follows_author_id').on('web_app.user_follows').column('author_id').execute();

  await db.schema.createIndex('idx_user_follows_created_at').on('web_app.user_follows').column('created_at').execute();

  // ===================================================================
  // 4. 创建 web_app.user_follow_tags 表（用户关注标签）
  // 使用 tag_id 作为主键，不再使用 tag_name
  // ===================================================================
  await db.schema
    .createTable('web_app.user_follow_tags')
    .addColumn('user_id', 'bigint', (col) => col.notNull())
    .addColumn('tag_id', 'bigint', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`).notNull())
    .addPrimaryKeyConstraint('user_follow_tags_pkey', ['user_id', 'tag_id'])
    .addForeignKeyConstraint('fk_user_follow_tags_user', ['user_id'], 'web_app.users', ['discord_id'], (cb) =>
      cb.onDelete('cascade')
    )
    .addForeignKeyConstraint('fk_user_follow_tags_tag', ['tag_id'], 'public.tags', ['tag_id'], (cb) =>
      cb.onDelete('cascade')
    )
    .execute();

  await db.schema.createIndex('idx_user_follow_tags_tag_id').on('web_app.user_follow_tags').column('tag_id').execute();

  // ===================================================================
  // 5. 创建 web_app.user_subarea_follows 表（子区关注记录）
  // ===================================================================
  await db.schema
    .createTable('web_app.user_subarea_follows')
    .addColumn('user_id', 'bigint', (col) => col.notNull())
    .addColumn('subarea_id', 'bigint', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().check(sql`status IN ('active', 'removed')`))
    .addColumn('added_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`).notNull())
    .addColumn('removed_at', 'timestamptz')
    .addPrimaryKeyConstraint('user_subarea_follows_pkey', ['user_id', 'subarea_id'])
    .addForeignKeyConstraint('fk_user_subarea_follows', ['user_id'], 'web_app.users', ['discord_id'], (cb) =>
      cb.onDelete('cascade')
    )
    .execute();

  await db.schema
    .createIndex('idx_user_subarea_follows_status')
    .on('web_app.user_subarea_follows')
    .column('status')
    .execute();

  // ===================================================================
  // 6. 创建 web_app.user_settings 表（用户设置）
  // 包含新增的 UI 偏好字段
  // ===================================================================
  await db.schema
    .createTable('web_app.user_settings')
    .addColumn('user_id', 'bigint', (col) => col.primaryKey())
    .addColumn('preferred_tags', sql`text[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('hidden_tags', sql`text[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('blocked_posts', sql`bigint[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('preferred_keywords', sql`text[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('hidden_keywords', sql`text[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('theme', 'text', (col) => col.defaultTo('auto'))
    .addColumn('custom_css', 'text')
    .addColumn('display_mode', 'text', (col) =>
      col.defaultTo('large').check(sql`display_mode IN ('list', 'large', 'minimal', 'waterfall')`)
    )
    .addColumn('pagination_style', 'text', (col) =>
      col.defaultTo('scroll').check(sql`pagination_style IN ('scroll', 'pages')`)
    )
    // 新增 UI 偏好字段
    .addColumn('image_load_mode', 'text', (col) =>
      col.defaultTo('all').check(sql`image_load_mode IN ('all', 'images-only', 'none')`)
    )
    .addColumn('discord_link_mode', 'text', (col) =>
      col.defaultTo('browser').check(sql`discord_link_mode IN ('app', 'browser')`)
    )
    .addColumn('card_title_font_offset', 'smallint', (col) =>
      col.defaultTo(0).check(sql`card_title_font_offset BETWEEN -3 AND 3`)
    )
    .addColumn('card_content_font_offset', 'smallint', (col) =>
      col.defaultTo(0).check(sql`card_content_font_offset BETWEEN -3 AND 3`)
    )
    .addColumn('author_role_color_enabled', 'boolean', (col) => col.defaultTo(true))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`).notNull())
    .addForeignKeyConstraint('fk_user_settings', ['user_id'], 'web_app.users', ['discord_id'], (cb) =>
      cb.onDelete('cascade')
    )
    .execute();

  // ===================================================================
  // 7. 创建 web_app.user_notifications 表（用户通知）
  // ===================================================================
  await db.schema
    .createTable('web_app.user_notifications')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('user_id', 'bigint', (col) => col.notNull())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('post_id', 'bigint', (col) => col.notNull())
    .addColumn('author_id', 'bigint', (col) => col.notNull())
    .addColumn('is_read', 'boolean', (col) => col.defaultTo(false))
    .addColumn('metadata', 'jsonb', (col) => col.defaultTo(sql`'{}'`))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`).notNull())
    .addForeignKeyConstraint('fk_user_notifications', ['user_id'], 'web_app.users', ['discord_id'], (cb) =>
      cb.onDelete('cascade')
    )
    .execute();

  // 复合索引：支持 WHERE user_id=? AND is_read=? ORDER BY created_at DESC 查询
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_notifications_unread
    ON web_app.user_notifications (user_id, is_read, created_at DESC)
  `.execute(db);

  // 部分索引：只索引未读通知
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_notifications_unread_only
    ON web_app.user_notifications (user_id, created_at DESC)
    WHERE is_read = false
  `.execute(db);

  // ===================================================================
  // 8. 创建 web_app.theme_presets 表（社区主题预设）
  // 存储 CSS 变量覆盖（JSONB 格式），而非完整 CSS 文本
  // 用途：官方或社区贡献的主题，所有用户可选用
  // ===================================================================
  await db.schema
    .createTable('web_app.theme_presets')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('description', 'text')
    .addColumn('variables', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'`))
    .addColumn('preview_url', 'text') // 可选：主题预览图
    .addColumn('author', 'text') // 可选：主题作者
    .addColumn('is_active', 'boolean', (col) => col.defaultTo(true))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`).notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`).notNull())
    .execute();

  // ===================================================================
  // 9. 创建 web_app.post_sync_events 表（同步事件队列）
  // ===================================================================
  await db.schema
    .createTable('web_app.post_sync_events')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('post_id', 'bigint', (col) => col.notNull())
    .addColumn('action', 'text', (col) => col.notNull().check(sql`action IN ('INSERT', 'UPDATE', 'DELETE')`))
    .addColumn('retries', 'smallint', (col) => col.defaultTo(0).notNull())
    .addColumn('last_error', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`).notNull())
    .execute();

  await db.schema
    .createIndex('idx_post_sync_events_post_id')
    .on('web_app.post_sync_events')
    .column('post_id')
    .execute();

  await db.schema
    .createIndex('idx_post_sync_events_retries')
    .on('web_app.post_sync_events')
    .columns(['retries', 'created_at'])
    .execute();

  // ===================================================================
  // 11. 创建触发器函数（跨 schema）
  // ===================================================================
  await sql`
    CREATE OR REPLACE FUNCTION web_app.enqueue_post_sync_event()
    RETURNS TRIGGER AS $$
    DECLARE
        post_id BIGINT;
    BEGIN
        -- 根据操作类型决定使用 NEW 还是 OLD
        IF (TG_OP = 'DELETE') THEN
            post_id := OLD.thread_id;
        ELSE
            post_id := NEW.thread_id;
        END IF;

        -- 插入同步事件
        INSERT INTO web_app.post_sync_events (post_id, action)
        VALUES (post_id, TG_OP);

        -- 发送 NOTIFY（Node.js 会监听此频道）
        PERFORM pg_notify('post_sync_channel', json_build_object(
            'postId', post_id::TEXT,
            'action', TG_OP
        )::TEXT);

        -- DELETE 操作返回 OLD，其他操作返回 NEW
        IF (TG_OP = 'DELETE') THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER
  `.execute(db);

  // ===================================================================
  // 12. 绑定触发器到 public.posts_main（注意跨 schema）
  // ===================================================================
  await sql`
    DROP TRIGGER IF EXISTS trigger_posts_sync ON public.posts_main
  `.execute(db);

  await sql`
    CREATE TRIGGER trigger_posts_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.posts_main
    FOR EACH ROW
    EXECUTE FUNCTION web_app.enqueue_post_sync_event()
  `.execute(db);

  // ===================================================================
  // 13. 插入默认数据
  // ===================================================================
  // 注意：主题功能暂未启用，默认主题已内置在前端 CSS 中
  // 将来启用社区主题功能时，可在此处插入官方主题预设示例：
  //
  // await db
  //   .insertInto('web_app.theme_presets')
  //   .values([
  //     {
  //       name: 'nord',
  //       description: 'Nord 主题',
  //       variables: {
  //         '--opz-primary': '#88c0d0',
  //         '--opz-bg-base': '#2e3440',
  //         '--opz-text-primary': '#eceff4'
  //       },
  //       is_active: true,
  //     },
  //   ])
  //   .onConflict((oc) => oc.column('name').doNothing())
  //   .execute();

  console.log('✅ Baseline migration completed: web_app schema and all tables created');
}

export async function down(db: Kysely<any>): Promise<void> {
  // 回滚：删除触发器、函数、整个 schema（CASCADE 删除所有表）
  await sql`DROP TRIGGER IF EXISTS trigger_posts_sync ON public.posts_main`.execute(db);
  await sql`DROP FUNCTION IF EXISTS web_app.enqueue_post_sync_event() CASCADE`.execute(db);
  await db.schema.dropSchema('web_app').cascade().execute();

  console.log('✅ Baseline migration rolled back: web_app schema and all tables dropped');
}
