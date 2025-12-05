# API 接口对接手册

## 1. 基本约定

- 服务监听 `http://localhost:3000`，业务接口统一挂载在 `/api` 前缀下；`/health` 为裸路径。
- 所有接口读写 JSON（`Content-Type: application/json`），前端必须在 `fetch/axios` 中设置 `credentials: 'include'` 以携带 `@fastify/session` 生成的 `sessionId` Cookie。
- 登录状态通过 Discord OAuth：前端引导用户访问 `/api/auth/discord` 获取 302 跳转，成功后服务端在 `/api/auth/discord/callback` 写入会话。
- 错误响应格式固定为：
  ```json
  { "error": { "code": "INVALID_INPUT|NOT_FOUND|UNAUTHORIZED|...", "message": "..." } }
  ```
  枚举值来自 `packages/shared/src/types.ts` 的 `ErrorCode`，400/404 由后端按需返回。
- 通用分页参数：`limit`、`offset`（默认 10），通知列表 `limit` 默认 20。未传或非法时使用默认值，超出范围由后端裁剪。

## 2. 核心数据结构

> `packages/shared/src/types.ts` 是 DTO/枚举的唯一来源，以下片段仅作速查；新增字段必须同步该文件与文档。

```ts
type SessionUser = {
  id: string;
  username: string;
  avatar: string | null;
  email?: string;
  roles: string[];
  discordRoles: string[];
  isAdmin: boolean;
  lastLogin: string;
  orientations: string[]; // 性向偏好（多选）
};

interface Attachment {
  url: string;
  type: 'image' | 'video';
}

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorDiscordRoles: string[]; // 作者 Discord 角色
  attachments: Attachment[]; // 附件列表，封面请取 attachments[0]?.url
  discordUrl: string;
  updatedJumpUrl: string | null; // 最近一次更新的跳转链接
  tags: string[]; // 按热度排序
  categoryId: string;
  categoryName: string;
  createdAt: string;
  updatedAt: string | null; // 无更新为 null
  messageCount: number; // 评论数
  reactionCount: number; // 点赞数
  isFollowedByUser?: boolean; // DC 关注状态
  isRecommended?: boolean; // 被安利标记
}

interface PaginatedPosts {
  posts: Post[];
  total: number;
}

type SearchResponse = PaginatedPosts & { query: string };

type FavoriteRecord = { postId: string; createdAt: string };
type FavoriteResponse = FavoriteRecord & { post: Post };
type FollowRecord = { authorId: string; createdAt: string };
type FollowResponse = FollowRecord & { author: Author };

type NotificationItem = {
  id: string;
  type: NotificationType;
  postId: string;
  authorId: string;
  createdAt: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
};
type NotificationListResult = { items: NotificationItem[]; nextCursor?: string };
type MarkNotificationsReadResponse = { success: boolean; lastReadAt?: string };

type UserSettings = {
  preferredTags: string[];
  hiddenTags: string[];
  blockedAuthors: string[];
  theme: Theme;
  updatedAt: string;
};

// 热词 / 热搜
interface HotWord {
  word: string;
  score: number;
  rank: number;
}

interface HotWordsResponse {
  hotSearchQuery: HotWord[]; // 搜索原句聚合
  hotSearchTokens: HotWord[]; // 搜索分词聚合
  highFrequency: HotWord[]; // 内容热词（当前仅用于兼容，可为空）
  updatedAt: string;
}

type WordMetaType = 'keyword' | 'tag';

interface WordMeta {
  word: string;
  type: WordMetaType;
  score: number;
  rank: number;
}

interface ChannelWordMeta {
  channelId: string;
  items: WordMeta[];
}

interface HotWordsMetaResponse {
  global: WordMeta[]; // 全站标签+热词合并
  channels: ChannelWordMeta[]; // 按频道返回的标签+热词合并
  updatedAt: string;
}
```

## 3. 认证与健康检查

#### `GET /health`

- 认证：不需要
- 请求参数：无
- 响应：`{ "status": "ok" }`
- 说明：可用于探活

