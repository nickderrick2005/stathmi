import type {
  Author,
  AuthorAutocompleteItem,
  PaginatedPosts,
  UserName,
  UserProfile,
  UserProfileExtended,
  UserSettings,
} from '@opz-hub/shared';
import type { UserRepository } from '../repositories/userRepository.js';
import type { PostsService } from './postsService.js';
import type { SortOption } from '../repositories/search/postsSearchRepository.js';

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly postsService: PostsService
  ) {}

  public async getUserProfile(id: string): Promise<UserProfile | null> {
    const profile = await this.userRepository.getUserById(id);
    if (!profile) return null;
    const firstPostAt = await this.userRepository.getUserFirstPostAt(id);
    return {
      ...profile,
      joinedAt: firstPostAt ?? new Date().toISOString(),
    };
  }

  public async getUserProfileExtended(id: string): Promise<UserProfileExtended | null> {
    const profile = await this.getUserProfile(id);
    if (!profile) return null;

    const [postStats, followStats, settings] = await Promise.all([
      this.userRepository.getUserPostStats(id),
      this.userRepository.getUserFollowStats(id),
      this.userRepository.getUserSettings(id),
    ]);

    return {
      ...profile,
      followers: followStats.followers,
      following: followStats.following,
      totalLikes: postStats.totalLikes,
      totalComments: postStats.totalComments,
      channelStats: postStats.channelStats,
      featuredPostId: settings?.featuredPostId ?? null,
    };
  }

  public async getUserPosts(
    id: string,
    limit = 10,
    offset = 0,
    options?: { channelId?: string; sort?: SortOption }
  ): Promise<PaginatedPosts> {
    const { channelId, sort } = options ?? {};
    return this.postsService.listByAuthor(id, limit, offset, false, channelId, sort);
  }

  public async getUsersByIds(ids: string[]): Promise<UserProfile[]> {
    if (ids.length === 0) return [];
    return this.userRepository.getUsersByIds(ids);
  }

  public async getUserNamesByIds(ids: string[]): Promise<UserName[]> {
    if (ids.length === 0) return [];
    return this.userRepository.getUserNamesByIds(ids);
  }

  public async getUserSettings(userId: string): Promise<UserSettings> {
    const existing = await this.userRepository.getUserSettings(userId);
    if (existing) {
      return existing;
    }
    return this.userRepository.createUserSettings(userId);
  }

  public async updateUserSettings(userId: string, partial: Partial<UserSettings>): Promise<UserSettings> {
    if (partial.featuredPostId !== undefined) {
      // 清除代表作
      if (partial.featuredPostId === null) {
        partial.featuredPostId = null;
      } else if (typeof partial.featuredPostId === 'string') {
        const trimmed = partial.featuredPostId.trim();
        if (!trimmed) {
          throw new Error('INVALID_FEATURED_POST_ID');
        }

        const post = await this.postsService.findById(trimmed);
        if (!post) {
          throw new Error('FEATURED_POST_NOT_FOUND');
        }
        if (post.authorId !== userId) {
          throw new Error('FEATURED_POST_NOT_OWNED');
        }
        partial.featuredPostId = post.id;
      } else {
        throw new Error('INVALID_FEATURED_POST_ID');
      }
    }

    return this.userRepository.updateUserSettings(userId, partial);
  }

  public async listAuthors(): Promise<Author[]> {
    return this.userRepository.listAuthors();
  }

  public async updateUserOrientations(userId: string, orientations: string[]): Promise<void> {
    return this.userRepository.updateUserOrientations(userId, orientations);
  }

  public async searchAuthors(query: string, limit: number = 10): Promise<AuthorAutocompleteItem[]> {
    return this.userRepository.searchAuthors(query, limit);
  }
}
