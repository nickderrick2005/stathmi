import type { FastifyPluginCallback } from 'fastify';
import type { LookupResponse } from '@opz-hub/shared';
import { appContext } from '../container.js';

type LookupRequestBody = {
  postIds?: unknown;
  userIds?: unknown;
  includeInvalid?: unknown;
};

const normalizeIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((v) => String(v)).filter(Boolean)));
};

export const lookupRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const { postsService, userService } = appContext;

  // 批量查询完整帖子和用户信息
  app.post<{ Body: LookupRequestBody; Reply: LookupResponse }>('/', async (request, reply) => {
    const body = request.body ?? {};
    const postIds = normalizeIds(body.postIds);
    const userIds = normalizeIds(body.userIds);
    const includeInvalid = body.includeInvalid === true || body.includeInvalid === 'true';

    const [posts, users] = await Promise.all([
      postIds.length ? postsService.findByThreadOrMessageIds(postIds, includeInvalid) : [],
      userIds.length ? userService.getUsersByIds(userIds) : [],
    ]);

    const response: LookupResponse = {
      posts: Object.fromEntries(posts.map((post) => [post.id, post])),
      users: Object.fromEntries(users.map((user) => [user.id, user])),
    };

    return reply.send(response);
  });

  done();
};
