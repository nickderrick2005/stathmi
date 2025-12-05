import type { Post } from '@opz-hub/shared';

/**
 * 智能排序配置参数
 */
export interface SmartRankingConfig {
  /** 点赞权重（默认 3） */
  reactionWeight: number;
  /** 回复权重（默认 5） */
  messageWeight: number;
  /** 半衰期（小时，默认 168 = 7天） */
  halfLifeHours: number;
  /** 最小衰减值（防止老帖完全消失，默认 0.05） */
  minDecay: number;
  /** 推荐帖子加权倍数（默认 1.3） */
  recommendBoost: number;
}

/**
 * 默认智能排序配置
 */
export const DEFAULT_RANKING_CONFIG: SmartRankingConfig = {
  reactionWeight: 6, // 点赞权重更高（质量信号）
  messageWeight: 4, // 回复权重适中（讨论热度）
  halfLifeHours: 336, // 14天（更温和的衰减，让优质内容保持更久）
  minDecay: 0.1, // 提高最小衰减值，避免老帖完全消失
  recommendBoost: 1.5, // 加大推荐权重
};

/**
 * 平方根缩放函数（更好地区分高低互动）
 */
const sqrt1p = (x: number): number => Math.sqrt(1 + x);

/**
 * 计算单个帖子的智能分数
 *
 * @param post 帖子对象
 * @param config 排序配置
 * @param now 当前时间戳（毫秒）
 * @returns 智能分数
 */
export function calculateSmartScore(
  post: Post,
  config: SmartRankingConfig = DEFAULT_RANKING_CONFIG,
  now: number = Date.now()
): number {
  // 互动分数（平方根缩放，比对数更能区分高低互动，但仍能防止极端值）
  // 例如：sqrt(100) = 10, sqrt(10) = 3.16，差距 3.16x（对数只有 1.9x）
  const engagement =
    sqrt1p(post.reactionCount) * config.reactionWeight +
    sqrt1p(post.messageCount) * config.messageWeight;

  // 时间衰减（半衰期模型）
  const createdAt = new Date(post.createdAt).getTime();
  const ageHours = (now - createdAt) / (1000 * 3600);
  const decay = Math.pow(0.5, ageHours / config.halfLifeHours);
  const finalDecay = Math.max(decay, config.minDecay);

  // 推荐加权
  const boost = post.isRecommended ? config.recommendBoost : 1.0;

  // 最终分数（+2 防止全零）
  return (engagement + 2) * finalDecay * boost;
}

/**
 * 对帖子列表进行智能重排序
 *
 * @param posts 帖子列表
 * @param order 排序方向（'asc' | 'desc'）
 * @param config 排序配置
 * @param now 当前时间戳（毫秒）
 * @returns 重排序后的帖子列表
 */
export function rerank(
  posts: Post[],
  order: 'asc' | 'desc' = 'desc',
  config: SmartRankingConfig = DEFAULT_RANKING_CONFIG,
  now: number = Date.now()
): Post[] {
  // 计算每个帖子的分数
  const scored = posts.map((post) => ({
    post,
    score: calculateSmartScore(post, config, now),
  }));

  // 根据分数排序
  scored.sort((a, b) => {
    if (order === 'desc') {
      return b.score - a.score;
    }
    return a.score - b.score;
  });

  // 返回排序后的帖子列表
  return scored.map((item) => item.post);
}

/**
 * 候选集大小计算策略
 *
 * @param limit 分页限制
 * @param offset 分页偏移
 * @returns 候选集大小
 */
export function calculateCandidateSize(limit: number, offset: number): number {
  if (offset === 0) {
    // 策略 1：基础查询
    return Math.min(limit * 10, 500);
  }
  // 策略 2：分页查询
  return Math.min((offset + limit) * 3, 900);
}

/**
 * 判断是否需要降级（回退到单层 Meili 排序）
 *
 * @param offset 分页偏移
 * @param threshold 降级阈值（默认 400）
 * @returns 是否需要降级
 */
export function shouldDegrade(offset: number, threshold = 400): boolean {
  return offset > threshold;
}
