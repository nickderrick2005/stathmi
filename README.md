# OPZ Hub

Discord 社区内容聚合浏览平台，专注于提升内容发现与阅读体验。

## 技术栈

| 层级      | 技术选型                             |
| --------- | ------------------------------------ |
| 前端      | Vue 3 + Vite + TypeScript + Naive UI |
| 后端      | Fastify + Kysely + TypeScript        |
| 数据库    | PostgreSQL                           |
| 搜索引擎  | Meilisearch                          |
| 缓存/会话 | Redis                                |
| 认证      | Discord OAuth 2.0                    |

## 项目架构

Monorepo：

```
opz-hub/
├── apps/
│   ├── frontend/          # Vue 3 SPA
│   └── backend/           # Fastify API 服务
├── packages/
│   └── shared/            # 前后端共享类型定义
└── docs/                  # API 契约文档
```

### 前端架构

```
src/
├── api/           # HTTP 请求层（ofetch 封装）
├── composables/   # 逻辑复用层（vue 组合式函数）
├── stores/        # Pinia 状态管理
├── views/         # 页面组件
├── components/    # UI 组件库
├── router/        # 路由配置与守卫
└── utils/         # 工具函数
```

**状态管理分层**：

- 用户层：登录状态、偏好设置、主题
- 内容层：关注列表、收藏、筛选条件
- 元数据层：频道、标签、角色信息
- UI 层：抽屉、模态窗状态

### 后端架构

```
src/
├── routes/        # API 路由（15+ 模块）
├── services/      # 业务逻辑层
├── repositories/  # 数据访问层
├── sync/          # Meilisearch 同步引擎
├── snapshot/      # 游标分页与快照缓存
└── cron/          # 定时任务
```

**数据库 Schema**：

- `public`：采集入口的只读表（posts_main, channels, tags 等）
- `web_app`：网站维护的读写表（users, favorites, follows 等）

## 核心功能

### 智能搜索

基于 Meilisearch 构建，支持：

- 全文检索（标题、内容、标签、作者名）
- 中文分词（CMN 语言配置 + nodejieba）
- 多维度筛选（标签 AND/OR、时间范围、分类）
- 四种排序方式：智能加权、最新、最近更新、最多点赞

**智能排序算法**（weighted）：

```
score = (engagement + 2) * decay * boost
engagement = sqrt(reactions) * 6 + sqrt(messages) * 4
decay = max(0.5^(age_hours/336), 0.1)  // 14天半衰期
boost = isRecommended ? 1.5 : 1.0
```

### 个性化系统

- **性向偏好**：首次使用引导设置
- **多层级关注**：作者、标签、频道
- **多层级屏蔽**：作者、标签、关键词
- **自定义样式**：支持用户 CSS 注入

### 内容浏览

- **多视图模式**：卡片、列表、极简表格
- **多分页方式**：无限滚动、页码翻页
- **Feed 分类**：
  - Trending：推荐热门、7天新热、小众宝藏
  - Following：关注作者、关注标签、参与讨论

### 缓存与性能

- **快照机制**：热门排序结果缓存（TTL 5分钟），支持游标分页
- **Feed 缓存**：前端 5 分钟 TTL，避免重复请求
- **虚拟滚动**：大列表使用 @tanstack/vue-virtual
- **滚动位置记忆**：SessionStorage 按页面保存

## 实现亮点

### 类型安全

前后端共享 `packages/shared/src/types.ts` 作为唯一 DTO 来源，包含 40+ 类型定义，确保 API 契约一致性。

### 两阶段搜索排序

1. Meilisearch 粗排：相关度或互动度排序
2. 应用层精排：智能加权算法二次排序（仅 weighted 排序启用）

### 容错机制

- 文档缺失自动从 PostgreSQL 修复索引，字段缺失自动重载，软删除状态自动同步。

### 乐观更新

收藏、关注操作采用乐观更新策略：先更新 UI，再发送请求，失败时回滚。

### 前端性能

Feed页面图片懒加载，多DOM虚拟滚动，超上限自动卸载，后台预加载项目文件。

## API 设计

RESTful，统一前缀 `/api`：

| 模块          | 端点数 | 说明                          |
| ------------- | ------ | ----------------------------- |
| Auth          | 4      | Discord OAuth 登录流程        |
| Posts         | 12     | 帖子列表、Trending、Following |
| Search        | 3      | 全文搜索、热词                |
| Favorites     | 3      | 收藏管理                      |
| Follows       | 6      | 作者/标签关注                 |
| Notifications | 3      | 消息通知                      |
| Users         | 5      | 用户资料、设置                |

认证采用 Cookie Session，TTL 7 天，Redis 后端存储。

## 意见反馈

- 反馈帖子：https://discord.com/channels/1291925535324110879/1439568224520896522
- 意见信箱：https://discord.com/channels/1291925535324110879/1337463244062720100/1438379980391448577
