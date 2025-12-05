<script setup lang="ts">
import { ref, watch, onMounted, computed, type Ref } from 'vue';
import { NSlider, NModal, NButton, NUpload, NInput, NSpin } from 'naive-ui';
import type { UploadCustomRequestOptions } from 'naive-ui';
import type { DisplayMode, PaginationStyle, ImageLoadMode } from '@/stores/preferences';
import { usePreferencesStore } from '@/stores/preferences';
import { useUserStore } from '@/stores/user';
import { useBlocksStore } from '@/stores/blocks';
import { clearUserData } from '@/api/users';
import { logout } from '@/api/auth';
import { fetchPostsByIds } from '@/api/posts';
import { notifySuccess, notifyError } from '@/utils/notifications';
import { useCustomCss } from '@/composables/useCustomCss';
import { useSettingUpdate } from '@/composables/useSettingUpdate';
import ViewShell from '@/components/layout/ViewShell.vue';
import { SettingCard, SettingItem, RadioGroup, DisplayModeSelector } from '@/components/settings';
import type { RadioOption } from '@/components/settings';

const userStore = useUserStore();
const preferencesStore = usePreferencesStore();
const blocksStore = useBlocksStore();
const { hasCustomCss } = useCustomCss();
const { isSaving, update } = useSettingUpdate();

// 本地状态
const displayMode = ref<DisplayMode>('large');
const paginationStyle = ref<PaginationStyle>('scroll');
const imageLoadMode = ref<ImageLoadMode>('all');
const discordLinkMode = ref<'app' | 'browser' | undefined>(undefined);
const cardTitleFontOffset = ref(0);
const cardContentFontOffset = ref(0);
const authorRoleColorEnabled = ref(true);

// 弹窗状态
const showClearDataModal = ref(false);
const isClearing = ref(false);
const showCssEditor = ref(false);
const cssEditorContent = ref('');

// 已屏蔽帖子状态
interface BlockedPostItem {
  id: string;
  title?: string;
  authorName?: string;
  deleted?: boolean;
}
const showBlockedPosts = ref(false);
const blockedPostsData = ref<BlockedPostItem[]>([]);
const isLoadingBlockedPosts = ref(false);
const unblockingPostIds = ref<Set<string>>(new Set());
const blockedPostsCount = computed(() => blocksStore.blockedPosts.length);

// 选项配置
const authorColorOptions: RadioOption<boolean>[] = [
  { value: true, label: '角色颜色' },
  { value: false, label: '统一颜色' },
];

const paginationOptions: RadioOption<PaginationStyle>[] = [
  { value: 'scroll', label: '滚动式' },
  { value: 'pages', label: '页码式' },
];

const imageLoadOptions: RadioOption<ImageLoadMode>[] = [
  { value: 'all', label: '加载全部', desc: '加载图片和 GIF 动图' },
  { value: 'images-only', label: '仅图片', desc: '加载静态图片，不加载GIF' },
  { value: 'none', label: '不加载', desc: '不加载任何图片，节省流量' },
];

const discordLinkOptions: RadioOption<'app' | 'browser'>[] = [
  { value: 'app', label: '打开Discord' },
  { value: 'browser', label: '浏览器' },
];

// 加载用户设置
onMounted(async () => {
  if (userStore.isAuthenticated) {
    await userStore.loadSettings();
    preferencesStore.loadFromUserSettings(userStore.settings);
    syncFromStore();
  }
});

function syncFromStore() {
  displayMode.value = preferencesStore.displayMode;
  paginationStyle.value = preferencesStore.paginationStyle;
  imageLoadMode.value = preferencesStore.imageLoadMode;
  discordLinkMode.value = preferencesStore.discordLinkMode;
  cardTitleFontOffset.value = preferencesStore.cardTitleFontOffset;
  cardContentFontOffset.value = preferencesStore.cardContentFontOffset;
  authorRoleColorEnabled.value = preferencesStore.authorRoleColorEnabled;
}

