import type { FavoriteResponse } from '@opz-hub/shared';
import type { FavoritesRepository } from '../repositories/favoritesRepository.js';
import type { PostsService } from './postsService.js';

export class FavoritesService {
  constructor(
    private readonly repository: FavoritesRepository,
    private readonly postsService: PostsService
  ) {}

  public async list(userId: string, includeInvalid = false): Promise<FavoriteResponse[]> {
    const records = await this.repository.list(userId);
    const posts = await this.postsService.findByIds(
      records.map((record) => record.postId),
      includeInvalid
    );
    const postMap = new Map(posts.map((post) => [post.id, post]));

    return records
      .map((record) => {
        const post = postMap.get(record.postId);
        if (!post) {
          return undefined;
        }
        return { ...record, post } satisfies FavoriteResponse;
      })
      .filter((value): value is FavoriteResponse => Boolean(value));
  }

  public async add(userId: string, postId: string): Promise<{ success: boolean; reason?: string }> {
    if (!postId) {
      return { success: false, reason: 'POST_ID_REQUIRED' };
    }

    if (await this.repository.exists(userId, postId)) {
      return { success: true };
    }

    const [post] = await this.postsService.findByIds([postId]);
    if (!post) {
      return { success: false, reason: 'POST_NOT_FOUND' };
    }

    await this.repository.insert(userId, postId);
    return { success: true };
  }

  public async remove(userId: string, postId: string): Promise<{ success: boolean; reason?: string }> {
    if (!postId) {
      return { success: false, reason: 'POST_ID_REQUIRED' };
    }

    const removed = await this.repository.remove(userId, postId);
    if (!removed) {
      return { success: false, reason: 'NOT_FOUND' };
    }
    return { success: true };
  }
}
