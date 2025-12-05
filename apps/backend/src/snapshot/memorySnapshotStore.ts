import type { SnapshotMeta, SnapshotSlice, SnapshotStore } from './types.js';

type Stored = { ids: string[]; meta: SnapshotMeta; timeout: NodeJS.Timeout | null };

export class MemorySnapshotStore implements SnapshotStore {
  private readonly snapshots = new Map<string, Stored>();

  async saveSnapshot(id: string, ids: string[], meta: SnapshotMeta, ttlSeconds: number): Promise<void> {
    this.clear(id);
    const timeout =
      ttlSeconds > 0
        ? setTimeout(() => {
            this.clear(id);
          }, ttlSeconds * 1000)
        : null;
    this.snapshots.set(id, { ids: ids.slice(), meta, timeout });
  }

  async getSlice(id: string, start: number, end: number): Promise<SnapshotSlice | null> {
    const stored = this.snapshots.get(id);
    if (!stored) return null;
    const now = Date.now();
    if (stored.meta.expiresAt <= now) {
      this.clear(id);
      return null;
    }
    return {
      ids: stored.ids.slice(start, end + 1),
      meta: stored.meta,
    };
  }

  private clear(id: string): void {
    const stored = this.snapshots.get(id);
    if (stored?.timeout) {
      clearTimeout(stored.timeout);
    }
    this.snapshots.delete(id);
  }
}
