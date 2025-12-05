import type { FavoriteRecord } from '@opz-hub/shared';

export interface FavoritesRepository {
  list(userId: string): Promise<FavoriteRecord[]>;
  exists(userId: string, postId: string): Promise<boolean>;
  insert(userId: string, postId: string): Promise<void>;
  remove(userId: string, postId: string): Promise<boolean>;
}
