/**
 * 时间范围默认值工具函数
 *
 * 当用户选择"自定义"时间范围但未选择日期时，使用这些默认值
 */

/** 默认开始日期：2025-02-10 */
export const DEFAULT_TIME_FROM = '2025-02-10T00:00:00.000Z';

/** 获取昨天的日期对象（23:59:59） */
function getYesterdayDate(): Date {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);
  return yesterday;
}

/** 获取默认结束日期：昨天 */
export function getDefaultTimeTo(): string {
  return getYesterdayDate().toISOString();
}

/** 获取昨天日期的 timestamp（毫秒） */
export function getDefaultTimeToTimestamp(): number {
  return getYesterdayDate().getTime();
}

/** 默认开始日期的 timestamp（毫秒） */
export const DEFAULT_TIME_FROM_TS = new Date(DEFAULT_TIME_FROM).getTime();

/**
 * 获取自定义时间范围的实际值（应用默认值）
 * @param customFrom 用户选择的开始日期（可为空）
 * @param customTo 用户选择的结束日期（可为空）
 * @returns 应用默认值后的时间范围
 */
export function resolveCustomTimeRange(
  customFrom: string | null | undefined,
  customTo: string | null | undefined
): { timeFrom: string; timeTo: string } {
  return {
    timeFrom: customFrom || DEFAULT_TIME_FROM,
    timeTo: customTo || getDefaultTimeTo(),
  };
}

/**
 * 获取缓存用的日期 key（按日期精度）
 */
export function getTimeToCacheKey(customTo: string | null | undefined): string {
  if (customTo) return customTo;
  // 按日期缓存，避免每秒都产生新缓存（使用昨天）
  return getYesterdayDate().toISOString().slice(0, 10);
}
