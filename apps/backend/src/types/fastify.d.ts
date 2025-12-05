import type { Kysely } from 'kysely';
import type fastifyOauth2 from '@fastify/oauth2';
import type { SessionData } from '../lib/session-store.js';
import type { DB } from './database.js';
import type { RequestContext } from './request-context.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Kysely<DB>;
    discordOAuth2?: fastifyOauth2.OAuth2Namespace;
  }

  interface FastifyRequest {
    db: Kysely<DB>;
    ctx?: RequestContext;
    session: SessionData;
  }
}
