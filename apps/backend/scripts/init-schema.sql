-- ===================================================================
-- 网站专用 Schema 初始化脚本
-- 描述: 创建 web_app schema 和网站所需的所有表
-- 适配: PostgreSQL
-- ===================================================================

-- 使用事务确保原子性
BEGIN;

-- 创建网站专用 schema
CREATE SCHEMA IF NOT EXISTS web_app;

-- 设置搜索路径（可选，方便开发）
-- SET search_path TO web_app, public;

-- ===================================================================
-- 1. 用户基础表
-- ===================================================================

-- 表: web_app.users
-- 描述: 网站专用用户数据（username/avatar/discord_roles 从 public schema 读取）
CREATE TABLE IF NOT EXISTS web_app.users (
    discord_id BIGINT PRIMARY KEY,
    orientations TEXT[] DEFAULT '{}', -- 多选性向
    is_admin BOOLEAN DEFAULT FALSE, -- 是否管理员
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    following_feed_viewed_at TIMESTAMPTZ -- 上次查看关注 Feed 的时间
);

CREATE INDEX IF NOT EXISTS idx_users_last_login ON web_app.users (last_login);
CREATE INDEX IF NOT EXISTS idx_users_orientations ON web_app.users USING GIN (orientations);

-- ===================================================================
-- 2. 关注功能表
-- ===================================================================

