import type { FastifyPluginCallback } from 'fastify';
import { appContext } from '../container.js';
import { authMiddleware } from '../middleware/auth.js';
import { badRequest } from '../utils/responses.js';

export const followRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const { followsService, tagFollowsService, channelFollowsService } = appContext;

  app.addHook('preHandler', authMiddleware);

  app.get('/', async (request, reply) => {
    const userId = request.ctx!.userId;
    const follows = await followsService.list(userId);
    return reply.send(follows);
  });

  app.post('/', async (request, reply) => {
    const { authorId } = (request.body ?? {}) as { authorId?: string };
    if (!authorId) {
      return badRequest(reply, 'authorId is required');
    }
    const userId = request.ctx!.userId;
    const result = await followsService.add(userId, authorId);
    if (!result.success) {
      return badRequest(reply, result.reason ?? 'failed to follow');
    }
    return reply.send({ success: true });
  });

  app.delete('/:authorId', async (request, reply) => {
    const { authorId } = request.params as { authorId?: string };
    if (!authorId) {
      return badRequest(reply, 'authorId is required');
    }
    const userId = request.ctx!.userId;
    const result = await followsService.remove(userId, authorId);
    if (!result.success) {
      return badRequest(reply, 'follow not found');
    }
    return reply.send({ success: true });
  });

  app.get('/tags', async (request, reply) => {
    const userId = request.ctx!.userId;
    const follows = await tagFollowsService.list(userId);
    return reply.send(follows);
  });

  app.post('/tags', async (request, reply) => {
    const { tagId } = (request.body ?? {}) as { tagId?: string };
    if (!tagId) {
      return badRequest(reply, 'tagId is required');
    }
    const userId = request.ctx!.userId;
    const result = await tagFollowsService.add(userId, tagId);
    if (!result.success) {
      return badRequest(reply, result.reason ?? 'failed to follow tag');
    }
    return reply.send({ success: true });
  });

  app.delete('/tags/:tagId', async (request, reply) => {
    const { tagId } = request.params as { tagId?: string };
    if (!tagId) {
      return badRequest(reply, 'tagId is required');
    }
    const userId = request.ctx!.userId;
    const result = await tagFollowsService.remove(userId, tagId);
    if (!result.success) {
      return badRequest(reply, result.reason ?? 'follow not found');
    }
    return reply.send({ success: true });
  });

  // === 频道关注路由 ===

  app.get('/channels', async (request, reply) => {
    const userId = request.ctx!.userId;
    const follows = await channelFollowsService.list(userId);
    return reply.send(follows);
  });

  app.post('/channels', async (request, reply) => {
    const { channelId } = (request.body ?? {}) as { channelId?: string };
    if (!channelId) {
      return badRequest(reply, 'channelId is required');
    }
    const userId = request.ctx!.userId;
    const result = await channelFollowsService.add(userId, channelId);
    if (!result.success) {
      return badRequest(reply, result.reason ?? 'failed to follow channel');
    }
    return reply.send({ success: true });
  });

  app.delete('/channels/:channelId', async (request, reply) => {
    const { channelId } = request.params as { channelId?: string };
    if (!channelId) {
      return badRequest(reply, 'channelId is required');
    }
    const userId = request.ctx!.userId;
    const result = await channelFollowsService.remove(userId, channelId);
    if (!result.success) {
      return badRequest(reply, result.reason ?? 'channel follow not found');
    }
    return reply.send({ success: true });
  });

  done();
};
