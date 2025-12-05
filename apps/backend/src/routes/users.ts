import type { FastifyPluginCallback } from 'fastify';
import type { AuthorAutocompleteResponse, UserNamesRequest, UserNamesResponse, UserProfileSort } from '@opz-hub/shared';
import { appContext } from '../container.js';
import { toNumber } from '../utils/query.js';
import { notFound } from '../utils/responses.js';
import type { SortOption } from '../repositories/search/postsSearchRepository.js';
import { authMiddleware } from '../middleware/auth.js';

const normalizeIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((v) => String(v)).filter(Boolean)));
};

const parseUserPostsSort = (sort: unknown): SortOption => {
  const raw = typeof sort === 'string' ? (sort as UserProfileSort) : '';
  const [fieldPart, orderPart] = raw.split('-');

  const order: SortOption['order'] = orderPart === 'asc' ? 'asc' : 'desc';

  switch (fieldPart) {
    case 'created':
      return { field: 'created', order };
    case 'likes':
      return { field: 'likes', order };
    case 'updated':
      return { field: 'updated', order };
    default:
      return { field: 'updated', order: 'desc' };
  }
};

export const usersRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const { userService } = appContext;

  // 批量获取用户名称和角色（轻量级）
  app.post<{ Body: UserNamesRequest; Reply: UserNamesResponse }>('/names', async (request, reply) => {
    const body = request.body ?? {};
    const ids = normalizeIds(body.ids);

    if (ids.length === 0) {
      return reply.send({ users: [] });
    }

    const users = await userService.getUserNamesByIds(ids);
    return reply.send({ users });
  });

  // 作者自动补全
  app.get<{ Querystring: { q?: string; limit?: string }; Reply: AuthorAutocompleteResponse }>(
    '/autocomplete',
    async (request, reply) => {
      const { q, limit } = request.query;
      if (!q?.trim()) {
        return reply.send({ authors: [] });
      }
      const authors = await userService.searchAuthors(q.trim(), toNumber(limit, 10));
      return reply.send({ authors });
    }
  );

  app.get('/:id/profile', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id?: string };
    if (!id) {
      return notFound(reply, 'user id is required');
    }
    const profile = await userService.getUserProfileExtended(id);
    if (!profile) {
      return notFound(reply, 'user not found');
    }
    return reply.send(profile);
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id?: string };
    if (!id) {
      return notFound(reply, 'user id is required');
    }
    const profile = await userService.getUserProfile(id);
    if (!profile) {
      return notFound(reply, 'user not found');
    }
    return reply.send(profile);
  });

  app.get('/:id/posts', async (request, reply) => {
    const { id } = request.params as { id?: string };
    if (!id) {
      return notFound(reply, 'user id is required');
    }
    const profile = await userService.getUserProfile(id);
    if (!profile) {
      return notFound(reply, 'user not found');
    }
    const query = request.query as Record<string, unknown>;
    const limit = toNumber(query?.limit, 20);
    const offset = toNumber(query?.offset, 0);
    const channelId =
      typeof query?.channelId === 'string' && query.channelId.trim().length > 0
        ? query.channelId.trim()
        : undefined;
    const sort = parseUserPostsSort(query?.sort);
    const posts = await userService.getUserPosts(id, limit, offset, { channelId, sort });
    return reply.send(posts);
  });

  done();
};