watch(
  () => preferencesStore.isLoaded,
  (loaded) => {
    if (loaded) syncFromStore();
  }
);

// 通用设置更新
function createUpdater<T>(localRef: Ref<T>, storeFn: (v: T) => Promise<void>) {
  return async (value: T) => {
    localRef.value = value;
    await update(() => storeFn(value));
  };
}

const updateDisplayMode = createUpdater(displayMode, preferencesStore.updateDisplayMode);
const updateAuthorRoleColor = createUpdater(authorRoleColorEnabled, preferencesStore.updateAuthorRoleColorEnabled);
const updatePagination = createUpdater(paginationStyle, preferencesStore.updatePaginationStyle);
const updateImageLoad = createUpdater(imageLoadMode, preferencesStore.updateImageLoadMode);
const updateDiscordLink = async (mode: 'app' | 'browser') => {
  discordLinkMode.value = mode;
  await update(() => preferencesStore.updateDiscordLinkMode(mode));
};
const updateTitleFont = createUpdater(cardTitleFontOffset, preferencesStore.updateCardTitleFontOffset);
const updateContentFont = createUpdater(cardContentFontOffset, preferencesStore.updateCardContentFontOffset);

// 字体偏移
function formatOffset(val: number): string {
  if (val > 0) return `+${val}px`;
  if (val < 0) return `${val}px`;
  return '默认';
}

// 已屏蔽帖子
async function toggleBlockedPosts() {
  showBlockedPosts.value = !showBlockedPosts.value;
  if (showBlockedPosts.value && blocksStore.blockedPosts.length > 0) {
    await loadBlockedPostsData();
  }
}

async function loadBlockedPostsData() {
  const blockedIds = blocksStore.blockedPosts;
  if (blockedIds.length === 0) {
    blockedPostsData.value = [];
    return;
  }
  isLoadingBlockedPosts.value = true;
  try {
    const posts = await fetchPostsByIds(blockedIds);
    const postMap = new Map(posts.map((p) => [p.id, p]));
    // 合并：有详情的显示详情，没有的标记为已删除
    blockedPostsData.value = blockedIds.map((id) => {
      const post = postMap.get(id);
      return post ? { id: post.id, title: post.title, authorName: post.authorName } : { id, deleted: true };
    });
  } catch {
    // 请求失败时，仍显示所有屏蔽的帖子 ID
    blockedPostsData.value = blockedIds.map((id) => ({ id, deleted: true }));
  } finally {
    isLoadingBlockedPosts.value = false;
  }
}

async function handleUnblockPost(postId: string) {
  if (unblockingPostIds.value.has(postId)) return;
  unblockingPostIds.value.add(postId);
  try {
    await blocksStore.unblockPost(postId);
    blockedPostsData.value = blockedPostsData.value.filter((p) => p.id !== postId);
    notifySuccess('已取消屏蔽');
  } catch {
    notifyError('取消屏蔽失败');
  } finally {
    unblockingPostIds.value.delete(postId);
  }
}

// 清除数据
async function confirmClearData() {
  isClearing.value = true;
  try {
    await clearUserData();
    await logout();
    localStorage.clear();
    sessionStorage.clear();
    userStore.clearSession();
    window.location.href = '/login';
  } catch {
    notifyError('清除失败，请稍后再试');
    isClearing.value = false;
  }
}

// CSS 相关
async function handleCssUpload({ file }: UploadCustomRequestOptions) {
  try {
    const content = await file.file?.text();
    if (content) {
      await preferencesStore.updateCustomCss(content);
      notifySuccess('CSS 已应用');
    }
  } catch {
    notifyError('上传失败');
  }
}

async function clearCustomCss() {
  try {
    await preferencesStore.updateCustomCss('');
    notifySuccess('自定义 CSS 已清除');
  } catch {
    notifyError('清除失败');
  }
}

