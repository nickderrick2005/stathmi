// 搜索模式：作品搜索 / 作者搜索
export type SearchMode = 'posts' | 'authors';

// 搜索排序选项：与后端 SearchQueryParams['sort'] 保持一致
export const SEARCH_SORT_OPTIONS = [
  'weighted-desc',
  'weighted-asc',
  'created-desc',
  'created-asc',
  'updated-desc',
  'updated-asc',
  'likes-desc',
  'likes-asc',
] as const;
export const SEARCH_TIME_RANGE_OPTIONS = ['all', '7d', '30d', '90d', 'custom'] as const;

export type SearchSort = (typeof SEARCH_SORT_OPTIONS)[number];
export type SearchTimeRange = (typeof SEARCH_TIME_RANGE_OPTIONS)[number];

export type TagRelation = 'AND' | 'OR';

export interface SearchFilters {
  q: string;
  tags: string[];
  tagRelation: TagRelation; // 标签匹配逻辑
  selectedKeywords: string[]; // 选中的热词（合并到搜索关键词）
  category?: string; // 分类筛选（频道 ID）
  sort: SearchSort;
  timeRange: SearchTimeRange;
  customTimeFrom?: string | null; // ISO 字符串
  customTimeTo?: string | null; // ISO 字符串
  includeInvalid?: boolean; // 是否包含锁定和无数据作品
}