#### `GET /api/auth/discord`

- 认证：不需要
- 请求参数：无
- 响应：302 重定向到 Discord OAuth URL
- 说明：前端只需触发跳转

#### `GET /api/auth/discord/callback`

- 认证：不需要
- 请求参数：Discord 回调参数
- 响应：服务端内部调用 Discord API，成功后写 session 并 302 到 `OAUTH_SUCCESS_REDIRECT`
- 说明：错误时 302 到 `OAUTH_FAILURE_REDIRECT`，携带 `?error=...` 参数

#### `GET /api/auth/me`

- 认证：需要
- 请求参数：Cookie Session
- 响应：返回 `SessionUser` 对象
- 说明：session 失效时返回 401（`Unauthorized`）

#### `POST /api/auth/logout`

- 认证：建议携带
- 请求参数：Cookie Session
- 响应：`{ "success": true }`
- 说明：后台会销毁 session，失败返回 500

## 4. 搜索与帖子

#### `GET /api/search`

- 认证：不需要
- 请求参数：Query 参数
  - `q`（关键词）
  - `tags?`（逗号分隔）
  - `category?`
  - `sort?`（智能权重/发布时间/回复时间/点赞数，均支持 asc/desc，取值：`weighted-desc|weighted-asc|created-desc|created-asc|updated-desc|updated-asc|likes-desc|likes-asc`；默认按发布时间降序）
  - `timeRange?`（时间范围：`all|7d|30d|90d|custom`）
  - `timeFrom?` / `timeTo?`（当 `timeRange=custom` 时传递 ISO 字符串，含首日/末日）
  - `limit?`、`offset?`
- 响应：`{ query: string, posts: Post[], total: number }`
- 说明：`q` 为空时返回最新列表。支持标签、分类、排序组合筛选；时间筛选已支持预设范围与自定义区间。

#### `GET /api/search/hot`

- 认证：不需要
- 请求参数：Query 参数 `limit?`（全站返回条数，默认 20）、`perChannelLimit?`（每个频道返回条数，默认 20）
- 响应：`HotWordsMetaResponse`（`{ global: WordMeta[], channels: { channelId, items }[], updatedAt }`），将标签与热词合并后的元数据（全站 + 按频道）
- 说明：频道列表由后端实际统计到的频道决定

#### `GET /api/search/hot/search`

- 认证：不需要
- 请求参数：Query 参数 `limit?`（默认 10）
- 响应：`HotWordsResponse`（`{ hotSearchQuery, hotSearchTokens, highFrequency, updatedAt }`）
- 说明：`hotSearchQuery` 为搜索原句榜，`hotSearchTokens` 为分词榜；`highFrequency` 目前为空

#### `GET /api/me/threads/participated`

- 认证：需要（session），使用登录用户 id，路径不接受其他 id
- 请求参数：Query 参数 `limit?`（默认 10）、`offset?`（默认 0）、`include_invalid?`（可选，`true` 时包含未校验帖子）
- 响应：`{ posts: Post[], total: number }`；按帖子最近活跃时间倒序
- 说明：返回当前用户参与过的线程帖子列表（基于 `post_members`），仅包含未删除的帖子；越权请求返回 401

#### `GET /api/posts`

- 认证：不需要
- 请求参数：Query 参数 `ids=postA,postB` 或重复参数
- 响应：`Post[]`
- 说明：缺少 `ids` 返回 400（`INVALID_INPUT`）

#### `GET /api/posts/latest`

- 认证：不需要
- 请求参数：Query 参数 `limit?`、`offset?`、`sort?`（`weighted|created|updated|likes` + `asc/desc`；默认 `weighted-desc`）
- 响应：`{ posts: Post[], total: number }`
- 说明：按创建时间倒序

#### `GET /api/posts/trending/recommended`

- 认证：不需要
- 请求参数：
  - Query 参数 `limit?`、`offset?`、`sort?`（同上；默认 `weighted-desc`）、`channels?`（逗号分隔的频道 ID；未传则在登录态下使用用户关注的频道）
  - `cursor?`：快照光标，仅在 `sort=weighted-*` 时生效，用于稳定翻页；未传时后端会生成快照返回 `nextCursor`
