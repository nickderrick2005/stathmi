import type { Post } from '@opz-hub/shared';

/**
 * 数据库查询行（posts_main + user_data 联表）
 */
export type PostDbRow = {
  thread_id: string;
  title: string;
  first_message_content: string | null;
  author_id: string;
  attachment_urls: unknown;
  jump_url: string;
  updated_jump_url: string | null;
  tags: string | null;
  channel_id: string;
  channel_name: string;
  created_at: Date;
  updated_at: Date | null;
  last_active_at: Date;
  reply_count: number;
  reaction_count: number | null;
  is_deleted: boolean;
  is_valid: boolean;
  user_name: string | null;
  user_avatar: string | null;
  user_discord_roles: unknown;
};

/**
 * Meilisearch 文档结构（写入/读取）
 */
export type PostSearchDoc = {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorDiscordRoles?: string[];
  attachments?: { url: string; type?: string }[];
  discordUrl: string;
  updatedJumpUrl?: string | null;
  tags?: string[];
  categoryId: string;
  categoryName: string;
  createdAt: number | string;
  updatedAt?: number | string | null;
  lastActiveAt: number | string;
  messageCount: number;
  reactionCount?: number;
  isRecommended?: boolean;
  isFollowedByUser?: boolean;
  isDeleted?: boolean;
  isValid?: boolean;
};

/**
 * 解析附件 URLs（JSONB 数组格式）
 */
const parseAttachmentUrls = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item)).filter(Boolean);
  }

  // JSON/JSONB 字符串或对象
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      // fallback handled below
    }
  }

  if (raw && typeof raw === 'object') {
    try {
      const parsed = JSON.parse(JSON.stringify(raw));
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      // ignore
    }
  }

  // 兼容旧的逗号分隔文本
  if (typeof raw === 'string' && raw.includes(',')) {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const parseDiscordRoles = (roles: unknown): string[] => {
  if (!roles) return [];
  try {
    const parsed = Array.isArray(roles) ? roles : JSON.parse(String(roles));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((role) => {
        if (typeof role === 'string' || typeof role === 'number') {
          return String(role);
        }
        if (role && typeof role === 'object' && 'role_id' in role) {
          const value = (role as { role_id?: unknown }).role_id;
          return value ? String(value) : '';
        }
        return '';
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

export const mapDbRowToPost = (row: PostDbRow): Post => {
  const attachmentUrls = parseAttachmentUrls(row.attachment_urls);

  const attachments =
    attachmentUrls.length > 0
      ? attachmentUrls.map((url) => ({
          url,
          type: 'image' as const,
        }))
      : [];

  return {
    id: String(row.thread_id),
    title: row.title,
    content: row.first_message_content ?? '',
    authorId: String(row.author_id),
    authorName: row.user_name ?? 'Unknown',
    authorAvatar: row.user_avatar ?? '',
    attachments,
    discordUrl: row.jump_url,
    updatedJumpUrl: row.updated_jump_url,
    tags: row.tags
      ? row.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [],
    categoryId: String(row.channel_id),
    categoryName: row.channel_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    lastActiveAt: row.last_active_at.toISOString(),
    messageCount: row.reply_count,
    reactionCount: row.reaction_count ?? 0,
    authorDiscordRoles: parseDiscordRoles(row.user_discord_roles),
    isRecommended: false,
    isValid: row.is_valid,
  };
};

export const mapPostToSearchDoc = (post: Post): PostSearchDoc => {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    tags: post.tags,
    authorId: post.authorId,
    authorName: post.authorName,
    authorAvatar: post.authorAvatar,
    attachments: Array.isArray(post.attachments) ? post.attachments : [],
    authorDiscordRoles: post.authorDiscordRoles ?? [],
    discordUrl: post.discordUrl,
    updatedJumpUrl: post.updatedJumpUrl ?? null,
    categoryId: post.categoryId,
    categoryName: post.categoryName,
    createdAt: new Date(post.createdAt).getTime(),
    updatedAt: post.updatedAt ? new Date(post.updatedAt).getTime() : new Date(post.createdAt).getTime(),
    lastActiveAt: new Date(post.lastActiveAt).getTime(),
    messageCount: post.messageCount,
    reactionCount: post.reactionCount ?? 0,
    isRecommended: post.isRecommended ?? false,
    isDeleted: false,
    isValid: post.isValid ?? true,
    isFollowedByUser: post.isFollowedByUser ?? false,
  };
};

const parseDate = (value: number | string | null | undefined): Date | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === 'number' ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const mapSearchDocToPost = (doc: PostSearchDoc): Post => {
  const created = parseDate(doc.createdAt) ?? new Date();
  const updated = parseDate(doc.updatedAt ?? null);
  const lastActive = parseDate(doc.lastActiveAt) ?? created;
  const authorDiscordRoles = Array.isArray(doc.authorDiscordRoles) ? doc.authorDiscordRoles.map(String) : [];

  const attachments =
    Array.isArray(doc.attachments) && doc.attachments.length > 0
      ? doc.attachments
          .filter((item) => item.url && typeof item.url === 'string' && item.url.startsWith('http'))
          .map((item) => ({
            url: item.url,
            type: item.type === 'video' ? ('video' as const) : ('image' as const),
          }))
      : [];

  const reactionCount = typeof doc.reactionCount === 'number' ? doc.reactionCount : 0;

  return {
    id: String(doc.id),
    title: doc.title,
    content: doc.content,
    authorId: doc.authorId,
    authorName: doc.authorName,
    authorAvatar: doc.authorAvatar ?? '',
    authorDiscordRoles,
    attachments,
    discordUrl: doc.discordUrl,
    updatedJumpUrl: doc.updatedJumpUrl ?? null,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    categoryId: doc.categoryId,
    categoryName: doc.categoryName,
    createdAt: created.toISOString(),
    updatedAt: updated ? updated.toISOString() : null,
    lastActiveAt: lastActive.toISOString(),
    messageCount: doc.messageCount,
    reactionCount,
    isRecommended: doc.isRecommended === true,
    isFollowedByUser: doc.isFollowedByUser === true,
    isValid: doc.isValid,
  };
};
