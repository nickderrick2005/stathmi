import { Redis } from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';

let redisInstance: Redis | null = null;

export const initializeRedis = async (logger: FastifyBaseLogger): Promise<Redis | null> => {
  if (redisInstance) {
    return redisInstance;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.warn('REDIS_URL not provided, using in-memory session storage');
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: true,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    client.on('error', (err: Error) => {
      logger.error({ err }, 'Redis connection error');
    });

    client.on('connect', () => {
      logger.info('Redis connected');
    });

    await client.ping();
    logger.info('Redis connection verified');

    redisInstance = client;
    return client;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Redis');
    throw error;
  }
};

export const getRedis = (): Redis | null => {
  return redisInstance;
};

export const closeRedis = async (): Promise<void> => {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
};
