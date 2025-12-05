import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';
import type {
  Author,
  AuthorAutocompleteItem,
  ChannelStats,
  UserName,
  UserNameRole,
  UserProfile,
  UserSettings,
} from '@opz-hub/shared';
import type { DB, Users, UserSettings as DbUserSettings, UserData, UserRoles, Roles } from '../../types/database.js';
import type { UpsertUserParams, UpsertUserResult, UserRepository } from '../userRepository.js';
import { wrapDbError } from '../../utils/dbErrors.js';

const toIsoString = (value: Date | string | null | undefined): string => {
  if (!value) return new Date(0).toISOString();
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString();
};

export class KyselyUserRepository implements UserRepository {
  constructor(private readonly db: Kysely<DB>) {}

  private async fetchUserData(userId: string): Promise<Selectable<UserData> | null> {
    const row = await this.db
      .withSchema('public')
      .selectFrom('user_data')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return row ?? null;
  }

  private async fetchActiveRoles(userId: string): Promise<string[]> {
    const rows = await this.db
      .withSchema('public')
      .selectFrom('user_roles')
      .select('role_id')
      .where('user_id', '=', userId)
      .where('is_active', '=', true)
      .execute();
    return rows.map((row) => String((row as unknown as UserRoles).role_id));
  }

  // 批量获取多个用户的角色（消除 N+1 查询）
  private async fetchActiveRolesBatch(userIds: string[]): Promise<Map<string, string[]>> {
    if (userIds.length === 0) return new Map();

    const rows = await this.db
      .withSchema('public')
      .selectFrom('user_roles')
      .select(['user_id', 'role_id'])
      .where('user_id', 'in', userIds)
      .where('is_active', '=', true)
      .execute();

    const rolesMap = new Map<string, string[]>();
    for (const row of rows) {
      const userId = String((row as unknown as UserRoles).user_id);
      const roleId = String((row as unknown as UserRoles).role_id);
      const existing = rolesMap.get(userId) ?? [];
      existing.push(roleId);
      rolesMap.set(userId, existing);
    }
    return rolesMap;
  }

  async getUserByDiscordId(discordId: string): Promise<UserProfile | null> {
    return wrapDbError('KyselyUserRepository.getUserByDiscordId', async () => {
      const [userRow, publicRow, roles] = await Promise.all([
        this.db
          .withSchema('web_app')
          .selectFrom('users')
          .selectAll()
          .where('discord_id', '=', discordId)
          .executeTakeFirst(),
        this.fetchUserData(discordId),
        this.fetchActiveRoles(discordId),
      ]);

      if (!userRow && !publicRow) return null;
      return this.mapToUserProfile(userRow ?? ({} as Selectable<Users>), publicRow, roles);
    });
  }

  async getUserById(userId: string): Promise<UserProfile | null> {
    return wrapDbError('KyselyUserRepository.getUserById', async () => {
      const [userRow, publicRow, roles] = await Promise.all([
        this.db
          .withSchema('web_app')
          .selectFrom('users')
          .selectAll()
          .where('discord_id', '=', userId)
          .executeTakeFirst(),
        this.fetchUserData(userId),
        this.fetchActiveRoles(userId),
      ]);

      if (!userRow && !publicRow) return null;
      return this.mapToUserProfile(userRow ?? ({} as Selectable<Users>), publicRow, roles);
    });
  }

