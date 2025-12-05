export interface SnapshotMeta {
  total: number;
  expiresAt: number;
  sortKey: string;
}

export interface SnapshotSlice {
  ids: string[];
  meta: SnapshotMeta;
}

export interface SnapshotStore {
  saveSnapshot(id: string, ids: string[], meta: SnapshotMeta, ttlSeconds: number): Promise<void>;
  getSlice(id: string, start: number, end: number): Promise<SnapshotSlice | null>;
}
