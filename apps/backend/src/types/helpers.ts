// 数据库辅助类型定义
import type { ColumnType } from 'kysely';

/**
 * PostgreSQL BIGINT 在 node-postgres 中返回 string（避免 JavaScript Number 精度丢失）
 */
export type BigIntString = ColumnType<
  string, // SELECT 时返回 string
  string | bigint, // INSERT 时接受 string 或 bigint
  string | bigint // UPDATE 时接受 string 或 bigint
>;

/**
 * 时间戳字段 - 简化定义，避免 ColumnType 嵌套问题
 * SELECT 时返回 Date，INSERT/UPDATE 时接受 Date
 */
export type Timestamp = Date;

/**
 * 辅助类型：可插入的记录（排除自动生成字段）
 */
export type Insertable<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;

/**
 * 辅助类型：可更新的记录（部分字段）
 */
export type Updateable<T> = Partial<Insertable<T>>;
