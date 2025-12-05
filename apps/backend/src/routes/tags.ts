import type { FastifyPluginCallback } from 'fastify';
import { appContext } from '../container.js';
import { toStringArray } from '../utils/query.js';

export const tagsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const { channelsService } = appContext;

  app.get('/recommended', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const channelIds = toStringArray(query?.channelIds);
    const tags = await channelsService.listRecommendedTags(channelIds, 20);
    return reply.send(tags);
  });

  app.get('/by-names', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const names = toStringArray(query?.names);
    const tags = await channelsService.getTagsByNames(names);
    return reply.send(tags);
  });

  done();
};