  async getUsersByIds(userIds: string[]): Promise<UserProfile[]> {
    return wrapDbError('KyselyUserRepository.getUsersByIds', async () => {
      const ids = Array.from(new Set(userIds.map((id) => String(id)).filter(Boolean)));
      if (ids.length === 0) return [];

      const [userRows, publicRows, roleRows] = await Promise.all([
        this.db.withSchema('web_app').selectFrom('users').selectAll().where('discord_id', 'in', ids).execute(),
        this.db.withSchema('public').selectFrom('user_data').selectAll().where('user_id', 'in', ids).execute(),
        this.db
          .withSchema('public')
          .selectFrom('user_roles')
          .select(['user_id', 'role_id'])
          .where('user_id', 'in', ids)
          .where('is_active', '=', true)
          .execute(),
      ]);

      const publicMap = new Map(publicRows.map((row) => [String(row.user_id), row as Selectable<UserData>]));
      const rolesMap = new Map<string, string[]>();
      for (const row of roleRows) {
        const userId = String((row as unknown as UserRoles).user_id);
        const roleId = String((row as unknown as UserRoles).role_id);
        rolesMap.set(userId, [...(rolesMap.get(userId) ?? []), roleId]);
      }

      return ids
        .map((id) => {
          const userRow = userRows.find((row) => row.discord_id === id);
          const publicRow = publicMap.get(id) ?? null;
          const roles = rolesMap.get(id) ?? [];
          if (!userRow && !publicRow) return null;
          return this.mapToUserProfile(userRow ?? ({} as Selectable<Users>), publicRow, roles);
        })
        .filter(Boolean) as UserProfile[];
    });
  }

  async getUserNamesByIds(userIds: string[]): Promise<UserName[]> {
    return wrapDbError('KyselyUserRepository.getUserNamesByIds', async () => {
      const ids = Array.from(new Set(userIds.map((id) => String(id)).filter(Boolean)));
      if (ids.length === 0) return [];

      // 1. 获取用户基础数据
      const userDataRows = await this.db
        .withSchema('public')
        .selectFrom('user_data')
        .select(['user_id', 'user_nickname', 'user_global_name', 'user_username', 'user_avatar_url'])
        .where('user_id', 'in', ids)
        .execute();

      // 2. 获取用户角色（只取 is_active=true）
      const userRoleRows = await this.db
        .withSchema('public')
        .selectFrom('user_roles')
        .select(['user_id', 'role_id'])
        .where('user_id', 'in', ids)
        .where('is_active', '=', true)
        .execute();

      // 3. 获取所有相关角色的元数据（只取 is_deleted=false）
      const roleIds = [...new Set(userRoleRows.map((r) => String((r as unknown as UserRoles).role_id)))];
      const roleMetaRows =
        roleIds.length > 0
          ? await this.db
              .withSchema('public')
              .selectFrom('roles')
              .select(['role_id', 'role_name', 'role_icon_url', 'role_emoji', 'role_primary_color'])
              .where('role_id', 'in', roleIds)
              .where('is_deleted', '=', false)
              .execute()
          : [];

      // 构建角色元数据映射
      const roleMetaMap = new Map<string, Selectable<Roles>>();
      for (const role of roleMetaRows) {
        roleMetaMap.set(String(role.role_id), role as Selectable<Roles>);
      }

      // 构建用户->角色ID列表映射
      const userRolesMap = new Map<string, string[]>();
      for (const row of userRoleRows) {
        const userId = String((row as unknown as UserRoles).user_id);
        const roleId = String((row as unknown as UserRoles).role_id);
        userRolesMap.set(userId, [...(userRolesMap.get(userId) ?? []), roleId]);
      }

      // 构建用户数据映射
      const userDataMap = new Map<string, Selectable<UserData>>();
      for (const row of userDataRows) {
        userDataMap.set(String(row.user_id), row as Selectable<UserData>);
      }

      // 按请求顺序返回结果
      const results: UserName[] = [];
      for (const id of ids) {
        const userData = userDataMap.get(id);
        if (!userData) continue;

        const nickname = userData.user_nickname ?? undefined;
        const globalName = userData.user_global_name ?? undefined;
        const username = userData.user_username;
        const displayName = nickname ?? globalName ?? username;

        const userRoleIds = userRolesMap.get(id) ?? [];
        const roles: UserNameRole[] = [];
        for (const roleId of userRoleIds) {
          const meta = roleMetaMap.get(roleId);
          if (!meta) continue;
          roles.push({
            roleId,
            roleName: meta.role_name,
            roleIconUrl: meta.role_icon_url ?? undefined,
            roleEmoji: meta.role_emoji ?? undefined,
            color: meta.role_primary_color ? this.bigIntToHexColor(meta.role_primary_color) : undefined,
          });
        }

        results.push({
          id,
          nickname,
          globalName,
          username,
          displayName,
          avatar: userData.user_avatar_url,
          roles,
        });
      }
      return results;
    });
  }