- 响应：`{ posts: Post[], total: number, nextCursor?: string }`
- 说明：根据用户偏好推荐的热门帖子。`sort=weighted-*` 时使用快照保证跨页顺序稳定，推荐使用 `cursor` 翻页；其他排序仍按 offset。

#### `GET /api/posts/trending/new-hot`

- 认证：不需要
- 请求参数：Query 参数 `limit?`、`offset?`、`sort?`（同上；默认 `weighted-desc`）
- 响应：`{ posts: Post[], total: number }`
- 说明：7 天内新发布且满足热度条件的帖子。

#### `GET /api/posts/trending/hidden-gems`

- 认证：不需要
- 请求参数：Query 参数 `limit?`、`offset?`、`sort?`（同上；默认 `weighted-desc`）
- 响应：`{ posts: Post[], total: number }`
- 说明：小众宝藏（挖坟和被安利加权）。

#### `GET /api/posts/following`

- 认证：需要
- 请求参数：Query 参数 `limit?`、`offset?`、`sort?`（`weighted|created|updated|likes` + `asc/desc`；默认 `weighted-desc`）
- 响应：`{ posts: Post[], total: number }`
- 说明：关注流主列表，合并 DC 参与的帖子（post_members）+ 收藏帖子，去重后按活跃/发布时间排序。

#### `GET /api/posts/following/all`

- 认证：需要
- 请求参数：Query 参数 `limit?`、`offset?`、`sort?`（同上）
- 响应：`{ posts: Post[], total: number }`
- 说明：所有关注来源的帖子（作者+标签+Discord 关注）。[待实现]

#### `GET /api/posts/following/authors`

- 认证：需要
- 请求参数：Query 参数 `limit?`、`offset?`、`sort?`（同上）
- 响应：`{ posts: Post[], total: number }`
- 说明：关注作者的帖子（从 follows 表读取）。[待实现]

#### `GET /api/posts/following/discord`

- 认证：需要
- 请求参数：Query 参数 `limit?`、`offset?`、`sort?`（同上）
- 响应：`{ posts: Post[], total: number }`
- 说明：历史关注的帖子（从 postmember 表读取用户的 Discord 关注状态）。[待实现]

#### `GET /api/posts/following/recent-updates`

- 认证：需要
- 请求参数：Query 参数 `limit?`、`offset?`、`sort?`（同上）
- 响应：`{ posts: Post[], total: number }`
- 说明：关注的帖子中有近期更新的（按 updatedAt 排序）。[待实现]

#### `GET /api/posts/following/tags`

- 认证：需要
- 请求参数：Query 参数 `limit?`、`offset?`、`sort?`（同上）
- 响应：`{ posts: Post[], total: number }`
- 说明：关注标签的帖子。[待实现]

#### `GET /api/posts/custom`

- 认证：不需要
- 请求参数：Query 参数同 `/api/search`，支持 `timeRange?`、`timeFrom?`、`timeTo?`
- 响应：`{ posts: Post[], total: number }`
- 说明：自定义订阅流。前期可复用 `/api/search` 逻辑；排序参数复用 `weighted|created|updated|likes` + `asc/desc`，需后端提供智能加权字段

#### `GET /api/posts/author/:authorId`

- 认证：不需要
- 请求参数：Path 参数 `authorId`（作者 ID）；Query 参数 `limit?`、`offset?`
- 响应：`{ posts: Post[], total: number }`
- 说明：指定作者的帖子列表

#### `GET /api/posts/channel/:channelId`

- 认证：不需要
- 请求参数：Path 参数 `channelId`（频道 ID）；Query 参数 `limit?`、`offset?`
- 响应：`{ posts: Post[], total: number }`
- 说明：频道下帖子分页

#### `GET /api/posts/tag/:tagName`

- 认证：不需要
- 请求参数：Path 参数 `tagName`（标签名）；Query 参数 `limit?`、`offset?`
- 响应：`{ posts: Post[], total: number }`
- 说明：`tagName` 按原始大小写匹配

