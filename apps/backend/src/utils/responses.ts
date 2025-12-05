import type { FastifyReply } from 'fastify';
import { ErrorCode } from '@opz-hub/shared';

export const badRequest = (reply: FastifyReply, message: string) =>
  reply.status(400).send({
    error: {
      code: ErrorCode.InvalidInput,
      message,
    },
  });

export const notFound = (reply: FastifyReply, message: string) =>
  reply.status(404).send({
    error: {
      code: ErrorCode.NotFound,
      message,
    },
  });
