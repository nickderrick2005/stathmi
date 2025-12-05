import type { Post } from '@opz-hub/shared';

export interface CacheEntry {
  posts: Post[];
  total: number;
  timestamp: number;
  nextCursor?: string;
}

export interface UseFeedCacheOptions {
  /** 缓存过期时间（毫秒），默认 60 秒 */
  ttl?: number;
  /** 缓存最大条目数，默认 50 */
  maxSize?: number;
}

/**
 * Feed 缓存管理
 *
 * 提供基于 key 的内存缓存，支持 TTL 过期和 LRU 淘汰
 */
export function useFeedCache(options: UseFeedCacheOptions = {}) {
  const cache = new Map<string, CacheEntry>();
  const ttl = options.ttl ?? 60 * 1000;
  const maxSize = options.maxSize ?? 50;

  /** 清理过期条目 */
  function pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now - entry.timestamp > ttl) {
        cache.delete(key);
      }
    }
  }

  /** LRU 淘汰：删除最旧的条目直到符合 maxSize */
  function evictIfNeeded() {
    if (cache.size <= maxSize) return;
    // Map 保持插入顺序，删除最早插入的条目
    const keysToDelete = Array.from(cache.keys()).slice(0, cache.size - maxSize);
    for (const key of keysToDelete) {
      cache.delete(key);
    }
  }

  function get(key: string): CacheEntry | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttl) {
      cache.delete(key);
      return null;
    }
    // LRU：访问时移到末尾（重新插入）
    cache.delete(key);
    cache.set(key, entry);
    return entry;
  }

  function set(key: string, posts: Post[], total: number, nextCursor?: string) {
    // 先清理过期条目，再检查容量
    pruneExpired();
    cache.set(key, { posts, total, timestamp: Date.now(), nextCursor });
    evictIfNeeded();
  }

  function invalidate(keyPrefix?: string) {
    if (!keyPrefix) {
      cache.clear();
      return;
    }
    for (const key of cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        cache.delete(key);
      }
    }
  }

  function has(key: string): boolean {
    return get(key) !== null;
  }

  return {
    get,
    set,
    invalidate,
    has,
  };
}

/**
 * 生成缓存 key
 */
export function buildCacheKey(parts: (string | number | undefined | null)[]): string {
  return parts.map((p) => p ?? '').join(':');
}
