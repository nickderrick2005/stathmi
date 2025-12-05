import crypto from 'crypto';

export interface SnapshotCursor {
  snapshotId: string;
  position: number;
}

const SECRET = process.env.SNAPSHOT_CURSOR_SECRET ?? 'snapshot-secret';

const sign = (payload: string): string => {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16);
};

export const encodeCursor = (cursor: SnapshotCursor): string => {
  const payload = JSON.stringify(cursor);
  const signature = sign(payload);
  return Buffer.from(`${signature}:${payload}`).toString('base64url');
};

export const decodeCursor = (raw: unknown): SnapshotCursor | null => {
  if (typeof raw !== 'string') return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const [sig, payload] = decoded.split(':', 2);
    if (!sig || !payload) return null;
    if (sign(payload) !== sig) return null;
    const parsed = JSON.parse(payload) as SnapshotCursor;
    if (!parsed.snapshotId || typeof parsed.position !== 'number' || parsed.position < 0) return null;
    return { snapshotId: parsed.snapshotId, position: parsed.position };
  } catch {
    return null;
  }
};
