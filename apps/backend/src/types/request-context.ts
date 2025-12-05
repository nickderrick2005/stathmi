import type { FastifyRequest } from 'fastify';
import type { SessionData } from '../lib/session-store.js';

export interface RequestContext {
  userId: string;
  session: {
    id: string;
    username: string;
    nickname?: string;
    globalName?: string;
    avatar: string | null;
    roles: string[];
    isAdmin: boolean;
    lastLogin: string;
    discordRoles: string[];
    orientations: string[];
  };
}

export class UnauthorizedError extends Error {
  public readonly statusCode = 401;

  constructor(message = 'Unauthorized') {
    super(message);
  }
}

interface SessionContainer extends SessionData {
  user?: SessionData['user'];
}

/**
 * Extracts session info from Fastify request and ensures a logged-in user exists.
 */
export const createRequestContext = (request: FastifyRequest): RequestContext => {
  const session = request.session as SessionContainer | undefined;
  const user = session?.user;

  if (!user || !user.id) {
    throw new UnauthorizedError('Session is required');
  }

  return {
    userId: user.id,
    session: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      globalName: user.globalName,
      avatar: user.avatar ?? null,
      roles: user.roles,
      isAdmin: user.isAdmin,
      lastLogin: user.lastLogin ?? new Date().toISOString(),
      discordRoles: user.discordRoles ?? [],
      orientations: user.orientations ?? [],
    },
  };
};