## 5. 收藏 / 关注 / 通知（需会话）

#### `GET /api/favorites`

- 认证：需要
- 请求参数：无
- 响应：`FavoriteResponse[]`
- 说明：后端会联表返回完整 `post`，避免二次查询

#### `POST /api/favorites`

- 认证：需要
- 请求参数：Body `{ postId: string }`
- 响应：`{ success: true }`
- 说明：不存在的帖子返回 400 + `POST_NOT_FOUND` 信息

#### `DELETE /api/favorites/:postId`

- 认证：需要
- 请求参数：Path 参数 `postId`（帖子 ID）
- 响应：`{ success: true }`
- 说明：未收藏返回 400

#### `GET /api/follows`

- 认证：需要
- 请求参数：无
- 响应：`FollowResponse[]`
- 说明：每条附带 `author` 信息

#### `POST /api/follows`

- 认证：需要
- 请求参数：Body `{ authorId: string }`
- 响应：`{ success: true }`
- 说明：作者不存在时 400

#### `DELETE /api/follows/:authorId`

- 认证：需要
- 请求参数：Path 参数 `authorId`（作者 ID）
- 响应：`{ success: true }`
- 说明：不存在的关注返回 400

#### `GET /api/follows/tags`

- 认证：需要
- 请求参数：无
- 响应：`TagFollowResponse[]`
- 说明：每条附带 `tag` 信息。[待实现]

#### `POST /api/follows/tags`

- 认证：需要
- 请求参数：Body `{ tagId: string }`
- 响应：`{ success: true }`
- 说明：标签不存在时 400。[待实现]

#### `DELETE /api/follows/tags/:tagId`

- 认证：需要
- 请求参数：Path 参数 `tagId`（标签 ID）
- 响应：`{ success: true }`
- 说明：不存在的关注返回 400。[待实现]

#### `GET /api/notifications`

- 认证：需要
- 请求参数：Query 参数 `limit?`（默认 20）、`cursor?`
- 响应：`NotificationListResult`
- 说明：`cursor` 对应上一页最后一条 `id`

#### `GET /api/notifications/unread`

- 认证：需要
- 请求参数：无
- 响应：`{ count: number }`

#### `POST /api/notifications/read`

- 认证：需要
- 请求参数：Body `{ cursor?: string }`
- 响应：`MarkNotificationsReadResponse`
- 说明：当有更新时返回 `lastReadAt`。省略 `cursor` 会将所有未读标记为已读

## 6. 用户偏好与公开资料

#### `GET /api/user/settings`

- 认证：需要
- 请求参数：无
- 响应：`UserSettings`
- 说明：若不存在，会动态创建默认设置（`preferredTags/hiddenTags/blockedAuthors` 为空数组，`theme` 为 `Theme.Auto`）

#### `PUT /api/user/settings`

- 认证：需要
- 请求参数：Body `Partial<UserSettings>`
- 响应：返回合并后的 `UserSettings`
- 说明：数组字段若未提供将沿用旧值

#### `POST /api/onboarding/preferences`

- 认证：需要
- 请求参数：Body `OnboardingPreferences`
- 响应：`{ success: true }`
- 说明：批量设置性向、关注频道、关注标签。设置后 `SessionUser.orientations` 更新，用户完成 onboarding。[待实现]

#### `GET /api/users/:id`

- 认证：不需要
- 请求参数：Path 参数 `id`（用户 ID）
- 响应：`UserProfile`（字段同 `Author`）
- 说明：找不到返回 404（`NOT_FOUND`）

#### `GET /api/users/:id/profile`

- 认证：需要（authMiddleware）
- 请求参数：Path 参数 `id`（用户 ID）
- 响应：`UserProfileExtended`（附带 `totalLikes/totalComments/channelStats/featuredPostId`）
- 说明：找不到返回 404（`NOT_FOUND`），`featuredPostId` 为用户在设置中选定的代表作 ID，未设置时为 `null`

