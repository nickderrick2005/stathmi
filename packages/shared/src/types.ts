// 前后端共享的 API 错误码
export enum ErrorCode {
  Unauthorized = 'UNAUTHORIZED',
  Forbidden = 'FORBIDDEN',
  NotFound = 'NOT_FOUND',
  InvalidInput = 'INVALID_INPUT',
  RateLimited = 'RATE_LIMITED',
  InternalError = 'INTERNAL_ERROR',
}

// 用户设置中保存的视觉主题偏好
export enum Theme {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
}

// 后端触发的通知事件类型
export enum NotificationType {
  NewPost = 'new_post',
}

// `/api/auth/me` 接口返回的会话用户信息
export interface SessionUser {
  id: string;
  username: string;
  nickname?: string; // Discord 服务器昵称
  globalName?: string; // Discord 全局显示名
  avatar: string | null;
  roles: string[];
  isAdmin: boolean;
  lastLogin: string;
  discordRoles: string[];
  orientations: string[]; // 性向偏好（多选）
}

// 通过 `/api/users/:id` 公开的作者个人资料
export interface Author {
  id: string;
  username: string;
  nickname?: string; // Discord 服务器昵称
  globalName?: string; // Discord 全局显示名
  avatar: string;
  discordRoles: string[]; // Discord 角色列表，用于渲染徽章
  joinedAt: string;
  followers: number;
  following: number;
}

export type UserProfile = Author;
export type UserPublicProfile = Author;

// 用户分区作品统计
export interface ChannelStats {
  channelId: string;
  channelName: string;
  postCount: number;
}

// 扩展用户资料（包含聚合统计和推荐作品）
export interface UserProfileExtended extends Author {
  totalLikes: number; // 作品总赞数
  totalComments: number; // 作品总评论数
  featuredPostId?: string | null; // 用户设置的推荐作品 ID
  channelStats: ChannelStats[]; // 各分区作品数量
}

// 用户主页帖子列表排序
export type UserProfileSort =
  | 'updated-desc'
  | 'updated-asc'
  | 'created-desc'
  | 'created-asc'
  | 'likes-desc'
  | 'likes-asc';

// 附件信息
export interface Attachment {
  url: string;
  type: 'image' | 'video';
}

// 从 PostgreSQL/Meilisearch 获取的论坛帖子数据
export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorDiscordRoles: string[]; // 作者的 Discord 角色，用于渲染徽章
  attachments: Attachment[]; // 附件列表（图片/视频）
  discordUrl: string;
  updatedJumpUrl: string | null; // 最近一次更新的跳转链接
  tags: string[]; // 标签列表（按热度排序）
  categoryId: string;
  categoryName: string;
  createdAt: string;
  updatedAt: string | null; // 更新时间，无更新为 null
  lastActiveAt: string; // 最后活动时间（最后回复时间）
  messageCount: number; // 评论数
  reactionCount: number; // 点赞数
  isFollowedByUser?: boolean; // 当前用户是否曾在 Discord 关注该帖（从 postmember 表读取）
  isRecommended?: boolean; // 是否被安利
  isValid?: boolean;
}

// 通用的分页帖子列表
export interface PaginatedPosts {
  posts: Post[];
  total: number;
  nextCursor?: string;
}

// 批量元数据查询
export interface LookupRequest {
  postIds?: string[];
  userIds?: string[];
  includeInvalid?: boolean;
}

export interface LookupResponse {
  posts: Record<string, Post>;
  users: Record<string, UserProfile>;
}

export type SearchSortParam =
  | 'weighted-desc'
  | 'weighted-asc'
  | 'created-desc'
  | 'created-asc'
  | 'updated-desc'
  | 'updated-asc'
  | 'likes-desc'
  | 'likes-asc';

export type TimeRangePreset = 'all' | '7d' | '30d' | '90d' | 'custom';

// `/api/search` 接口接受的查询字符串参数
export interface SearchQueryParams {
  q?: string;
  tags?: string[];
  tagRelation?: 'AND' | 'OR'; // 标签匹配逻辑
  category?: string;
  sort?: SearchSortParam;
  timeRange?: TimeRangePreset; // 预设时间范围：all/7d/30d/90d/custom
  timeFrom?: string; // 自定义范围起始（ISO 字符串，含首日）
  timeTo?: string; // 自定义范围结束（ISO 字符串，含末日）
  limit?: number;
  offset?: number;
  includeInvalid?: boolean; // 是否包含锁定和无数据作品
}

// `/api/search` 接口返回的响应数据
export interface SearchResponse extends PaginatedPosts {
  query: string;
}

// 按用户/帖子对存储的原始收藏记录
export interface FavoriteRecord {
  postId: string;
  createdAt: string;
}

// `/api/favorites` 接口返回的收藏响应数据
export interface FavoriteResponse extends FavoriteRecord {
  post: Post;
}

// 按用户/作者对存储的原始关注记录
export interface FollowRecord {
  authorId: string;
  createdAt: string;
}

// `/api/follows` 接口返回的关注响应数据
export interface FollowResponse extends FollowRecord {
  author: Author;
}

// 为每个用户持久化的通知记录行
export interface NotificationItem {
  id: string;
  type: NotificationType;
  postId: string;
  authorId: string;
  createdAt: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
}

export interface NotificationListResult {
  items: NotificationItem[];
  nextCursor?: string;
}

