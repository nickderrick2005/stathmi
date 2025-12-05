import type { PaginatedPosts, Post, SearchQueryParams } from '@opz-hub/shared';
import type { SortOption } from '../../sorting/sort.js';
export type { SortField, SortOrder, SortOption } from '../../sorting/sort.js';

export interface PostsSearchRepository {
  listLatest(limit: number, offset: number, includeInvalid?: boolean, sort?: SortOption): Promise<PaginatedPosts>;
  findByIds(ids: string[], includeInvalid?: boolean): Promise<Post[]>;
  findById(id: string, includeInvalid?: boolean): Promise<Post | null>;
  listByAuthor(
    authorId: string,
    limit: number,
    offset: number,
    includeInvalid?: boolean,
    channelId?: string,
    sort?: SortOption
  ): Promise<PaginatedPosts>;
  listByAuthors(
    authorIds: string[],
    limit: number,
    offset: number,
    sortByUpdated?: boolean,
    includeInvalid?: boolean,
    sort?: SortOption
  ): Promise<PaginatedPosts>;
  listByChannel(channelId: string, limit: number, offset: number, includeInvalid?: boolean): Promise<PaginatedPosts>;
  listByTag(tagName: string, limit: number, offset: number, includeInvalid?: boolean): Promise<PaginatedPosts>;
  listByTags(
    tagNames: string[],
    limit: number,
    offset: number,
    sortByUpdated?: boolean,
    includeInvalid?: boolean,
    sort?: SortOption
  ): Promise<PaginatedPosts>;
  listByAuthorsOrTags(
    authorIds: string[],
    tagNames: string[],
    limit: number,
    offset: number,
    sortByUpdated?: boolean,
    includeInvalid?: boolean,
    sort?: SortOption
  ): Promise<PaginatedPosts>;
  listByIds(ids: string[], limit: number, offset: number, includeInvalid?: boolean): Promise<PaginatedPosts>;
  search(params: SearchQueryParams, includeInvalid?: boolean): Promise<PaginatedPosts>;
  listCustom(
    params: { channels?: string[]; tags?: string[]; tagRelation?: 'AND' | 'OR'; keyword?: string; sort?: SortOption; timeRange?: string; timeFrom?: string; timeTo?: string },
    limit: number,
    offset: number,
    includeInvalid?: boolean
  ): Promise<PaginatedPosts>;
  listTrendingRecommended(
    preferences: { tags?: string[]; channelIds?: string[]; orientations?: string[] } | undefined,
    limit: number,
    offset: number,
    includeInvalid?: boolean,
    sort?: SortOption
  ): Promise<PaginatedPosts>;
  listNewHot(limit: number, offset: number, includeInvalid?: boolean, sort?: SortOption): Promise<PaginatedPosts>;
  listHiddenGems(limit: number, offset: number, includeInvalid?: boolean, sort?: SortOption): Promise<PaginatedPosts>;
}
