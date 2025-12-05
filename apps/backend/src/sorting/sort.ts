export type SortField = 'weighted' | 'created' | 'updated' | 'likes';
export type SortOrder = 'asc' | 'desc';

export interface SortOption {
  field: SortField;
  order: SortOrder;
}

export interface SortConfig extends SortOption {
  degradationOffset?: number;
}

export const SORTABLE_FIELDS: SortField[] = ['weighted', 'created', 'updated', 'likes'];

export const DEFAULT_SORT_CONFIG: SortConfig = {
  field: 'weighted',
  order: 'desc',
  degradationOffset: 400,
};

export const DEFAULT_SORT_OPTION: SortOption = {
  field: DEFAULT_SORT_CONFIG.field,
  order: DEFAULT_SORT_CONFIG.order,
};

/**
 解析 Query 参数中的排序信息
 - 支持 `sort=created&order=asc`
 - 支持 `sort=created-asc`
 - 非法/缺失时回退到默认值
 */
export const parseSortFromQuery = (query: Record<string, unknown>): SortOption => {
  const rawSort = typeof query?.sort === 'string' ? query.sort : '';
  const rawOrder = typeof query?.order === 'string' ? query.order : '';

  const combined = rawSort.split('-');
  const candidateField = (combined[0] || rawSort).trim();
  const candidateOrder = (combined[1] || rawOrder).trim();

  const field = SORTABLE_FIELDS.includes(candidateField as SortField)
    ? (candidateField as SortField)
    : DEFAULT_SORT_CONFIG.field;
  const order = candidateOrder === 'asc' || candidateOrder === 'desc' ? (candidateOrder as SortOrder) : DEFAULT_SORT_CONFIG.order;

  return { field, order };
};

/**
 * 解析 `<field>-<order>` 形式的排序字符串，例如 `created-asc`
 */
export const parseSortParam = (rawSort: unknown): SortOption | undefined => {
  if (typeof rawSort !== 'string') return undefined;

  const [fieldPart, orderPart] = rawSort.split('-');
  const field = SORTABLE_FIELDS.includes(fieldPart as SortField) ? (fieldPart as SortField) : undefined;
  if (!field) return undefined;

  const candidateOrder = (orderPart || '').trim();
  const order: SortOrder = candidateOrder === 'asc' ? 'asc' : candidateOrder === 'desc' ? 'desc' : 'desc';

  return { field, order };
};

export const resolveSort = (sort?: SortOption): SortConfig => {
  if (!sort) {
    return { ...DEFAULT_SORT_CONFIG };
  }

  return {
    field: SORTABLE_FIELDS.includes(sort.field) ? sort.field : DEFAULT_SORT_CONFIG.field,
    order: sort.order === 'asc' ? 'asc' : 'desc',
    degradationOffset: DEFAULT_SORT_CONFIG.degradationOffset,
  };
};

/**
 * 将排序配置转换为 Meilisearch 的 sort 规则
 */
export const buildSearchSort = (sort: SortOption | undefined, fallback: string[]): string[] => {
  const cfg = resolveSort(sort);
  const order = cfg.order === 'asc' ? 'asc' : 'desc';

  switch (cfg.field) {
    case 'weighted':
      return [`messageCount:${order}`, `reactionCount:${order}`, `createdAt:${order}`];
    case 'created':
      return [`createdAt:${order}`];
    case 'updated':
      return [`lastActiveAt:${order}`, `createdAt:${order}`];
    case 'likes':
      return [`reactionCount:${order}`, `createdAt:${order}`];
    default:
      return fallback;
  }
};
