import type { Kysely } from 'kysely';
import type { MeiliSearch } from 'meilisearch';
import type { DB } from '../types/database.js';
import { getAppConfig } from '../config/app-config.js';
import { mapPostToSearchDoc } from '../domain/post.js';
import { KyselyPostsReadRepository } from '../repositories/db/PostsReadRepository.kysely.js';

export type SyncAction = 'INSERT' | 'UPDATE' | 'DELETE';

export class PostSyncEngine {
  private readonly indexName: string;
  private readonly whitelist: Set<string>;
  private readonly postsRepo: KyselyPostsReadRepository;

  constructor(private readonly db: Kysely<DB>, private readonly searchClient: MeiliSearch, indexName?: string) {
    this.indexName = indexName ?? process.env.MEILI_INDEX_POSTS ?? 'posts';
    this.postsRepo = new KyselyPostsReadRepository(db);
    const { whitelistedChannelIds } = getAppConfig();
    this.whitelist = new Set(whitelistedChannelIds ?? []);
  }

  async apply(postId: string, action: SyncAction): Promise<void> {
    if (action === 'DELETE') {
      await this.softDelete(postId);
      return;
    }

    await this.syncPost(postId);
  }

  async syncAllPosts(batchSize = 200): Promise<void> {
    const total = await this.postsRepo.count(true);
    const index = this.searchClient.index(this.indexName);
    let offset = 0;

    while (offset < total) {
      const posts = await this.postsRepo.listLatest(batchSize, offset, true);
      if (posts.length === 0) break;

      const documents = posts
        .filter((post) => {
          if (this.whitelist.size > 0 && !this.whitelist.has(post.categoryId)) {
            return false;
          }
          return true;
        })
        .map((post) => mapPostToSearchDoc(post));

      if (documents.length > 0) {
        await index.addDocuments(documents, { primaryKey: 'id' });
      }
      offset += posts.length;
    }
  }

  private async syncPost(postId: string): Promise<void> {
    const post = await this.postsRepo.findById(postId, true);
    if (!post) {
      return;
    }

    if (this.whitelist.size > 0 && !this.whitelist.has(post.categoryId)) {
      await this.softDelete(postId);
      return;
    }

    await this.searchClient.index(this.indexName).addDocuments([mapPostToSearchDoc(post)], { primaryKey: 'id' });
  }

  private async softDelete(postId: string): Promise<void> {
    await this.searchClient.index(this.indexName).updateDocuments([{ id: postId, isDeleted: true }]);
  }
}
