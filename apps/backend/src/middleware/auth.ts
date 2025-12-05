import type { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode } from '@opz-hub/shared';
import { createRequestContext, UnauthorizedError } from '../types/request-context.js';

export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    request.ctx = createRequestContext(request);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return reply.code(401).send({
        error: {
          code: ErrorCode.Unauthorized,
          message: error.message,
        },
      });
    }
    throw error;
  }
};

export const optionalAuthMiddleware = async (request: FastifyRequest) => {
  try {
    request.ctx = createRequestContext(request);
  } catch {
    // Ignore missing session for optional auth routes
  }
};
