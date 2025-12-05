/**
 * Post-related helper functions
 * 帖子相关的辅助工具函数
 */

import type { Post, Attachment } from '@opz-hub/shared';

/**
 * 构建帖子的搜索文本（标题 + 内容）
 */
export function buildSearchText(post: Post): string {
  return `${post.title ?? ''} ${post.content ?? ''}`.toLowerCase();
}

/**
 * 验证 attachment URL 是否有效
 * 过滤掉 undefined/null/非 http 开头的无效 URL
 */
export function isValidAttachmentUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith('http');
}

/**
 * 获取帖子的有效图片列表（去重 + URL 验证）
 */
export function getValidImages(post: Post): Attachment[] {
  const seen = new Set<string>();
  return (post.attachments ?? []).filter((a) => {
    if (a.type !== 'image' || !isValidAttachmentUrl(a.url) || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}
