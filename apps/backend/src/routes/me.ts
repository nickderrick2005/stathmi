import type { FastifyPluginCallback } from 'fastify';
import { appContext } from '../container.js';
import { authMiddleware } from '../middleware/auth.js';
import { toNumber } from '../utils/query.js';
import type { SessionData } from '../lib/session-store.js';

export const meRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const { postMembersRepository, postsService, userRepository } = appContext;

  app.get(
    '/threads/participated',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>;
      const limit = toNumber(query?.limit, 10);
      const offset = toNumber(query?.offset, 0);
      const includeInvalid = query?.include_invalid === 'true';
      const userId = request.ctx!.userId;

      const { threadIds, total } = await postMembersRepository.listParticipatedThreadIds(
        userId,
        limit,
        offset,
        includeInvalid
      );

      if (threadIds.length === 0) {
        return reply.send({ posts: [], total });
      }

      const posts = await postsService.findByIds(threadIds, includeInvalid);
      const postMap = new Map(posts.map((post) => [post.id, post]));
      const orderedPosts = threadIds.map((id) => postMap.get(id)).filter((post): post is NonNullable<typeof post> => Boolean(post));

      return reply.send({ posts: orderedPosts, total });
    }
  );

  // 获取关注 Feed 上次查看时间
  app.get('/following-feed-viewed-at', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.ctx!.userId;
    const viewedAt = await userRepository.getFollowingFeedViewedAt(userId);
    return reply.send({ viewedAt });
  });

  // 更新关注 Feed 上次查看时间
  app.put('/following-feed-viewed-at', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.ctx!.userId;
    const body = request.body as { viewedAt?: string };
    const viewedAt = body?.viewedAt ? new Date(body.viewedAt) : new Date();
    await userRepository.updateFollowingFeedViewedAt(userId, viewedAt);
    return reply.send({ success: true });
  });

  // 更新用户取向
  app.put('/orientations', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.ctx!.userId;
    const body = request.body as { orientations?: string[] };
    const orientations = Array.isArray(body?.orientations) ? body.orientations.filter(Boolean) : [];
    await userRepository.updateUserOrientations(userId, orientations);
    // 同步更新 session，避免用户刷新页面后丢失更新
    const session = request.session as SessionData | undefined;
    if (session?.user) {
      session.user.orientations = orientations;
      await session.save();
    }
    return reply.send({ success: true });
  });

  // 清除用户数据（保留账号）
  app.delete('/data', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.ctx!.userId;
    await userRepository.clearUserData(userId);
    return reply.send({ success: true });
  });

  done();
};