#### `GET /api/users/:id/posts`

- 认证：不需要
- 请求参数：Path 参数 `id`（用户 ID）；Query 参数 `limit?`、`offset?`、`channelId?`、`sort?`（`updated-desc/updated-asc/created-desc/created-asc/likes-desc/likes-asc`）
- 响应：`{ posts: Post[], total: number }`
- 说明：内部调用 `listByAuthor`，默认按更新时间倒序；若用户不存在返回 404

## 7. 元数据接口

#### `GET /api/channels`

- 认证：不需要
- 请求参数：无
- 响应：`Channel[]`
- 说明：所有频道列表（用于 Onboarding 和筛选）

#### `GET /api/channels/:id/tags`

- 认证：不需要
- 请求参数：Path 参数 `id`（频道 ID）
- 响应：`Tag[]`
- 说明：指定频道下的标签列表（按使用次数排序）

#### `GET /api/tags/recommended`

- 认证：不需要
- 请求参数：Query 参数 `channelIds`（逗号分隔）
- 响应：`Tag[]`
- 说明：推荐标签列表（基于选择的频道）。[待实现]

---

## 8. 对接注意事项

### 基本规则

- 任何需要登录态的接口均由 `authMiddleware` 保护，若会话失效立即返回 401。前端遇到该状态需清理本地用户数据并重定向登录。
- 收藏、关注、通知等写操作为幂等：后端会忽略重复收藏/关注；删除不存在资源时返回 400 便于前端提示。
- `cursor`、`limit`、`offset` 均按数字解析，传入字符串需确保是整数；否则后端自动回退默认值，不会报错。
- 当新增字段或调整结构时，务必同步更新本文档和 `packages/shared` 中的 DTO，以免前后端类型漂移。

### 类型同步

- 所有新增字段必须同步更新 `packages/shared/src/types.ts` 和本文档
- `Post` 类型新增字段：`attachments`, `reactionCount`, `authorDiscordRoles`, `isFollowedByUser`, `isRecommended`, `updatedAt`
- `SessionUser.orientation` 改为 `orientations: string[]`（多选）
- `Author` 新增字段：`discordRoles`

### 数据源说明

- **Discord 关注状态**：从 `postmember` 表读取 `is_following` 字段，填充 `Post.isFollowedByUser`
- **被安利标记**：需要新增 `recommendations` 表或在 `posts` 表添加 `is_recommended` 字段
- **作者徽章**：返回 `Author.discordRoles` 和 `Post.authorDiscordRoles`，前端根据角色渲染徽章和颜色
- **标签排序**：Post 返回的 `tags` 数组应按热度（`usageCount`）降序排列
- **附件提取**：`Post.attachments` 包含 Discord CDN 图片/视频链接，前端会额外从 `content` 字段提取 CDN 链接

### 筛选策略

- **前端本地筛选**：`stores/filters.ts` 管理 localStorage 的标签/关键词黑白名单
- **后端关注功能**：`/api/follows` 和 `/api/follows/tags` 管理服务端关注关系
- **整合方案**：前端本地筛选仅影响展示，后端关注影响推荐算法和 Following 流

---

#### `GET /api/channels`

- **用途**：获取所有分类（频道）列表，用于 Onboarding 和自定义订阅页面
- **认证**：不需要
- **参数**：无
- **响应**：`Channel[]` 类型数组
- **建议实现**：
  ```sql
  SELECT channel_id, channel_name, guild_id, guild_name, post_count
  FROM channels
  ORDER BY guild_name, channel_name;
  ```

#### `GET /api/channels/:channelId/tags`

- **用途**：获取指定频道下的所有标签列表
- **认证**：不需要
- **参数**：Path: `channelId` (频道 ID)
- **响应**：`Tag[]` 类型数组
- **建议实现**：
  ```sql
  SELECT tag_id, tag_name, channel_id, usage_count
  FROM tags
  WHERE channel_id = $1
  ORDER BY usage_count DESC, tag_name;
  ```

#### `GET /api/tags/recommended`

