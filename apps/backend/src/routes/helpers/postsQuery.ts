import type { SortOption } from '../../repositories/search/postsSearchRepository.js';
import { toNumber } from '../../utils/query.js';
import { parseSortFromQuery } from '../../sorting/sort.js';

export type ParsedPagination = { limit: number; offset: number; includeInvalid: boolean };

export const parsePagination = (query: Record<string, unknown>): ParsedPagination => {
  const limit = toNumber(query?.limit, 10);
  const offset = toNumber(query?.offset, 0);
  const includeInvalid = query?.include_invalid === 'true';
  return { limit, offset, includeInvalid };
};

export const parseSort = (query: Record<string, unknown>): SortOption => parseSortFromQuery(query);