function openCssEditor() {
  cssEditorContent.value = userStore.settings?.customCss || '';
  showCssEditor.value = true;
}

async function saveCssFromEditor() {
  try {
    await preferencesStore.updateCustomCss(cssEditorContent.value);
    showCssEditor.value = false;
    notifySuccess('CSS 已应用');
  } catch {
    notifyError('保存失败');
  }
}

const CSS_VARIABLES_TEMPLATE = `:root {
  /* 主题色 */
  --opz-primary: #3b82f6;
  --opz-accent: #eb459e;
  --opz-success: #43b581;
  --opz-warning: #faa61a;
  --opz-danger: #ef4444;

  /* 背景色 */
  --opz-bg-base: #1c1c1e;
  --opz-bg-soft: #2c2c2e;
  --opz-bg-card: #2c2c2e;
  --opz-bg-elevated: #3a3a3c;

  /* 文字色 */
  --opz-text-primary: #ffffff;
  --opz-text-secondary: rgba(235, 235, 235, 0.64);
  --opz-text-tertiary: rgba(235, 235, 245, 0.5);

  /* 边框 */
  --opz-border: rgba(84, 84, 84, 0.48);
  --opz-border-hover: rgba(84, 84, 84, 0.65);
}`;

function insertCssVariables() {
  cssEditorContent.value = cssEditorContent.value
    ? CSS_VARIABLES_TEMPLATE + '\n\n' + cssEditorContent.value
    : CSS_VARIABLES_TEMPLATE;
  notifySuccess('已插入变量模板');
}
</script>

