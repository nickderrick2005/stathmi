/**
 * Discord 内容获取服务
 *
 * 用于从 Discord API 获取帖子首楼内容和附件
 */

interface DiscordMessage {
  id: string;
  content: string;
  attachments: Array<{
    id: string;
    url: string;
    proxy_url: string;
    filename: string;
    content_type?: string;
    width?: number;
    height?: number;
  }>;
}

interface FetchedContent {
  content: string;
  attachmentUrls: string[];
}

export class DiscordContentFetcher {
  private readonly token: string;
  private readonly baseUrl = 'https://discord.com/api/v10';
  private lastRequestTime = 0;
  private readonly minRequestInterval = 50; // 50ms between requests to avoid rate limiting

  constructor(token: string) {
    this.token = token;
  }

  /**
   * 获取消息内容和附件
   * @param channelId 频道/帖子 ID（对于 forum 帖子，就是 thread_id）
   * @param messageId 消息 ID（首楼消息 ID）
   */
  async fetchMessage(channelId: string, messageId: string): Promise<FetchedContent | null> {
    await this.rateLimit();

    try {
      const response = await fetch(`${this.baseUrl}/channels/${channelId}/messages/${messageId}`, {
        headers: {
          Authorization: `Bot ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // 消息已删除
          return null;
        }
        if (response.status === 429) {
          // Rate limited
          const retryAfter = response.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
          console.warn(`[DiscordFetcher] Rate limited, waiting ${waitMs}ms`);
          await this.sleep(waitMs);
          return this.fetchMessage(channelId, messageId); // 重试
        }
        console.error(`[DiscordFetcher] Failed to fetch message: ${response.status} ${response.statusText}`);
        return null;
      }

      const message: DiscordMessage = await response.json();

      return {
        content: message.content || '',
        attachmentUrls: message.attachments.map((att) => att.url),
      };
    } catch (error) {
      console.error(`[DiscordFetcher] Error fetching message ${messageId}:`, error);
      return null;
    }
  }

  /**
   * 批量获取帖子首楼内容
   * @param posts 帖子列表 [{threadId, firstMessageId}]
   * @param onProgress 进度回调
   */
  async fetchBatch(
    posts: Array<{ threadId: string; firstMessageId: string }>,
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<string, FetchedContent>> {
    const results = new Map<string, FetchedContent>();

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const content = await this.fetchMessage(post.threadId, post.firstMessageId);

      if (content) {
        results.set(post.threadId, content);
      }

      if (onProgress) {
        onProgress(i + 1, posts.length);
      }
    }

    return results;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minRequestInterval) {
      await this.sleep(this.minRequestInterval - elapsed);
    }

    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 创建 Discord 内容获取器
 * 如果没有配置 token，返回 null
 */
export const createDiscordFetcher = (): DiscordContentFetcher | null => {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return null;
  }
  return new DiscordContentFetcher(token);
};
