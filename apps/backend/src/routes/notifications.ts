import type { FastifyPluginCallback } from 'fastify';
import { appContext } from '../container.js';
import { toNumber } from '../utils/query.js';
import { authMiddleware } from '../middleware/auth.js';

export const notificationRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const { notificationsService } = appContext;

  app.addHook('preHandler', authMiddleware);

  app.get('/', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const limit = toNumber(query?.limit, 20);
    const cursor = typeof query?.cursor === 'string' ? query.cursor : undefined;
    const userId = request.ctx!.userId;
    const result = await notificationsService.list(userId, limit, cursor);
    return reply.send(result);
  });

  app.get('/unread', async (request, reply) => {
    const userId = request.ctx!.userId;
    const count = await notificationsService.countUnread(userId);
    return reply.send({ count });
  });

  app.post('/read', async (request, reply) => {
    const { cursor } = (request.body ?? {}) as { cursor?: string };
    const userId = request.ctx!.userId;
    const result = await notificationsService.markRead(userId, cursor);
    return reply.send(result);
  });

  done();
};
