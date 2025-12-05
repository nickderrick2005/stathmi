import 'dotenv/config';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import type { Redis as RedisClient } from 'ioredis';
import { registerApiRoutes } from './routes/index.js';
import { getRedis, initializeRedis } from './lib/redis.js';
import { RedisSessionStore } from './lib/session-store.js';
import { validateRequiredEnv } from './lib/env-validator.js';
import { startHotWordsCron } from './cron/hotWordsJob.js';
import { appContext } from './container.js';
import { startPostSync } from './sync/start-post-sync.js';
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth.js';

const buildLogger = () => ({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
});

export const buildServer = async () => {
  validateRequiredEnv();

  const app = Fastify({ logger: buildLogger() });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);

  const sessionSecret = process.env.SESSION_SECRET!;

  let redis: RedisClient | null = null;
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    redis = await initializeRedis(app.log);
  } else {
    app.log.warn('!!! REDIS_URL not configured, falling back to in-memory session storage (development only)');
  }

  const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days in seconds

  const sessionConfig: fastifySession.FastifySessionOptions = {
    secret: sessionSecret,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
      maxAge: SESSION_TTL_SECONDS * 1000, // @fastify/session uses milliseconds
      path: '/',
    },
    saveUninitialized: false,
  };

  if (redis) {
    const sessionStore = new RedisSessionStore(redis, SESSION_TTL_SECONDS);
    sessionConfig.store = sessionStore;
  }

  await app.register(fastifySession, sessionConfig);

  app.get('/health', async (_req, reply) => reply.send({ status: 'ok' }));

  const apiAuthGuard = createApiAuthGuard();
  await app.register(
    async (apiApp) => {
      apiApp.addHook('preHandler', apiAuthGuard);
      await apiApp.register(registerApiRoutes);
    },
    { prefix: '/api' }
  );

  app.addHook('onClose', async () => {
    // Redis shutdown handled in the main process
  });

  return app;
};

// 公开 API 路径
const PUBLIC_API_PATHS = ['/auth/discord', '/auth/discord/callback', '/auth/logout'];

const isPublicApiPath = (url: string): boolean => {
  const path = url.split('?')[0];
  return PUBLIC_API_PATHS.some((p) => path === p || path.endsWith(p));
};

const createApiAuthGuard = () => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === 'OPTIONS') {
      return;
    }

    // 使用完整请求路径检查
    if (isPublicApiPath(request.url)) {
      await optionalAuthMiddleware(request);
      return;
    }

    return authMiddleware(request, reply);
  };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const start = async () => {
    const server = await buildServer();
    let postSyncWorker: { stop: () => Promise<void> } | null = null;

    server.addHook('onClose', async () => {
      if (postSyncWorker) {
        await postSyncWorker.stop();
      }
    });

    if (process.env.MEILI_SYNC_ENABLED !== 'false') {
      try {
        postSyncWorker = await startPostSync(appContext.db, server.log);
        server.log.info('[PostSync] worker started');
      } catch (error) {
        server.log.error(error, '[PostSync] failed to start worker');
      }
    } else {
      server.log.info('[PostSync] worker disabled via MEILI_SYNC_ENABLED=false');
    }

    const port = Number(process.env.PORT ?? 3000);
    try {
      await server.listen({ port, host: '0.0.0.0' });
      server.log.info(`Server running on http://0.0.0.0:${port}`);

      // 启动热词相关的定时任务（仅当 Redis 可用）
      if (getRedis()) {
        startHotWordsCron(appContext.hotWordsService, server.log);
      } else {
        server.log.warn('Hot words cron not started: Redis is not available');
      }
    } catch (error) {
      server.log.error(error);
      process.exit(1);
    }
  };

  void start();
}