<template>
  <ViewShell title="设置" description="全局界面默认偏好，跨平台保存" show-back>
    <div class="settings-grid">
      <!-- 显示设置 -->
      <SettingCard title="显示设置" variant="primary">
        <SettingItem title="展示模式" desc="帖子的默认展示方式">
          <DisplayModeSelector :model-value="displayMode" @update:model-value="updateDisplayMode" />
        </SettingItem>

        <SettingItem title="作者显示" desc="作者名称的显示方式">
          <RadioGroup
            :options="authorColorOptions"
            :model-value="authorRoleColorEnabled"
            @update:model-value="updateAuthorRoleColor"
          />
        </SettingItem>

        <SettingItem title="字体大小" desc="卡片标题、标签及正文字号">
          <div class="slider-group">
            <div class="slider-item">
              <div class="slider-header">
                <span class="slider-label">标题字号</span>
                <span class="slider-value">{{ formatOffset(cardTitleFontOffset) }}</span>
              </div>
              <NSlider
                v-model:value="cardTitleFontOffset"
                :min="-5"
                :max="5"
                :step="1"
                :marks="{ '-5': '-5', 0: '0', 5: '+5' }"
                @update:value="updateTitleFont"
              />
            </div>
            <div class="slider-item">
              <div class="slider-header">
                <span class="slider-label">内容/标签字号</span>
                <span class="slider-value">{{ formatOffset(cardContentFontOffset) }}</span>
              </div>
              <NSlider
                v-model:value="cardContentFontOffset"
                :min="-5"
                :max="5"
                :step="1"
                :marks="{ '-5': '-5', 0: '0', 5: '+5' }"
                @update:value="updateContentFont"
              />
            </div>
          </div>
          <div class="preview-card">
            <div class="preview-label">预览效果</div>
            <div class="preview-content">
              <div class="preview-tags" :style="{ fontSize: `${11 + cardContentFontOffset}px` }">
                <span class="preview-tag">标签示例</span>
                <span class="preview-tag">热门</span>
              </div>
              <div class="preview-title" :style="{ fontSize: `${14 + cardTitleFontOffset}px` }">
                这是一个标题示例文本
              </div>
              <div class="preview-body" :style="{ fontSize: `${14 + cardContentFontOffset}px` }">
                这是详情页正文内容的示例，支持 Markdown 渲染。
              </div>
            </div>
          </div>
        </SettingItem>
      </SettingCard>

      <!-- 浏览行为 -->
      <SettingCard title="浏览行为" variant="success">
        <SettingItem title="分页模式" desc="移动设备滚动式可能卡顿，搜索页和主页始终为页码式">
          <RadioGroup
            :options="paginationOptions"
            :model-value="paginationStyle"
            @update:model-value="updatePagination"
          />
        </SettingItem>

        <SettingItem title="图片加载" desc="图片和动图的加载行为">
          <RadioGroup
            :options="imageLoadOptions"
            :model-value="imageLoadMode"
            vertical
            @update:model-value="updateImageLoad"
          />
        </SettingItem>

        <SettingItem title="Discord 链接" desc="点击链接时的行为">
          <RadioGroup
            :options="discordLinkOptions"
            :model-value="discordLinkMode"
            @update:model-value="updateDiscordLink"
          />
          <template #hint>
            <p v-if="discordLinkMode === 'app'" class="item-hint danger">
              部分浏览器可能无法唤起 Discord 客户端，如遇问题请切换为浏览器模式。
            </p>
          </template>
        </SettingItem>

        <SettingItem title="已屏蔽帖子" :desc="`共 ${blockedPostsCount} 个帖子`" no-border>
          <div class="blocked-posts-section">
            <button v-if="blockedPostsCount > 0" type="button" class="action-btn" @click="toggleBlockedPosts">
              {{ showBlockedPosts ? '收起' : '展开查看' }}
            </button>
            <span v-else class="empty-hint">暂无屏蔽帖子</span>
            <transition name="collapse">
              <div v-if="showBlockedPosts && blockedPostsCount > 0" class="blocked-posts-list">
                <NSpin v-if="isLoadingBlockedPosts" size="small" />
                <template v-else>
                  <div
                    v-for="post in blockedPostsData"
                    :key="post.id"
                    class="blocked-post-item"
                    :class="{ deleted: post.deleted }"
                  >
                    <div class="post-info">
                      <span class="post-title">{{ post.title || post.id }}</span>
                      <span v-if="post.deleted" class="post-deleted">帖子已删除</span>
                      <span v-else class="post-author">{{ post.authorName }}</span>
                    </div>
                    <button
                      type="button"
                      class="unblock-btn"
                      :class="{ loading: unblockingPostIds.has(post.id) }"
                      :disabled="unblockingPostIds.has(post.id)"
                      title="取消屏蔽"
                      @click="handleUnblockPost(post.id)"
                    >
                      {{ unblockingPostIds.has(post.id) ? '处理中...' : '取消屏蔽' }}
                    </button>
                  </div>
                </template>
              </div>
            </transition>
          </div>
        </SettingItem>
      </SettingCard>

      <!-- 高级设置 -->
      <SettingCard title="高级设置" variant="warning" class="full-width">
        <SettingItem title="自定义样式" desc="上传 CSS 文件自定义界面样式">
          <div class="action-row">
            <NUpload accept=".css" :show-file-list="false" :custom-request="handleCssUpload">
              <button type="button" class="action-btn">上传 CSS</button>
            </NUpload>
            <button type="button" class="action-btn" @click="openCssEditor">
              {{ hasCustomCss ? '编辑 CSS' : '粘贴 CSS' }}
            </button>
            <button v-if="hasCustomCss" type="button" class="action-btn secondary" @click="clearCustomCss">
              清除样式
            </button>
          </div>
          <template #hint>
            <p class="item-hint">
              可用变量：<code>--opz-primary</code>、<code>--opz-accent</code>、<code>--opz-bg-card</code> 等
            </p>
          </template>
        </SettingItem>

        <SettingItem title="清除数据" desc="删除所有设置、关注、收藏等数据" danger>
          <button type="button" class="danger-btn" @click="showClearDataModal = true">清除所有数据</button>
        </SettingItem>
      </SettingCard>
    </div>

    <!-- 保存状态 -->
    <div v-if="isSaving" class="saving-indicator">保存中...</div>

    <!-- 清除数据确认弹窗 -->
    <NModal v-model:show="showClearDataModal" :mask-closable="!isClearing" class="centered-modal">
      <div class="confirm-modal">
        <h3 class="modal-title">确认清除数据？</h3>
        <p class="modal-desc">此操作将清除你的所有数据，包括：</p>
        <ul class="modal-list">
          <li>所有偏好设置</li>
          <li>关注的作者和频道</li>
          <li>收藏的帖子</li>
          <li>屏蔽的内容和用户</li>
        </ul>
        <p class="modal-warning">此操作不可逆！</p>
        <div class="modal-actions">
          <NButton :disabled="isClearing" @click="showClearDataModal = false">取消</NButton>
          <NButton type="error" :loading="isClearing" @click="confirmClearData"> 确认清除 </NButton>
        </div>
      </div>
    </NModal>

    <!-- CSS 编辑弹窗 -->
    <NModal v-model:show="showCssEditor">
      <div class="css-editor-modal">
        <div class="modal-header-row">
          <h3 class="modal-title">自定义 CSS</h3>
          <button type="button" class="help-btn" title="插入变量模板" @click="insertCssVariables">?</button>
        </div>
        <p class="modal-desc">点击 <b>?</b> 插入可用变量模板，修改后保存即可生效。</p>
        <NInput
          v-model:value="cssEditorContent"
          type="textarea"
          placeholder=":root {
  --opz-primary: #3b82f6;
  --opz-bg-base: #1c1c1e;
}"
          :autosize="{ minRows: 12, maxRows: 24 }"
          class="css-textarea"
        />
        <div class="modal-actions">
          <button type="button" class="modal-btn" @click="showCssEditor = false">取消</button>
          <button type="button" class="modal-btn primary" @click="saveCssFromEditor">保存</button>
        </div>
      </div>
    </NModal>
  </ViewShell>