-- 表: web_app.user_follows
-- 描述: 用户关注作者
CREATE TABLE IF NOT EXISTS web_app.user_follows (
    follower_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, author_id),
    CONSTRAINT fk_follower
        FOREIGN KEY (follower_id)
        REFERENCES web_app.users(discord_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_follows_author_id ON web_app.user_follows (author_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_created_at ON web_app.user_follows (created_at);

-- 表: web_app.user_follow_tags
-- 描述: 用户关注标签
CREATE TABLE IF NOT EXISTS web_app.user_follow_tags (
    user_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, tag_id),
    CONSTRAINT fk_user_follow_tags
        FOREIGN KEY (user_id)
        REFERENCES web_app.users(discord_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_follow_tags_tag_id ON web_app.user_follow_tags (tag_id);

-- 表: web_app.user_subarea_follows
-- 描述: 子区关注记录（Discord 子区的关注者列表 + 被移除记录）
CREATE TABLE IF NOT EXISTS web_app.user_subarea_follows (
    user_id BIGINT NOT NULL,
    subarea_id BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'removed')),
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, subarea_id),
    CONSTRAINT fk_user_subarea_follows
        FOREIGN KEY (user_id)
        REFERENCES web_app.users(discord_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_subarea_follows_status ON web_app.user_subarea_follows (status);

-- ===================================================================
-- 3. 用户设置表
-- ===================================================================

-- 表: web_app.user_settings
-- 描述: 用户个性化设置（blocked_authors 从 public.user_blocked_authors 读取）
CREATE TABLE IF NOT EXISTS web_app.user_settings (
    user_id BIGINT PRIMARY KEY,
    preferred_tags TEXT[] DEFAULT '{}',        -- 偏好标签
    hidden_tags TEXT[] DEFAULT '{}',           -- 隐藏标签
    blocked_posts BIGINT[] DEFAULT '{}',       -- 屏蔽帖子 ID 列表
    preferred_keywords TEXT[] DEFAULT '{}',    -- 偏好关键词
    hidden_keywords TEXT[] DEFAULT '{}',       -- 隐藏关键词
    theme TEXT DEFAULT 'auto',                 -- 主题: auto/light/dark
    custom_css TEXT,                           -- 用户自定义 CSS（审核通过后）
    display_mode TEXT DEFAULT 'large' CHECK (display_mode IN ('list', 'large', 'minimal', 'waterfall')),
    pagination_style TEXT DEFAULT 'scroll' CHECK (pagination_style IN ('scroll', 'pages')),
    image_load_mode TEXT DEFAULT 'all' CHECK (image_load_mode IN ('all', 'images-only', 'none')),
    discord_link_mode TEXT DEFAULT 'app' CHECK (discord_link_mode IN ('app', 'browser')),
    card_title_font_offset INTEGER DEFAULT 0,  -- 卡片标题字体偏移 (-3 ~ +3)
    card_content_font_offset INTEGER DEFAULT 0, -- 卡片内容字体偏移 (-3 ~ +3)
    author_role_color_enabled BOOLEAN DEFAULT TRUE, -- 作者名使用角色颜色
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_settings
        FOREIGN KEY (user_id)
        REFERENCES web_app.users(discord_id)
        ON DELETE CASCADE
);

-- ===================================================================
-- 4. 通知表
-- ===================================================================

-- 表: web_app.user_notifications
-- 描述: 用户通知（关注的作者发新帖）
CREATE TABLE IF NOT EXISTS web_app.user_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type TEXT NOT NULL,                -- 'new_post', 'post_update' 等
    post_id BIGINT NOT NULL,            -- 关联的帖子 ID (posts_main.thread_id)
    author_id BIGINT NOT NULL,          -- 发帖作者 ID
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',        -- 通知元数据（扩展字段）
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_notifications
        FOREIGN KEY (user_id)
        REFERENCES web_app.users(discord_id)
        ON DELETE CASCADE
);

-- 复合索引：支持 WHERE user_id=? AND is_read=? ORDER BY created_at DESC 查询
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON web_app.user_notifications (user_id, is_read, created_at DESC);

-- 部分索引：只索引未读通知（节省空间，加速未读计数）
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread_only ON web_app.user_notifications (user_id, created_at DESC) WHERE is_read = false;

-- ===================================================================
-- 5. 主题管理表
-- ===================================================================

-- 表: web_app.theme_presets
-- 描述: 官方主题列表（管理员管理）
CREATE TABLE IF NOT EXISTS web_app.theme_presets (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    css TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 表: web_app.theme_submissions
-- 描述: 用户自定义 CSS 提交（需审核）
CREATE TABLE IF NOT EXISTS web_app.theme_submissions (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    css TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_id BIGINT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_theme_submissions_user
        FOREIGN KEY (user_id)
        REFERENCES web_app.users(discord_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_theme_submissions_reviewer
        FOREIGN KEY (reviewer_id)
        REFERENCES web_app.users(discord_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_theme_submissions_status ON web_app.theme_submissions (status, created_at);

-- ===================================================================
-- 6. 同步事件队列表
-- ===================================================================

-- 表: web_app.post_sync_events
-- 描述: PostgreSQL → Meilisearch 同步事件队列
CREATE TABLE IF NOT EXISTS web_app.post_sync_events (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,            -- posts_main.thread_id
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    retries SMALLINT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_sync_events_post_id ON web_app.post_sync_events (post_id);
CREATE INDEX IF NOT EXISTS idx_post_sync_events_retries ON web_app.post_sync_events (retries, created_at);

-- ===================================================================
-- T. 触发器函数
-- ===================================================================

-- 函数: web_app.enqueue_post_sync_event()
-- 职责: 当 posts_main 表变化时，插入同步事件并发送 NOTIFY
CREATE OR REPLACE FUNCTION web_app.enqueue_post_sync_event()
RETURNS TRIGGER AS $$
DECLARE
    post_id BIGINT;
BEGIN
    -- 根据操作类型决定使用 NEW 还是 OLD
    IF (TG_OP = 'DELETE') THEN
        post_id := OLD.thread_id;
    ELSE
        post_id := NEW.thread_id;
    END IF;

    -- 插入同步事件
    INSERT INTO web_app.post_sync_events (post_id, action)
    VALUES (post_id, TG_OP);

    -- 发送 NOTIFY（Node.js 会监听此频道）
    PERFORM pg_notify('post_sync_channel', json_build_object(
        'postId', post_id::TEXT,
        'action', TG_OP
    )::TEXT);

    -- DELETE 操作返回 OLD，其他操作返回 NEW
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 触发器: trigger_posts_sync
-- 绑定到 public.posts_main 表（注意跨 schema）
DROP TRIGGER IF EXISTS trigger_posts_sync ON public.posts_main;
CREATE TRIGGER trigger_posts_sync
AFTER INSERT OR UPDATE OR DELETE ON public.posts_main
FOR EACH ROW
EXECUTE FUNCTION web_app.enqueue_post_sync_event();

-- ===================================================================
-- 7. 权限设置（可选，根据实际需求调整）
-- ===================================================================

-- 示例：为网站用户创建专门的数据库角色
-- CREATE ROLE web_app_role LOGIN PASSWORD 'your_password';
-- GRANT USAGE ON SCHEMA web_app TO web_app_role;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA web_app TO web_app_role;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO web_app_role; -- 只读 Bot 的表

-- ===================================================================
-- 完成
-- ===================================================================

-- 插入默认数据（可选）
INSERT INTO web_app.theme_presets (name, description, css, is_active)
VALUES
    ('default', '默认主题', ':root { --primary-color: #5865f2; }', true),
    ('dark', '暗黑主题', ':root { --bg-color: #1e1e1e; --text-color: #fff; }', true)
ON CONFLICT (name) DO NOTHING;

-- 显示创建的表
SELECT
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname = 'web_app'
ORDER BY tablename;

-- 提交事务
COMMIT;
