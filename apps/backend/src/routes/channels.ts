import type { FastifyPluginCallback } from 'fastify';
import { appContext } from '../container.js';
import { badRequest } from '../utils/responses.js';

export const channelsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const { channelsService } = appContext;

  app.get('/', async (_request, reply) => {
    const channels = await channelsService.listChannels();
    return reply.send(channels);
  });

  app.get('/:channelId/tags', async (request, reply) => {
    const { channelId } = request.params as { channelId?: string };
    if (!channelId) {
      return badRequest(reply, 'channelId parameter is required');
    }

    const tags = await channelsService.listChannelTags(channelId);
    return reply.send(tags);
  });

  app.get('/tags/popular', async (_request, reply) => {
    const tags = await channelsService.listPopularTags();
    return reply.send(tags);
  });

  done();
};