export interface NotificationUnreadCount {
  count: number;
}

export interface MarkNotificationsReadResponse {
  success: boolean;
  lastReadAt?: string;
}

// Discord 链接打开方式
export type DiscordLinkMode = 'app' | 'browser';

// 展示模式：卡片(large)、列表(list)、极简(minimal)
export type DisplayMode = 'large' | 'list' | 'minimal';

// 分页模式：滚动式(scroll)、页码式(pages)
export type PaginationStyle = 'scroll' | 'pages';

// 图片加载模式：全部(all)、仅图片(images-only)、不加载(none)
export type ImageLoadMode = 'all' | 'images-only' | 'none';

// 用户可配置的筛选器和 UI 偏好设置
export interface UserSettings {
  preferredTags: string[];
  hiddenTags: string[];
  blockedAuthors: string[];
  blockedPosts: string[]; // 屏蔽的帖子 ID 列表
  preferredKeywords: string[];
  hiddenKeywords: string[];
  theme: Theme;
  customCss?: string;
  displayMode?: DisplayMode; // 展示模式（默认值，子页面可独立配置）
  paginationStyle?: PaginationStyle; // 分页模式（默认值，搜索页始终为页码式）
  imageLoadMode?: ImageLoadMode; // 图片加载模式
  discordLinkMode?: DiscordLinkMode; // Discord 链接打开方式（undefined 表示用户未选择过）
  cardTitleFontOffset?: number; // 卡片标题字体偏移 (-3 ~ +3)
  cardContentFontOffset?: number; // 卡片内容字体偏移 (-3 ~ +3)
  authorRoleColorEnabled?: boolean; // 作者名使用角色颜色（默认 true）
  featuredPostId?: string | null; // 用户主页推荐作品 ID
  updatedAt: string;
}

// Onboarding 批量设置 Payload
export interface OnboardingPreferences {
  orientations: string[]; // 性向偏好（多选）
  channelIds: string[]; // 关注的频道 ID 列表
  tagIds: string[]; // 关注的标签 ID 列表
  blockedTagNames?: string[]; // 屏蔽的标签名列表
}

export interface SuccessResponse {
  success: true;
}

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

// 频道/分类信息
export interface Channel {
  id: string;
  name: string;
  guildId: string;
  guildName: string;
  postCount: number;
}

// 标签信息
export interface Tag {
  id: string;
  name: string;
  channelId: string;
  usageCount: number;
}

// Discord 角色元数据
export interface Role {
  id: string;
  name: string;
  iconUrl: string | null; // Discord CDN 完整 URL
  emoji: string | null;
  primaryColor: string | null; // hex 格式，如 "#CC9E71"
  secondaryColor: string | null;
  tertiaryColor: string | null;
  position: number; // 角色优先级，值越大优先级越高
}

// 标签关注记录
export interface TagFollowRecord {
  tagId: string;
  createdAt: string;
}

// 标签关注响应
export interface TagFollowResponse extends TagFollowRecord {
  tag: Tag;
}

// 频道关注记录
export interface ChannelFollowRecord {
  channelId: string;
  createdAt: string;
}

// 频道关注响应
export interface ChannelFollowResponse extends ChannelFollowRecord {
  channel: Channel;
}

// 热词 / 热搜
export interface HotWord {
  word: string;
  score: number;
  rank: number;
}

export interface HotWordsResponse {
  hotSearchQuery: HotWord[]; // 用户原句聚合
  hotSearchTokens: HotWord[]; // 用户分词聚合
  highFrequency: HotWord[]; // 帖子内容高频词
  updatedAt: string;
}

// 热词 / 标签元数据（可选新接口）
export type WordMetaType = 'keyword' | 'tag';

export interface WordMeta {
  word: string;
  type: WordMetaType;
  score: number;
  rank: number;
}

export interface ChannelWordMeta {
  channelId: string;
  items: WordMeta[];
}

export interface HotWordsMetaResponse {
  global: WordMeta[];
  channels: ChannelWordMeta[];
  updatedAt: string;
}

// 批量帖子标题查询
export interface PostTitlesRequest {
  ids: string[];
}

export interface PostTitle {
  id: string;
  title: string;
}

export interface PostTitlesResponse {
  titles: PostTitle[];
}

// 批量用户名称查询（带角色）
export interface UserNamesRequest {
  ids: string[];
}

export interface UserNameRole {
  roleId: string;
  roleName: string;
  roleIconUrl?: string; // Discord CDN 完整 URL
  roleEmoji?: string;
  color?: string; // hex格式，如 "#CC9E71"
}

export interface UserName {
  id: string;
  nickname?: string;
  globalName?: string;
  username: string;
  displayName: string; // nickname ?? globalName ?? username
  avatar: string | null;
  roles: UserNameRole[];
}

export interface UserNamesResponse {
  users: UserName[];
}

// 作者自动补全项
export interface AuthorAutocompleteItem {
  id: string;
  username: string;
  nickname?: string;
  globalName?: string;
  displayName: string; // nickname ?? globalName ?? username
  avatar: string;
  threadCount: number; // 作品数量
  discordRoles: string[]; // 用于渲染角色颜色
}

// 作者自动补全响应
export interface AuthorAutocompleteResponse {
  authors: AuthorAutocompleteItem[];
}
