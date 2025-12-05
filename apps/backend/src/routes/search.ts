import type { FastifyPluginCallback } from 'fastify';
import type { SearchSortParam, TimeRangePreset } from '@opz-hub/shared';
import { appContext } from '../container.js';
import { toNumber, toStringArray } from '../utils/query.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { parseSortParam } from '../sorting/sort.js';

const parseTimeRange = (query: Record<string, unknown>) => {
  const preset = typeof query?.timeRange === 'string' ? (query.timeRange as TimeRangePreset) : 'all';
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const clampDate = (value?: string) => {
    if (!value) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  };

  if (preset === 'custom') {
    const from = clampDate(typeof query?.timeFrom === 'string' ? query.timeFrom : undefined);
    const to = clampDate(typeof query?.timeTo === 'string' ? query.timeTo : undefined);
    return { preset, from, to };
  }

  const map: Record<Exclude<TimeRangePreset, 'custom'>, { from?: string; to?: string }> = {
    all: {},
    '7d': { from: new Date(now - 7 * dayMs).toISOString() },
    '30d': { from: new Date(now - 30 * dayMs).toISOString() },
    '90d': { from: new Date(now - 90 * dayMs).toISOString() },
  };

  if (preset in map) {
    const { from, to } = map[preset as Exclude<TimeRangePreset, 'custom'>];
    return { preset, from, to };
  }

  return { preset: 'all' as TimeRangePreset, from: undefined, to: undefined };
};

const normalizeKeyList = (values: string[]): string =>
  Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort().join(',');

export const searchRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const { postsService, hotWordsService, feedsService, snapshotService } = appContext;

  app.get('/search', { preHandler: optionalAuthMiddleware }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const keyword = typeof query?.q === 'string' ? query.q : '';
    const tags = toStringArray(query?.tags);
    const tagRelation = query?.tagRelation === 'AND' ? 'AND' : 'OR';
    const category = typeof query?.category === 'string' ? query.category : undefined;
    const rawSort = query?.sort;
    const parsedSort = parseSortParam(rawSort);
    const sort = parsedSort ? (`${parsedSort.field}-${parsedSort.order}` as SearchSortParam) : undefined;
    const timeRange = parseTimeRange(query);
    // 若 custom 未提供日期范围，则等同于不做时间过滤
    const limit = toNumber(query?.limit, 10);
    const offset = toNumber(query?.offset, 0);
    const cursor = typeof query?.cursor === 'string' ? (query.cursor as string) : undefined;
    const includeInvalid = query?.includeInvalid === 'true';

    // 异步记录搜索（原句 + 分词）
    if (keyword.trim()) {
      hotWordsService.recordSearch(keyword).catch((err) => {
        request.log.error({ err }, 'Failed to record search');
      });
    }

    // 无关键词的 weighted 排序使用快照保持稳定
    if (parsedSort?.field === 'weighted' && !keyword.trim()) {
      const extraKeyParts = [
        'search',
        `tags=${normalizeKeyList(tags) || 'none'}`,
        `tagRel=${tagRelation}`,
        category ? `cat=${category}` : 'cat=all',
        `time=${timeRange.preset}`,
        timeRange.from ? `from=${timeRange.from}` : '',
        timeRange.to ? `to=${timeRange.to}` : '',
      ];
      const extraKey = extraKeyParts.filter(Boolean).join('|');

      const result = await snapshotService.fetchWithSnapshot({
        limit,
        cursor,
        offset,
        includeInvalid,
        sort: parsedSort,
        extraKey,
        fetchSource: (candidateLimit) =>
          postsService.search(
            {
              q: keyword,
              tags,
              tagRelation,
              category,
              sort,
              timeRange: timeRange.preset,
              timeFrom: timeRange.from,
              timeTo: timeRange.to,
              limit: candidateLimit,
              offset: 0,
            },
            includeInvalid
          ),
      });
      result.posts = await feedsService.markUserParticipation(result.posts, request.ctx?.userId);
      return reply.send({ query: keyword, ...result });
    }

    const result = await postsService.search(
      {
        q: keyword,
        tags,
        tagRelation,
        category,
        sort,
        limit,
        offset,
        timeRange: timeRange.preset,
        timeFrom: timeRange.from,
        timeTo: timeRange.to,
      },
      includeInvalid
    );
    result.posts = await feedsService.markUserParticipation(result.posts, request.ctx?.userId);
    return reply.send({ query: keyword, ...result });
  });

  // 热词/标签元数据（全站 + 按频道，合并词元）
  app.get('/search/hot', async (request, reply) => {
    const query = request.query as { limit?: unknown; perChannelLimit?: unknown };
    const limit = toNumber(query.limit, 20);
    const perChannelLimit = toNumber(query.perChannelLimit, 20);
    const result = await hotWordsService.getHotWordsMeta(limit, perChannelLimit);
    return reply.send(result);
  });

  app.get('/search/hot/search', async (request, reply) => {
    const { limit: rawLimit } = request.query as { limit?: unknown };
    const limit = toNumber(rawLimit, 10);
    const result = await hotWordsService.getHotSearch(limit);
    return reply.send(result);
  });

  done();
};
