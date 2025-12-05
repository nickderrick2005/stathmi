import type { HotWordsMetaResponse, HotWordsResponse, SearchQueryParams, SearchResponse } from '@opz-hub/shared';
import { apiClient } from './client';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function searchPosts(params: SearchQueryParams = {}) {
  const query: Record<string, string | number> = {};

  if (isNonEmptyString(params.q)) {
    query.q = params.q.trim();
  }

  if (params.tags?.length) {
    query.tags = params.tags.join(',');
  }

  if (params.tagRelation === 'AND') {
    query.tagRelation = 'AND';
  }

  if (isNonEmptyString(params.category)) {
    query.category = params.category;
  }

  if (params.sort) {
    query.sort = params.sort;
  }

  if (params.timeRange && (params.timeRange !== 'all' || params.timeFrom || params.timeTo)) {
    query.timeRange = params.timeRange;
  }

  if (params.timeFrom) {
    query.timeFrom = params.timeFrom;
  }

  if (params.timeTo) {
    query.timeTo = params.timeTo;
  }

  if (typeof params.limit === 'number') {
    query.limit = params.limit;
  }

  if (typeof params.offset === 'number') {
    query.offset = params.offset;
  }

  if (params.includeInvalid) {
    query.includeInvalid = 'true';
  }

  return apiClient<SearchResponse>('/search', {
    query,
  });
}

export function fetchHotSearchQueries(limit?: number) {
  const query: Record<string, number> = {};
  if (typeof limit === 'number') query.limit = limit;
  return apiClient<HotWordsResponse>('/search/hot/search', { query });
}

export function fetchHotWordsMeta(limit?: number, perChannelLimit?: number) {
  const query: Record<string, number> = {};
  if (typeof limit === 'number') query.limit = limit;
  if (typeof perChannelLimit === 'number') query.perChannelLimit = perChannelLimit;
  return apiClient<HotWordsMetaResponse>('/search/hot', { query });
}
