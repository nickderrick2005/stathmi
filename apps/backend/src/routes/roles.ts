import type { FastifyPluginCallback } from 'fastify';
import { appContext } from '../container.js';

export const rolesRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const { rolesService } = appContext;

  app.get('/', async (_request, reply) => {
    const roles = await rolesService.listRoles();
    return reply.send(roles);
  });

  done();
};