- **用途**：根据用户选择的频道推荐热门标签（用于 Onboarding 第三步）
- **认证**：可选（登录用户可基于历史偏好推荐）
- **参数**：Query: `channelIds` (逗号分隔的频道 ID 列表)
- **响应**：`Tag[]` 类型数组
- **建议实现**：返回这些频道下 `usage_count` 最高的标签（Top 20）

---

## 9. 新增接口汇总（2025-11-20 更新）

以下接口为新需求增加，需优先实现：

### P0 - Onboarding 流程

#### `POST /api/onboarding/preferences`

- **用途**：一次性完成 Onboarding（性向、分区关注、标签关注）
- **认证**：需要登录态
- **请求体**：
  ```typescript
  {
    orientations: string[]; // ['male', 'female', 'non-binary', ...]
    channelIds: string[];   // 要关注的频道 ID
    tagIds: string[];       // 要关注的标签 ID
  }
  ```
- **响应**：`{ success: true }`
- **副作用**：
  1. 更新 `users` 表的 `orientations` 字段
  2. 批量插入 `follows` 表（如需关注频道内作者）
  3. 批量插入 `tag_follows` 表
  4. 同步更新 session 中的 `SessionUser.orientations`

### P0 - Trending 子分类

#### `GET /api/posts/trending/recommended`

- **算法**：基于用户 `orientations` 和关注的频道/标签，加权推荐热门帖子
- **参数**：`limit?`, `offset?`, `channels?`（逗号分隔；未传则使用登录用户关注的频道）
- **响应**：`PaginatedPosts`

#### `GET /api/posts/trending/new-hot`

- **算法**：7 天内新发布 + `reactionCount > 阈值` 或 `messageCount > 阈值`
- **参数**：`limit?`, `offset?`
- **响应**：`PaginatedPosts`

#### `GET /api/posts/trending/hidden-gems`

- **算法**：发布时间较早但近期活跃度提升 + `isRecommended=true` 加权
- **参数**：`limit?`, `offset?`
- **响应**：`PaginatedPosts`

### P0 - Following 子分类

#### `GET /api/posts/following/all`

- **数据源**：合并以下所有来源
- **前端诉求**：主页“关注帖子”需额外包含收藏帖子，按活跃度/收藏加权展示。[TODO 后端聚合收藏]
- **参数**：`limit?`, `offset?`
- **响应**：`PaginatedPosts`

#### `GET /api/posts/following/authors`

- **数据源**：`follows` 表中用户关注的作者 ID
- **参数**：`limit?`, `offset?`
- **响应**：`PaginatedPosts`

#### `GET /api/posts/following/discord`

- **数据源**：`postmember` 表中 `user_id = 当前用户` 且 `is_following = true` 的帖子
- **参数**：`limit?`, `offset?`
- **响应**：`PaginatedPosts`（Post 字段 `isFollowedByUser=true`）

#### `GET /api/posts/following/recent-updates`

- **数据源**：所有关注来源的帖子，`updatedAt IS NOT NULL` 且 `updatedAt > createdAt`
- **排序**：按 `updatedAt DESC`
- **参数**：`limit?`, `offset?`
- **响应**：`PaginatedPosts`

#### `GET /api/posts/following/tags`

- **数据源**：`tag_follows` 表中用户关注的标签
- **参数**：`limit?`, `offset?`
- **响应**：`PaginatedPosts`

### P1 - 标签关注

#### `GET /api/follows/tags`

- **用途**：获取当前用户关注的所有标签
- **响应**：`TagFollowResponse[]`

#### `POST /api/follows/tags`

- **用途**：关注标签
- **请求体**：`{ tagId: string }`
- **响应**：`{ success: true }`

#### `DELETE /api/follows/tags/:tagId`

- **用途**：取消关注标签
- **响应**：`{ success: true }`

---

**文档更新日期**：2025-11-20
**更新内容**：

- 新增 Onboarding 批量接口
- 新增 Trending/Following 子分类接口（8 个）
- 新增标签关注接口（3 个）
- 更新 Post/SessionUser/Author 类型定义（添加新字段）