</template>

<style scoped>
/* 网格布局 */
.settings-grid {
  display: grid;
  gap: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

@media (min-width: 640px) {
  .settings-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
  }

  .full-width {
    grid-column: 1 / -1;
  }
}

/* Slider 组 */
.slider-group {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.slider-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slider-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--opz-text-secondary);
}

.slider-value {
  font-size: 0.75rem;
  color: var(--opz-primary);
  font-weight: 600;
  min-width: 45px;
  text-align: right;
}

/* 预览卡片 */
.preview-card {
  margin-top: 0.5rem;
  padding: 0.875rem;
  border-radius: 8px;
  border: 1px dashed var(--opz-border);
  background: var(--opz-bg-elevated);
}

.preview-label {
  font-size: 0.6875rem;
  color: var(--opz-text-tertiary);
  margin-bottom: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.preview-tags {
  display: flex;
  gap: 0.375rem;
}

.preview-tag {
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  border: 1px solid var(--opz-border);
  color: var(--opz-text-secondary);
}

.preview-title {
  font-weight: 600;
  color: var(--opz-text-primary);
  line-height: 1.4;
}

.preview-body {
  color: var(--opz-text-secondary);
  line-height: 1.5;
  margin-top: 0.375rem;
  padding-top: 0.375rem;
  border-top: 1px dashed var(--opz-border);
}

/* 操作按钮 */
.action-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-row :deep(.n-upload) {
  width: auto;
}

.action-btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1.5px solid var(--opz-border);
  background: var(--opz-bg-base);
  color: var(--opz-text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  border-color: var(--opz-primary);
  background: var(--opz-bg-elevated);
}

.action-btn.secondary {
  border-color: var(--opz-text-tertiary);
  color: var(--opz-text-secondary);
}

/* 提示文本 */
.item-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--opz-text-tertiary);
  line-height: 1.5;
}

.item-hint.danger {
  color: #ef4444;
}

.item-hint code {
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background: var(--opz-bg-elevated);
  font-family: monospace;
  font-size: 0.6875rem;
}

