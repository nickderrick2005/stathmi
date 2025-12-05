import type { Redis } from 'ioredis';
import type { SnapshotMeta, SnapshotSlice, SnapshotStore } from './types.js';

const META_KEY = (id: string) => `snap:${id}:meta`;
const IDS_KEY = (id: string) => `snap:${id}:ids`;

export class RedisSnapshotStore implements SnapshotStore {
  constructor(private readonly redis: Redis) {}

  async saveSnapshot(id: string, ids: string[], meta: SnapshotMeta, ttlSeconds: number): Promise<void> {
    const pipeline = this.redis.multi();
    pipeline.del(META_KEY(id), IDS_KEY(id));
    if (ids.length > 0) {
      pipeline.rpush(IDS_KEY(id), ...ids);
      pipeline.expire(IDS_KEY(id), ttlSeconds);
    }
    pipeline.set(META_KEY(id), JSON.stringify(meta), 'EX', ttlSeconds);
    await pipeline.exec();
  }

  async getSlice(id: string, start: number, end: number): Promise<SnapshotSlice | null> {
    const [metaRaw, ids] = await Promise.all([
      this.redis.get(META_KEY(id)),
      this.redis.lrange(IDS_KEY(id), start, end),
    ]);
    if (!metaRaw) return null;
    let meta: SnapshotMeta;
    try {
      meta = JSON.parse(metaRaw) as SnapshotMeta;
    } catch {
      return null;
    }
    if (meta.expiresAt <= Date.now()) {
      return null;
    }
    return { ids, meta };
  }
}