  async getUserPostStats(userId: string): Promise<{ totalLikes: number; totalComments: number; channelStats: ChannelStats[] }> {
    return wrapDbError('KyselyUserRepository.getUserPostStats', async () => {
      const [aggregateRow, channelRows] = await Promise.all([
        this.db
          .selectFrom('posts_main as p')
          .select([
            sql<number>`COALESCE(SUM(p.reaction_count), 0)`.as('totalLikes'),
            sql<number>`COALESCE(SUM(p.reply_count), 0)`.as('totalComments'),
          ])
          .where('p.author_id', '=', userId)
          .where('p.is_deleted', '=', false)
          .where('p.is_valid', '=', true)
          .executeTakeFirst(),
        this.db
          .selectFrom('posts_main as p')
          .select([
            sql<string>`CAST(p.channel_id AS TEXT)`.as('channelId'),
            sql<string>`COALESCE(p.channel_name, '')`.as('channelName'),
            sql<number>`COUNT(*)`.as('postCount'),
          ])
          .where('p.author_id', '=', userId)
          .where('p.is_deleted', '=', false)
          .where('p.is_valid', '=', true)
          .groupBy(['p.channel_id', 'p.channel_name'])
          .execute(),
      ]);

      const typedChannelRows = (channelRows ?? []) as {
        channelId: string;
        channelName: string | null;
        postCount: number | null;
      }[];

      const channelStats: ChannelStats[] = typedChannelRows
        .map((row) => ({
          channelId: String(row.channelId),
          channelName: row.channelName ?? '',
          postCount: Number(row.postCount ?? 0),
        }))
        .sort((a, b) => b.postCount - a.postCount);

      return {
        totalLikes: Number(aggregateRow?.totalLikes ?? 0),
        totalComments: Number(aggregateRow?.totalComments ?? 0),
        channelStats,
      };
    });
  }

  async getUserFollowStats(userId: string): Promise<{ followers: number; following: number }> {
    return wrapDbError('KyselyUserRepository.getUserFollowStats', async () => {
      const [followersMap, followingRow] = await Promise.all([
        this.getFollowerCounts([userId]),
        this.db
          .withSchema('web_app')
          .selectFrom('user_follows')
          .select((eb) => eb.fn.countAll<number>().as('count'))
          .where('follower_id', '=', userId)
          .executeTakeFirst(),
      ]);

      return {
        followers: followersMap.get(userId) ?? 0,
        following: Number(followingRow?.count ?? 0),
      };
    });
  }

  async getUserFirstPostAt(userId: string): Promise<string | null> {
    return wrapDbError('KyselyUserRepository.getUserFirstPostAt', async () => {
      const row = await this.db
        .selectFrom('posts_main as p')
        .select('p.created_at')
        .where('p.author_id', '=', userId)
        .where('p.is_deleted', '=', false)
        .where('p.is_valid', '=', true)
        .orderBy('p.created_at', 'asc')
        .limit(1)
        .executeTakeFirst();

      return row?.created_at ? toIsoString(row.created_at as unknown as Date | string) : null;
    });
  }

  private bigIntToHexColor(value: string | bigint | number | null): string | undefined {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'bigint' ? value : BigInt(value);
    if (num === 0n) return undefined;
    return '#' + num.toString(16).padStart(6, '0').toUpperCase();
  }

