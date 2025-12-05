// Kysely 数据库配置
import { Kysely, PostgresDialect, type Transaction } from 'kysely';
import { Pool } from 'pg';
import type { DB } from '../types/database.js';

// Re-export DB for convenience
export type { DB } from '../types/database.js';

export const createDatabase = (connectionString: string) => {
  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString,
      // 连接池配置
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }),
  });

  return new Kysely<DB>({
    dialect,
    // 开发环境可以打开查询日志
    log:
      process.env.NODE_ENV === 'development'
        ? (event) => {
            if (event.level === 'query') {
              console.log('SQL:', event.query.sql);
              console.log('Parameters:', event.query.parameters);
            }
          }
        : undefined,
  });
};

export const withTransaction = async <T>(db: Kysely<DB>, fn: (trx: Transaction<DB>) => Promise<T>): Promise<T> => {
  return db.transaction().execute((trx) => fn(trx));
};

// ===================================================================
// 使用示例
// ===================================================================

/*
// 1. 查询 Bot 的表（public schema，默认）
const posts = await db
  .selectFrom('posts_main')
  .selectAll()
  .where('is_deleted', '=', false)
  .limit(10)
  .execute();

// 2. 查询网站的表（web_app schema，需要加前缀）
const users = await db
  .selectFrom('web_app.users')
  .selectAll()
  .where('is_admin', '=', true)
  .execute();

// 3. JOIN 跨 schema 的表
const postsWithUserInfo = await db
  .selectFrom('posts_main')
  .innerJoin('user_data', 'posts_main.author_id', 'user_data.user_id')
  .leftJoin('web_app.users', 'posts_main.author_id', 'web_app.users.discord_id')
  .select([
    'posts_main.thread_id',
    'posts_main.title',
    'user_data.user_name',
    'web_app.users.avatar',
  ])
  .execute();

// 4. 插入网站表数据
await db
  .insertInto('web_app.users')
  .values({
    discord_id: 123456789n,
    username: 'test_user',
    avatar: 'https://cdn.discordapp.com/avatars/...',
    is_admin: false,
    created_at: new Date(),
    last_login: new Date(),
  })
  .execute();

// 5. 更新网站表数据
await db
  .updateTable('web_app.user_settings')
  .set({
    theme: 'dark',
    display_mode: 'waterfall',
    updated_at: new Date(),
  })
  .where('user_id', '=', 123456789n)
  .execute();

// 6. 使用事务
await db.transaction().execute(async (trx) => {
  // 插入用户
  await trx
    .insertInto('web_app.users')
    .values({
      discord_id: 123n,
      username: 'new_user',
      created_at: new Date(),
      last_login: new Date(),
      is_admin: false,
    })
    .execute();

  // 插入默认设置
  await trx
    .insertInto('web_app.user_settings')
    .values({
      user_id: 123n,
      preferred_tags: [],
      hidden_tags: [],
      blocked_authors: [],
      theme: 'auto',
      display_mode: 'list',
      pagination_style: 'scroll',
      updated_at: new Date(),
    })
    .execute();
});
*/
