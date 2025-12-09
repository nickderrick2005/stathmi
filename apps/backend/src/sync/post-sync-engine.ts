import type { Kysely } from 'kysely';
import type { MeiliSearch } from 'meilisearch';
import type { DB } from '../types/database.js';
import { getAppConfig } from '../config/app-config.js';
import { mapPostToSearchDoc } from '../domain/post.js';
import { KyselyPostsReadRepository } from '../repositories/db/PostsReadRepository.kysely.js';
import { createDiscordFetcher, type DiscordContentFetcher } from '../services/discordFetcher.js';

export type SyncAction = 'INSERT' | 'UPDATE' | 'DELETE';

interface SyncOptions {
  /** 是否自动修复缺失内容（需要 DISCORD_BOT_TOKEN） */
  autoFixContent?: boolean;
  /** 进度回调 */
  onProgress?: (current: number, total: number, fixed: number) => void;
}

export class PostSyncEngine {
  private readonly indexName: string;
  private readonly whitelist: Set<string>;
  private readonly postsRepo: KyselyPostsReadRepository;
  private readonly discordFetcher: DiscordContentFetcher | null;

  constructor(private readonly db: Kysely<DB>, private readonly searchClient: MeiliSearch, indexName?: string) {
    this.indexName = indexName ?? process.env.MEILI_INDEX_POSTS ?? 'posts';
    this.postsRepo = new KyselyPostsReadRepository(db);
    const { whitelistedChannelIds } = getAppConfig();
    this.whitelist = new Set(whitelistedChannelIds ?? []);
    this.discordFetcher = createDiscordFetcher();
  }

  async apply(postId: string, action: SyncAction): Promise<void> {
    if (action === 'DELETE') {
      await this.softDelete(postId);
      return;
    }

    await this.syncPost(postId);
  }

  async syncAllPosts(batchSize = 200, options?: SyncOptions): Promise<void> {
    const { autoFixContent = false, onProgress } = options ?? {};
    const total = await this.postsRepo.count(true);
    const index = this.searchClient.index(this.indexName);
    let offset = 0;
    let fixedCount = 0;

    if (autoFixContent && !this.discordFetcher) {
      console.warn('[PostSyncEngine] autoFixContent enabled but DISCORD_BOT_TOKEN not set, skipping content fix');
    }

    while (offset < total) {
      const posts = await this.postsRepo.listLatest(batchSize, offset, true);
      if (posts.length === 0) break;

      // 自动修复缺失内容
      if (autoFixContent && this.discordFetcher) {
        const postsNeedingFix = posts.filter((p) => !p.content || p.content.trim() === '');
        if (postsNeedingFix.length > 0) {
          fixedCount += await this.fixMissingContent(postsNeedingFix);
        }
      }

      // 重新获取帖子（可能已被修复）
      const refreshedPosts = autoFixContent
        ? await this.postsRepo.findByIds(posts.map((p) => p.id), true)
        : posts;

      const documents = refreshedPosts
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
      onProgress?.(offset, total, fixedCount);
    }

    if (autoFixContent && fixedCount > 0) {
      console.log(`[PostSyncEngine] Fixed content for ${fixedCount} posts`);
    }
  }

  /**
   * 修复缺失内容的帖子
   */
  private async fixMissingContent(posts: Array<{ id: string; categoryId: string }>): Promise<number> {
    if (!this.discordFetcher) return 0;

    let fixed = 0;

    // 获取帖子的 first_message_id
    const postDetails = await this.db
      .selectFrom('posts_main')
      .select(['thread_id', 'first_message_id'])
      .where(
        'thread_id',
        'in',
        posts.map((p) => p.id)
      )
      .execute();

    for (const post of postDetails) {
      try {
        const content = await this.discordFetcher.fetchMessage(
          String(post.thread_id),
          String(post.first_message_id)
        );

        if (content && (content.content || content.attachmentUrls.length > 0)) {
          await this.db
            .updateTable('posts_main')
            .set({
              first_message_content: content.content || null,
              attachment_urls: JSON.stringify(content.attachmentUrls),
            })
            .where('thread_id', '=', post.thread_id)
            .execute();

          fixed++;
        }
      } catch (error) {
        // 忽略单个帖子的错误，继续处理其他帖子
        console.error(`[PostSyncEngine] Failed to fix content for post ${post.thread_id}:`, error);
      }
    }

    return fixed;
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
