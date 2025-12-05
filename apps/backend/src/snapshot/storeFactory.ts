import { getRedis } from '../lib/redis.js';
import { MemorySnapshotStore } from './memorySnapshotStore.js';
import { RedisSnapshotStore } from './redisSnapshotStore.js';
import type { SnapshotStore } from './types.js';

let cachedStore: SnapshotStore | null = null;

export const getSnapshotStore = (): SnapshotStore => {
  const redis = getRedis();
  if (redis) {
    if (!(cachedStore instanceof RedisSnapshotStore)) {
      cachedStore = new RedisSnapshotStore(redis);
    }
    return cachedStore;
  }

  if (!cachedStore) {
    cachedStore = new MemorySnapshotStore();
  }
  return cachedStore;
};
