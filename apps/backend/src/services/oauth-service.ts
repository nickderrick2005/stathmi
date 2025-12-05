import type { SessionUser } from '@opz-hub/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { UserRepository } from '../repositories/userRepository.js';

/**
 * Discord OAuth payload
 */
export interface DiscordOAuthUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  avatar_decoration_data: unknown | null;
  discriminator: string;
  public_flags: number;
  flags: number;
  banner: string | null;
  accent_color: number | null;
  locale: string;
  mfa_enabled: boolean;
  premium_type: number;
  verified: boolean;
  email: string | null;
}

export interface HandleDiscordUserOptions {
  guildRoles?: string[];
}

/**
 * Handles Discord OAuth user lifecycle (create/update + session payload)
 */
export class OAuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly logger: FastifyBaseLogger
  ) {}

  async handleDiscordUser(discordUser: DiscordOAuthUser, options: HandleDiscordUserOptions = {}): Promise<SessionUser> {
    const { id: discordId, username } = discordUser;
    const normalizedGuildRoles = (options.guildRoles ?? []).map((role) => role.trim()).filter(Boolean);

    try {
      const existingUser = await this.userRepository.getUserByDiscordId(discordId);
      if (!existingUser) {
        this.logger.info(`Creating new user from Discord: ${discordId} (${username})`);
      } else {
        this.logger.info(`User login: ${discordId} (${username})`);
      }

      const isAdmin = this.isUserAdmin(discordId, normalizedGuildRoles);
      // 用户信息（username/avatar/discordRoles）从 public schema 读取，由 Bot 维护
      const upsertedUser = await this.userRepository.upsertUser({
        discordId,
        isAdmin,
      });

      if (!existingUser) {
        const settings = await this.userRepository.getUserSettings(discordId);
        if (!settings) {
          await this.userRepository.createUserSettings(discordId);
        }
      }

      const sessionRoles = new Set<string>(['member']);
      if (isAdmin) {
        sessionRoles.add('admin');
      }
      for (const role of upsertedUser.discordRoles) {
        sessionRoles.add(`discord:${role}`);
      }

      return {
        id: upsertedUser.id,
        username: upsertedUser.username,
        nickname: upsertedUser.nickname,
        globalName: upsertedUser.globalName,
        avatar: upsertedUser.avatar,
        roles: Array.from(sessionRoles),
        isAdmin: upsertedUser.isAdmin,
        lastLogin: new Date().toISOString(),
        discordRoles: upsertedUser.discordRoles,
        orientations: upsertedUser.orientations ?? [],
      };
    } catch (error) {
      this.logger.error({ error, discordId }, 'Failed to handle Discord user');
      throw error;
    }
  }

  private isUserAdmin(userId: string, guildRoles: string[]): boolean {
    const adminRoleIds = (process.env.DISCORD_ADMIN_ROLE_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (adminRoleIds.length && guildRoles.some((role) => adminRoleIds.includes(role))) {
      return true;
    }

    const adminIds = (process.env.ADMIN_USER_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return adminIds.includes(userId);
  }
}
