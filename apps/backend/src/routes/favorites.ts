import type { FastifyPluginCallback } from 'fastify';
import { appContext } from '../container.js';
import { authMiddleware } from '../middleware/auth.js';
import { badRequest } from '../utils/responses.js';

export const favoriteRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const { favoritesService } = appContext;

  app.addHook('preHandler', authMiddleware);

  app.get('/', async (request, reply) => {
    const userId = request.ctx!.userId;
    const favorites = await favoritesService.list(userId);
    return reply.send(favorites);
  });

  app.post('/', async (request, reply) => {
    const { postId } = (request.body ?? {}) as { postId?: string };
    if (!postId) {
      return badRequest(reply, 'postId is required');
    }
    const userId = request.ctx!.userId;
    const result = await favoritesService.add(userId, postId);
    if (!result.success) {
      return badRequest(reply, result.reason ?? 'failed to add favorite');
    }
    return reply.send({ success: true });
  });

  app.delete('/:postId', async (request, reply) => {
    const { postId } = request.params as { postId?: string };
    if (!postId) {
      return badRequest(reply, 'postId is required');
    }
    const userId = request.ctx!.userId;
    const result = await favoritesService.remove(userId, postId);
    if (!result.success) {
      return badRequest(reply, 'favorite not found');
    }
    return reply.send({ success: true });
  });

  done();
};
