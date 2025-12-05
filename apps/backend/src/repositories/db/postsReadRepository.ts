import type { Post } from '@opz-hub/shared';

export interface PostTitle {
  id: string;
  title: string;
}

export interface PostsReadRepository {
  findById(id: string, includeInvalid?: boolean): Promise<Post | null>;
  findByIds(ids: string[], includeInvalid?: boolean): Promise<Post[]>;
  findByThreadOrMessageIds(ids: string[], includeInvalid?: boolean): Promise<Post[]>;
  listLatest(limit: number, offset: number, includeInvalid?: boolean): Promise<Post[]>;
  count(includeInvalid?: boolean): Promise<number>;
  getPostTitlesByIds(ids: string[]): Promise<PostTitle[]>;
}
