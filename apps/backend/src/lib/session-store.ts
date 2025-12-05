import type { Redis as RedisClient } from 'ioredis';
import type fastifySession from '@fastify/session';
import type { SessionStore } from '@fastify/session';

export interface SessionData extends fastifySession.FastifySessionObject {
  user?: {
    id: string;
    username: string;
    nickname?: string;
    globalName?: string;
    avatar: string | null;
    roles: string[];
    isAdmin: boolean;
    lastLogin?: string;
    discordRoles?: string[];
    orientations?: string[];
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Redis-backed session store for @fastify/session
 * Implements the SessionStore interface
 */
export class RedisSessionStore implements SessionStore {
  private readonly prefix = 'session:';
  private readonly ttl: number;

  constructor(
    private redis: RedisClient,
    ttlSeconds: number = 7 * 24 * 60 * 60
  ) {
    this.ttl = ttlSeconds;
  }

  async set(sessionId: string, session: SessionData, callback?: (err?: Error) => void): Promise<void> {
    try {
      const key = `${this.prefix}${sessionId}`;
      const data = JSON.stringify(session);

      await this.redis.setex(key, this.ttl, data);

      callback?.();
    } catch (error) {
      callback?.(error as Error);
      throw error;
    }
  }

  async get(
    sessionId: string,
    callback?: (err: Error | null, session?: SessionData | null) => void
  ): Promise<SessionData | null> {
    try {
      const key = `${this.prefix}${sessionId}`;
      const data = await this.redis.getex(key, 'EX', this.ttl);

      if (!data) {
        callback?.(null, null);
        return null;
      }

      const session = JSON.parse(data) as SessionData;
      callback?.(null, session);
      return session;
    } catch (error) {
      callback?.(error as Error);
      throw error;
    }
  }

  async destroy(sessionId: string, callback?: (err?: Error) => void): Promise<void> {
    try {
      const key = `${this.prefix}${sessionId}`;
      await this.redis.del(key);

      callback?.();
    } catch (error) {
      callback?.(error as Error);
      throw error;
    }
  }
}