/* 危险按钮 */
.danger-btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1.5px solid #ef4444;
  background: transparent;
  color: #ef4444;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.danger-btn:hover {
  background: #ef4444;
  color: #fff;
}

/* 保存状态 */
.saving-indicator {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  background: var(--opz-bg-elevated);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 0.8125rem;
  color: var(--opz-text-secondary);
}

/* 居中弹窗 */
.centered-modal {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 确认弹窗 */
.confirm-modal {
  padding: 1.5rem;
  background: var(--opz-bg-base);
  border-radius: 12px;
  max-width: 400px;
  width: calc(100vw - 2rem);
}

.modal-title {
  margin: 0 0 0.75rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.modal-desc {
  margin: 0 0 0.5rem;
  font-size: 0.9375rem;
  color: var(--opz-text-secondary);
}

.modal-list {
  margin: 0 0 1rem;
  padding-left: 1.25rem;
  font-size: 0.875rem;
  color: var(--opz-text-secondary);
}

.modal-list li {
  margin: 0.25rem 0;
}

.modal-warning {
  margin: 0 0 1.25rem;
  padding: 0.625rem;
  background: #ef444415;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #ef4444;
  text-align: center;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* CSS 编辑弹窗 */
.css-editor-modal {
  padding: 1.5rem;
  background: var(--opz-bg-base);
  border-radius: 12px;
  max-width: 600px;
  width: 90vw;
  margin: 1rem;
}

.modal-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.modal-header-row .modal-title {
  margin: 0;
}

.help-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid var(--opz-border);
  background: var(--opz-bg-elevated);
  color: var(--opz-text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.help-btn:hover {
  border-color: var(--opz-primary);
  color: var(--opz-primary);
}

.css-textarea {
  margin-bottom: 1rem;
}

.css-textarea :deep(textarea) {
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.css-textarea :deep(.n-input) {
  --n-border-focus: 1px solid var(--opz-primary);
  --n-box-shadow-focus: 0 0 0 2px color-mix(in srgb, var(--opz-primary) 20%, transparent);
  --n-caret-color: var(--opz-primary);
}

/* 弹窗按钮 */
.modal-btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1.5px solid var(--opz-border);
  background: var(--opz-bg-base);
  color: var(--opz-text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-btn:hover {
  background: var(--opz-bg-elevated);
  border-color: var(--opz-primary);
}

.modal-btn.primary {
  background: var(--opz-primary);
  border-color: var(--opz-primary);
  color: #fff;
}

.modal-btn.primary:hover {
  opacity: 0.9;
}

/* 已屏蔽帖子 */
.blocked-posts-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.empty-hint {
  font-size: 0.8125rem;
  color: var(--opz-text-tertiary);
}

.blocked-posts-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--opz-bg-soft);
  border: 1px solid var(--opz-border);
  max-height: 300px;
  overflow-y: auto;
}

.blocked-post-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: var(--opz-bg-base);
  border: 1px solid var(--opz-border);
}

.post-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.post-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--opz-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-author {
  font-size: 0.75rem;
  color: var(--opz-text-tertiary);
}

.post-deleted {
  font-size: 0.75rem;
  color: var(--opz-text-tertiary);
  font-style: italic;
}

.blocked-post-item.deleted {
  opacity: 0.7;
}

.blocked-post-item.deleted .post-title {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--opz-text-secondary);
}

.unblock-btn {
  flex-shrink: 0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--opz-border);
  background: transparent;
  color: var(--opz-text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.unblock-btn:hover:not(:disabled) {
  border-color: var(--opz-success);
  color: var(--opz-success);
  background: color-mix(in srgb, var(--opz-success) 10%, transparent);
}

.unblock-btn.loading {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 移动端适配 */
@media (max-width: 639px) {
  .saving-indicator {
    bottom: 1rem;
    right: 1rem;
    left: 1rem;
    text-align: center;
  }
}
</style>