  async createUser(data: { discordId: string }): Promise<UserProfile> {
    return wrapDbError('KyselyUserRepository.createUser', async () => {
      const row = await this.db
        .withSchema('web_app')
        .insertInto('users')
        .values({
          discord_id: data.discordId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const publicRow = await this.fetchUserData(data.discordId);
      const roles = await this.fetchActiveRoles(data.discordId);
      return this.mapToUserProfile(row, publicRow, roles);
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    return wrapDbError('KyselyUserRepository.updateLastLogin', async () => {
      await this.db
        .withSchema('web_app')
        .updateTable('users')
        .set({ last_login: new Date() })
        .where('discord_id', '=', userId)
        .execute();
    });
  }

  async listAuthors(): Promise<Author[]> {
    return wrapDbError('KyselyUserRepository.listAuthors', async () => {
      const publicRows = await this.db.withSchema('public').selectFrom('user_data').selectAll().execute();
      const ids = publicRows.map((row) => String(row.user_id));

      // 使用批量查询，避免 N+1 问题
      const [followerCounts, rolesByUser] = await Promise.all([
        this.getFollowerCounts(ids),
        this.fetchActiveRolesBatch(ids),
      ]);

      return publicRows.map((row) => {
        const id = String(row.user_id);
        return {
          id,
          username: row.user_username,
          avatar: row.user_avatar_url ?? '',
          discordRoles: rolesByUser.get(id) ?? [],
          joinedAt: new Date().toISOString(), // user_data 没有 created_at，使用当前时间
          followers: followerCounts.get(id) ?? 0,
          following: 0,
        } satisfies Author;
      });
    });
  }

  async getAuthorsByIds(authorIds: string[]): Promise<Author[]> {
    return wrapDbError('KyselyUserRepository.getAuthorsByIds', async () => {
      const ids = Array.from(new Set(authorIds.filter(Boolean)));
      if (ids.length === 0) return [];

      const publicRows = await this.db
        .withSchema('public')
        .selectFrom('user_data')
        .selectAll()
        .where('user_id', 'in', ids)
        .execute();

      // 使用批量查询，避免 N+1 问题
      const [followerCounts, rolesByUser] = await Promise.all([
        this.getFollowerCounts(ids),
        this.fetchActiveRolesBatch(ids),
      ]);

      return publicRows.map((row) => {
        const id = String(row.user_id);
        return {
          id,
          username: row.user_username,
          nickname: row.user_nickname ?? undefined,
          globalName: row.user_global_name ?? undefined,
          avatar: row.user_avatar_url ?? '',
          discordRoles: rolesByUser.get(id) ?? [],
          joinedAt: new Date().toISOString(),
          followers: followerCounts.get(id) ?? 0,
          following: 0,
        } satisfies Author;
      });
    });
  }

  async getUserSettings(userId: string): Promise<UserSettings | null> {
    return wrapDbError('KyselyUserRepository.getUserSettings', async () => {
      const row = await this.db
        .withSchema('web_app')
        .selectFrom('user_settings')
        .selectAll()
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!row) return null;

      // 从 public.user_blocked_authors 表获取 blocked_authors
      const blockedAuthors = await this.getBlockedAuthors(userId);
      return this.mapToUserSettings(row, blockedAuthors);
    });
  }

  async updateUserSettings(userId: string, partial: Partial<UserSettings>): Promise<UserSettings> {
    return wrapDbError('KyselyUserRepository.updateUserSettings', async () => {
      const updateData: Record<string, unknown> = {};

      if (partial.preferredTags !== undefined) {
        updateData.preferred_tags = partial.preferredTags;
      }
      if (partial.hiddenTags !== undefined) {
        updateData.hidden_tags = partial.hiddenTags;
      }
      if (partial.preferredKeywords !== undefined) {
        updateData.preferred_keywords = partial.preferredKeywords;
      }
      if (partial.hiddenKeywords !== undefined) {
        updateData.hidden_keywords = partial.hiddenKeywords;
      }
      if (partial.blockedPosts !== undefined) {
        updateData.blocked_posts = partial.blockedPosts;
      }
      if (partial.theme !== undefined) {
        updateData.theme = partial.theme;
      }
      if (partial.customCss !== undefined) {
        updateData.custom_css = partial.customCss;
      }
      if (partial.displayMode !== undefined) {
        updateData.display_mode = partial.displayMode;
      }
      if (partial.paginationStyle !== undefined) {
        updateData.pagination_style = partial.paginationStyle;
      }
      if (partial.imageLoadMode !== undefined) {
        updateData.image_load_mode = partial.imageLoadMode;
      }
      if (partial.discordLinkMode !== undefined) {
        updateData.discord_link_mode = partial.discordLinkMode;
      }
      if (partial.cardTitleFontOffset !== undefined) {
        // 范围校验：-3 ~ 3
        updateData.card_title_font_offset = Math.max(-3, Math.min(3, partial.cardTitleFontOffset));
      }
      if (partial.cardContentFontOffset !== undefined) {
        // 范围校验：-3 ~ 3
        updateData.card_content_font_offset = Math.max(-3, Math.min(3, partial.cardContentFontOffset));
      }
      if (partial.authorRoleColorEnabled !== undefined) {
        updateData.author_role_color_enabled = partial.authorRoleColorEnabled;
      }
      if (partial.featuredPostId !== undefined) {
        updateData.featured_post_id = partial.featuredPostId ?? null;
      }

      // blocked_authors 写入 public.user_blocked_authors 表
      if (partial.blockedAuthors !== undefined) {
        await this.syncBlockedAuthors(userId, partial.blockedAuthors);
      }

      const row = await this.db
        .withSchema('web_app')
        .updateTable('user_settings')
        .set({
          ...updateData,
          updated_at: new Date(),
        })
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirstOrThrow();

      // 获取实际的 blocked_authors 从 public 表读取
      const blockedAuthors = await this.getBlockedAuthors(userId);

      return this.mapToUserSettings(row, blockedAuthors);
    });
  }

  /**
   * 同步 blocked_authors 到 public.user_blocked_authors 表
   * 使用差量更新：添加新增的，删除移除的
   */
  private async syncBlockedAuthors(userId: string, newBlockedAuthors: string[]): Promise<void> {
    // 获取当前已屏蔽的作者
    const currentRows = await this.db
      .withSchema('public')
      .selectFrom('user_blocked_authors')
      .select('blocked_author_id')
      .where('user_id', '=', userId)
      .execute();

    const currentSet = new Set(currentRows.map((r) => String(r.blocked_author_id)));
    const newSet = new Set(newBlockedAuthors);

    // 需要添加的
    const toAdd = newBlockedAuthors.filter((id) => !currentSet.has(id));
    // 需要删除的
    const toRemove = [...currentSet].filter((id) => !newSet.has(id));

    // 批量删除
    if (toRemove.length > 0) {
      await this.db
        .withSchema('public')
        .deleteFrom('user_blocked_authors')
        .where('user_id', '=', userId)
        .where('blocked_author_id', 'in', toRemove)
        .execute();
    }

    // 批量插入
    if (toAdd.length > 0) {
      await this.db
        .withSchema('public')
        .insertInto('user_blocked_authors')
        .values(
          toAdd.map((authorId) => ({
            user_id: userId,
            blocked_author_id: authorId,
            added_at: new Date(),
          }))
        )
        .execute();
    }
  }

  /**
   * 从 public.user_blocked_authors 表获取用户屏蔽的作者列表
   */
  private async getBlockedAuthors(userId: string): Promise<string[]> {
    const rows = await this.db
      .withSchema('public')
      .selectFrom('user_blocked_authors')
      .select('blocked_author_id')
      .where('user_id', '=', userId)
      .execute();

    return rows.map((r) => String(r.blocked_author_id));
  }

  async createUserSettings(userId: string): Promise<UserSettings> {
    return wrapDbError('KyselyUserRepository.createUserSettings', async () => {
      const row = await this.db
        .withSchema('web_app')
        .insertInto('user_settings')
        .values({
          user_id: userId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 新用户没有 blocked_authors，传空数组
      const blockedAuthors = await this.getBlockedAuthors(userId);
      return this.mapToUserSettings(row, blockedAuthors);
    });
  }

  async upsertUser(data: UpsertUserParams): Promise<UpsertUserResult> {
    return wrapDbError('KyselyUserRepository.upsertUser', async () => {
      // 只存储网站专有数据，用户信息从 public schema 读取
      const row = await this.db
        .withSchema('web_app')
        .insertInto('users')
        .values({
          discord_id: data.discordId,
          is_admin: data.isAdmin,
          last_login: new Date(),
        })
        .onConflict((oc) =>
          oc.column('discord_id').doUpdateSet({
            is_admin: data.isAdmin,
            last_login: new Date(),
          })
        )
        .returning(['discord_id', 'orientations', 'is_admin'])
        .executeTakeFirstOrThrow();

      // 从 public schema 读取用户信息
      const [publicRow, roles] = await Promise.all([
        this.fetchUserData(data.discordId),
        this.fetchActiveRoles(data.discordId),
      ]);

      return {
        id: row.discord_id,
        username: publicRow?.user_username ?? 'Unknown',
        nickname: publicRow?.user_nickname ?? undefined,
        globalName: publicRow?.user_global_name ?? undefined,
        avatar: publicRow?.user_avatar_url ?? null,
        orientations: Array.isArray(row.orientations) ? row.orientations : [],
        isAdmin: row.is_admin ?? false,
        discordRoles: roles,
      };
    });
  }

  private mapToUserProfile(
    row: Selectable<Users> | null,
    publicRow: Selectable<UserData> | null,
    roles: string[] = []
  ): UserProfile {
    // 用户信息优先从 public.user_data 读取（由 Bot 维护）
    const username = publicRow?.user_username ?? 'Unknown';
    const avatar = publicRow?.user_avatar_url ?? '';
    return {
      id: row?.discord_id ?? (publicRow ? String(publicRow.user_id) : ''),
      username,
      nickname: publicRow?.user_nickname ?? undefined,
      globalName: publicRow?.user_global_name ?? undefined,
      avatar,
      discordRoles: roles,
      joinedAt: toIsoString(row?.created_at as Date | string | undefined),
      followers: 0,
      following: 0,
    };
  }

  private mapToUserSettings(row: Selectable<DbUserSettings>, blockedAuthors: string[] = []): UserSettings {
    // 处理 Generated 类型
    const preferredTags = Array.isArray(row.preferred_tags) ? row.preferred_tags : [];
    const hiddenTags = Array.isArray(row.hidden_tags) ? row.hidden_tags : [];
    const blockedPosts = Array.isArray(row.blocked_posts) ? row.blocked_posts.map((v) => String(v)) : [];
    const preferredKeywords = Array.isArray(row.preferred_keywords) ? row.preferred_keywords : [];
    const hiddenKeywords = Array.isArray(row.hidden_keywords) ? row.hidden_keywords : [];
    const featuredPostId = row.featured_post_id ? String(row.featured_post_id) : null;

    return {
      preferredTags,
      hiddenTags,
      blockedAuthors, // 从 public.user_blocked_authors 表获取
      blockedPosts,
      preferredKeywords,
      hiddenKeywords,
      theme: row.theme as UserSettings['theme'],
      customCss: row.custom_css ?? undefined,
      displayMode: row.display_mode as UserSettings['displayMode'],
      paginationStyle: row.pagination_style as UserSettings['paginationStyle'],
      imageLoadMode: row.image_load_mode as UserSettings['imageLoadMode'],
      discordLinkMode: row.discord_link_mode as UserSettings['discordLinkMode'],
      cardTitleFontOffset: row.card_title_font_offset ?? 0,
      cardContentFontOffset: row.card_content_font_offset ?? 0,
      authorRoleColorEnabled: row.author_role_color_enabled ?? true,
      featuredPostId,
      updatedAt: toIsoString(row.updated_at as unknown as Date | string),
    };
  }

  async updateUserOrientations(userId: string, orientations: string[]): Promise<void> {
    return wrapDbError('KyselyUserRepository.updateUserOrientations', async () => {
      await this.db
        .withSchema('web_app')
        .updateTable('users')
        .set({ orientations })
        .where('discord_id', '=', userId)
        .execute();
    });
  }

  private async getFollowerCounts(authorIds: string[]): Promise<Map<string, number>> {
    if (authorIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .withSchema('web_app')
      .selectFrom('user_follows as uf')
      .select(['uf.author_id as authorId', this.db.fn.countAll<number>().as('count')])
      .where('uf.author_id', 'in', authorIds)
      .groupBy('uf.author_id')
      .execute();

    return new Map(rows.map((row) => [String(row.authorId), Number(row.count)]));
  }

  async getFollowingFeedViewedAt(userId: string): Promise<string | null> {
    return wrapDbError('KyselyUserRepository.getFollowingFeedViewedAt', async () => {
      const row = await this.db
        .withSchema('web_app')
        .selectFrom('users')
        .select('following_feed_viewed_at')
        .where('discord_id', '=', userId)
        .executeTakeFirst();

      return row?.following_feed_viewed_at
        ? toIsoString(row.following_feed_viewed_at as unknown as Date | string)
        : null;
    });
  }

  async updateFollowingFeedViewedAt(userId: string, viewedAt: Date): Promise<void> {
    return wrapDbError('KyselyUserRepository.updateFollowingFeedViewedAt', async () => {
      await this.db
        .withSchema('web_app')
        .updateTable('users')
        .set({ following_feed_viewed_at: viewedAt })
        .where('discord_id', '=', userId)
        .execute();
    });
  }

  /**
   * 清除用户数据（保留账号本身）
   * 清理范围：settings、follows、follow_tags、subarea_follows、notifications、blocked_authors、favorites
   * 使用事务确保原子性
   */
  async clearUserData(userId: string): Promise<void> {
    return wrapDbError('KyselyUserRepository.clearUserData', async () => {
      await this.db.transaction().execute(async (trx) => {
        // web_app schema 表
        await trx.withSchema('web_app').deleteFrom('user_notifications').where('user_id', '=', userId).execute();
        await trx.withSchema('web_app').deleteFrom('user_follows').where('follower_id', '=', userId).execute();
        await trx.withSchema('web_app').deleteFrom('user_follow_tags').where('user_id', '=', userId).execute();
        await trx.withSchema('web_app').deleteFrom('user_subarea_follows').where('user_id', '=', userId).execute();
        await trx.withSchema('web_app').deleteFrom('user_settings').where('user_id', '=', userId).execute();

        // public schema 表
        await trx.withSchema('public').deleteFrom('user_blocked_authors').where('user_id', '=', userId).execute();
        await trx.withSchema('public').deleteFrom('user_favorite_posts').where('user_id', '=', userId).execute();
        await trx.withSchema('public').deleteFrom('user_push_list').where('user_id', '=', userId).execute();

        // 重置 users 表的非关键字段
        await trx
          .withSchema('web_app')
          .updateTable('users')
          .set({
            orientations: [],
            following_feed_viewed_at: null,
          })
          .where('discord_id', '=', userId)
          .execute();
      });
    });
  }

  /**
   * 搜索作者（自动补全）
   * 支持按 username/nickname/globalName/id 模糊匹配
   */
  async searchAuthors(query: string, limit: number): Promise<AuthorAutocompleteItem[]> {
    return wrapDbError('KyselyUserRepository.searchAuthors', async () => {
      const pattern = `%${query}%`;
      const lowerQuery = query.toLowerCase();

      const rows = await this.db
        .withSchema('public')
        .selectFrom('user_data')
        .select(['user_id', 'user_username', 'user_nickname', 'user_global_name', 'user_avatar_url', 'user_thread_count'])
        .where('user_thread_count', '>', 0)
        .where((eb) =>
          eb.or([
            eb('user_username', 'ilike', pattern),
            eb('user_nickname', 'ilike', pattern),
            eb('user_global_name', 'ilike', pattern),
            sql<boolean>`CAST(user_id AS TEXT) LIKE ${query}`,
          ])
        )
        // 精确匹配优先，然后按作品数量降序
        .orderBy(
          sql`CASE
            WHEN LOWER(user_username) = ${lowerQuery} THEN 0
            WHEN LOWER(user_nickname) = ${lowerQuery} THEN 1
            WHEN LOWER(user_global_name) = ${lowerQuery} THEN 2
            ELSE 3
          END`
        )
        .orderBy('user_thread_count', 'desc')
        .limit(limit)
        .execute();

      // 批量获取角色
      const userIds = rows.map((r) => String(r.user_id));
      const rolesMap = await this.fetchActiveRolesBatch(userIds);

      return rows.map((row) => {
        const id = String(row.user_id);
        return {
          id,
          username: row.user_username,
          nickname: row.user_nickname ?? undefined,
          globalName: row.user_global_name ?? undefined,
          displayName: row.user_nickname ?? row.user_global_name ?? row.user_username,
          avatar: row.user_avatar_url ?? '',
          threadCount: row.user_thread_count ?? 0,
          discordRoles: rolesMap.get(id) ?? [],
        };
      });
    });
  }
}
