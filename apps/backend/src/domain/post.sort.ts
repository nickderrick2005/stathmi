import type { Post } from '@opz-hub/shared';
import type { SortOption } from '../repositories/search/postsSearchRepository.js';
import { rerank } from '../utils/smartRanking.js';
import { resolveSort } from '../sorting/sort.js';

export const sortPosts = (posts: Post[], sort: SortOption | undefined): Post[] => {
  if (!posts.length) return [];

  const { order, field } = resolveSort(sort);

  if (field === 'weighted') {
    return rerank(posts, order);
  }

  const getValue = (post: Post): number => {
    const created = new Date(post.createdAt).getTime();
    const updated = post.updatedAt ? new Date(post.updatedAt).getTime() : created;
    switch (field) {
      case 'created':
        return created;
      case 'updated':
        return updated;
      case 'likes':
        return post.reactionCount ?? 0;
      default:
        return created;
    }
  };

  return posts
    .slice()
    .sort((a, b) => {
      const diff = getValue(a) - getValue(b);
      if (diff !== 0) {
        return order === 'asc' ? diff : -diff;
      }
      return order === 'asc'
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
};
