import type { FollowRecord } from '@opz-hub/shared';

export interface AuthorBasicInfo {
  id: string;
  username: string;
  nickname?: string;
  globalName?: string;
}

export interface FollowsRepository {
  list(userId: string): Promise<FollowRecord[]>;
  exists(userId: string, authorId: string): Promise<boolean>;
  insert(userId: string, authorId: string): Promise<void>;
  remove(userId: string, authorId: string): Promise<boolean>;
  authorExists(authorId: string): Promise<boolean>;
  getAuthorBasicInfo(authorId: string): Promise<AuthorBasicInfo | null>;
}
