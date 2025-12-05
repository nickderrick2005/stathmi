import crypto from 'crypto';
import type { PaginatedPosts, Post } from '@opz-hub/shared';
import { getSnapshotStore } from './storeFactory.js';
import type { SnapshotStore } from './types.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import type { SortOption } from '../repositories/search/postsSearchRepository.js';
import type { PostsSearchRepository } from '../repositories/search/postsSearchRepository.js';
import type { PostsService } from '../services/postsService.js';

const SNAPSHOT_TTL_SECONDS = Number(process.env.SNAPSHOT_TTL_SECONDS ?? 300);
const SNAPSHOT_LIMIT = Number(process.env.SNAPSHOT_LIMIT ?? 1200);

type TrendingPreferences =
  | {
      tags?: string[];
      channelIds?: string[];
      orientations?: string[];
    }
  | undefined;

const normalizeValues = (values: string[] | undefined): string[] =>
  Array.from(new Set((values ?? []).map((v) => v.trim()).filter(Boolean))).sort();

const buildPreferencesKey = (preferences: TrendingPreferences): string => {
  if (!preferences) return 'none';
  const parts: string[] = [];
  const channels = normalizeValues(preferences.channelIds);
  const tags = normalizeValues(preferences.tags);
  const orientations = normalizeValues(preferences.orientations);

  if (channels.length > 0) {
    parts.push(`ch=${channels.join(',')}`);
  }
  if (tags.length > 0) {
    parts.push(`tags=${tags.join(',')}`);
  }
  if (orientations.length > 0) {
    parts.push(`ori=${orientations.join(',')}`);
  }

  return parts.length > 0 ? parts.join('|') : 'none';
};

const toSortKey = (sort: SortOption | undefined, includeInvalid: boolean, extraKey?: string): string => {
  const field = sort?.field ?? 'weighted';
  const order = sort?.order ?? 'desc';
  const keySuffix = extraKey ? `:${extraKey}` : '';
  return `${field}:${order}:invalid=${includeInvalid ? '1' : '0'}${keySuffix}`;
};

const generateSnapshotId = (): string => crypto.randomBytes(8).toString('hex');

export class SnapshotService {
  constructor(
    private readonly postsSearchRepository: PostsSearchRepository,
    private readonly postsService: PostsService
  ) {
  }

  /**
   * 通用快照读取逻辑
   */
  async fetchWithSnapshot(params: {
    limit: number;
    cursor?: string | null;
    offset?: number;
    includeInvalid: boolean;
    sort?: SortOption;
    extraKey?: string;
    fetchSource: (limit: number) => Promise<PaginatedPosts>;
  }): Promise<{ posts: Post[]; total: number; nextCursor?: string }> {
    const store: SnapshotStore = getSnapshotStore();
    const sortKey = toSortKey(params.sort, params.includeInvalid, params.extraKey);
    const decoded = params.cursor ? decodeCursor(params.cursor) : null;
    const startPosition = decoded ? decoded.position : Math.max(0, params.offset ?? 0);

    if (decoded) {
      const slice = await store.getSlice(decoded.snapshotId, startPosition, startPosition + params.limit - 1);
      if (slice && slice.meta.sortKey === sortKey) {
        const posts = await this.fetchPostsByIds(slice.ids, params.includeInvalid);
        const nextPos = startPosition + params.limit;
        const hasMore = nextPos < slice.meta.total;
        const nextCursor = hasMore ? encodeCursor({ snapshotId: decoded.snapshotId, position: nextPos }) : undefined;
        return { posts, total: slice.meta.total, nextCursor };
      }
    }

    // 生成新快照
    const snapshotId = generateSnapshotId();
    const limit = SNAPSHOT_LIMIT;
    const { posts, total } = await params.fetchSource(limit);

    const uniqueIds = Array.from(new Set(posts.map((p) => p.id))).slice(0, limit);
    const expiresAt = Date.now() + SNAPSHOT_TTL_SECONDS * 1000;
    const snapshotTotal = Math.min(total, uniqueIds.length);
    await store.saveSnapshot(
      snapshotId,
      uniqueIds,
      { total: snapshotTotal, expiresAt, sortKey },
      SNAPSHOT_TTL_SECONDS
    );

    const firstPageIds = uniqueIds.slice(startPosition, startPosition + params.limit);
    const firstPagePosts = await this.fetchPostsByIds(firstPageIds, params.includeInvalid);
    const nextPos = startPosition + params.limit;
    const hasMore = nextPos < uniqueIds.length && nextPos < snapshotTotal;
    const nextCursor = hasMore ? encodeCursor({ snapshotId, position: nextPos }) : undefined;

    return { posts: firstPagePosts, total: snapshotTotal, nextCursor };
  }

  /**
   * 使用快照获取列表。若 cursor 无效/缺失则生成新快照。
   */
  async fetchTrendingWithSnapshot(
    params: {
      limit: number;
      cursor?: string | null;
      offset?: number;
      includeInvalid: boolean;
      sort?: SortOption;
      preferences?: TrendingPreferences;
    }
  ): Promise<{ posts: Post[]; total: number; nextCursor?: string }> {
    const prefKey = `pref=${buildPreferencesKey(params.preferences)}`;
    return this.fetchWithSnapshot({
      limit: params.limit,
      cursor: params.cursor,
      offset: params.offset,
      includeInvalid: params.includeInvalid,
      sort: params.sort,
      extraKey: prefKey,
      fetchSource: (limit) =>
        this.postsSearchRepository.listTrendingRecommended(
          params.preferences,
          limit,
          0,
          params.includeInvalid,
          params.sort
        ),
    });
  }

  private async fetchPostsByIds(ids: string[], includeInvalid: boolean): Promise<Post[]> {
    if (ids.length === 0) return [];
    const posts = await this.postsService.findByIds(ids, includeInvalid);
    const map = new Map(posts.map((p) => [p.id, p]));
    return ids.map((id) => map.get(id)).filter((p): p is Post => Boolean(p));
  }
}
