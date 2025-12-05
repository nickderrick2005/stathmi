import type { FastifyPluginCallback } from 'fastify';
import { appContext } from '../container.js';
import type { UserSettings } from '@opz-hub/shared';
import { authMiddleware } from '../middleware/auth.js';
import { badRequest } from '../utils/responses.js';

const VALID_IMAGE_LOAD_MODES = ['all', 'images-only', 'none'] as const;
const VALID_DISCORD_LINK_MODES = ['app', 'browser'] as const;

const isValidImageLoadMode = (mode: unknown): mode is (typeof VALID_IMAGE_LOAD_MODES)[number] =>
  typeof mode === 'string' && VALID_IMAGE_LOAD_MODES.includes(mode as (typeof VALID_IMAGE_LOAD_MODES)[number]);

const isValidDiscordLinkMode = (mode: unknown): mode is (typeof VALID_DISCORD_LINK_MODES)[number] =>
  typeof mode === 'string' && VALID_DISCORD_LINK_MODES.includes(mode as (typeof VALID_DISCORD_LINK_MODES)[number]);

export const userSettingsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const { userService } = appContext;

  app.addHook('preHandler', authMiddleware);

  app.get('/settings', async (request, reply) => {
    const userId = request.ctx!.userId;
    const session = request.ctx!.session;

    // 确保 web_app.users 记录存在（upsert 是幂等操作）
    const { userRepository } = appContext;
    await userRepository.upsertUser({
      discordId: userId,
      isAdmin: session.isAdmin,
    });

    const settings = await userService.getUserSettings(userId);
    return reply.send(settings);
  });

  app.put('/settings', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<UserSettings>;
    const userId = request.ctx!.userId;

    // 验证 imageLoadMode 枚举
    if (body.imageLoadMode !== undefined && !isValidImageLoadMode(body.imageLoadMode)) {
      return badRequest(reply, `imageLoadMode must be one of: ${VALID_IMAGE_LOAD_MODES.join(', ')}`);
    }

    // 验证 discordLinkMode 枚举
    if (body.discordLinkMode !== undefined && !isValidDiscordLinkMode(body.discordLinkMode)) {
      return badRequest(reply, `discordLinkMode must be one of: ${VALID_DISCORD_LINK_MODES.join(', ')}`);
    }

    // 字体偏移范围截断（-3 ~ 3）已在 repository 层处理，这里不需要额外验证

    try {
      const updated = await userService.updateUserSettings(userId, body);
      return reply.send(updated);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INVALID_FEATURED_POST_ID') {
          return badRequest(reply, 'featuredPostId must be a non-empty string or null');
        }
        if (error.message === 'FEATURED_POST_NOT_FOUND') {
          return badRequest(reply, 'featuredPostId does not exist');
        }
        if (error.message === 'FEATURED_POST_NOT_OWNED') {
          return badRequest(reply, 'featuredPostId must belong to the current user');
        }
      }
      throw error;
    }
  });

  done();
};
