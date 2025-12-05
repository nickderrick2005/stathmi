import type { FastifyPluginCallback } from 'fastify';
import type { OnboardingPreferences } from '@opz-hub/shared';
import { appContext } from '../container.js';
import { authMiddleware } from '../middleware/auth.js';
import type { SessionData } from '../lib/session-store.js';
import { badRequest } from '../utils/responses.js';

export const onboardingRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const { onboardingService } = appContext;

  app.addHook('preHandler', authMiddleware);

  app.post('/preferences', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<OnboardingPreferences>;
    const userId = request.ctx!.userId;

    const orientations = Array.isArray(body.orientations) ? body.orientations.filter(Boolean) : [];
    const channelIds = Array.isArray(body.channelIds) ? body.channelIds.filter(Boolean) : [];
    const tagIds = Array.isArray(body.tagIds) ? body.tagIds.filter(Boolean) : [];
    const blockedTagNames = Array.isArray(body.blockedTagNames) ? body.blockedTagNames.filter(Boolean) : [];

    if (orientations.length === 0) {
      return badRequest(reply, 'orientations is required');
    }

    try {
      const result = await onboardingService.savePreferences(userId, { orientations, channelIds, tagIds, blockedTagNames });

      const session = request.session as SessionData | undefined;
      if (session?.user) {
        session.user.orientations = orientations;
        await session.save();
      }

      return reply.send(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'TAG_NOT_FOUND') {
        return badRequest(reply, 'TAG_NOT_FOUND');
      }
      app.log.error({ error }, 'Failed to save onboarding preferences');
      throw error;
    }
  });

  done();
};
