<script setup lang="ts">
/**
 * 帖子操作菜单
 * 右上角...按钮，点击展开菜单
 */
import { ref, computed } from 'vue';
import { NPopover } from 'naive-ui';
import { useFollowsStore } from '@/stores/follows';
import { notifySuccess, notifyError } from '@/utils/notifications';
import IconStar from '@/assets/icons/star-outline.svg?raw';
import IconStarFilled from '@/assets/icons/star-filled.svg?raw';
import IconZoom from '@/assets/icons/zoom.svg?raw';
import IconShare from '@/assets/icons/share.svg?raw';
import IconUser from '@/assets/icons/user.svg?raw';
import IconUsers from '@/assets/icons/users.svg?raw';
import IconSearch from '@/assets/icons/search.svg?raw';
import IconBlock from '@/assets/icons/block.svg?raw';
import IconFlag from '@/assets/icons/flag.svg?raw';
import IconChevronRight from '@/assets/icons/chevron-right.svg?raw';

const props = defineProps<{
  postId: string;
  authorId?: string;
  /** floating: 独立浮动 | stacked: 在按钮组中 | compact: list/minimal视图紧凑样式 */
  variant?: 'floating' | 'stacked' | 'compact';
  hasImages?: boolean;
  /** 是否显示收藏选项（list/minimal 视图用） */
  showFavorite?: boolean;
  isFavorited?: boolean;
}>();

const emit = defineEmits<{
  toggleFavorite: [];
  viewImages: [];
  share: [];
  viewAuthor: [];
  findSimilar: [];
  blockPost: [];
  blockPostAndAuthor: [];
  report: [];
}>();

const showPopover = ref(false);
const showBlockSubmenu = ref(false);
const isProcessing = ref(false);
const followsStore = useFollowsStore();

const isFollowingAuthor = computed(() => {
  if (!props.authorId) return false;
  return followsStore.isFollowingAuthor(props.authorId);
});

async function handleToggleFollowAuthor() {
  if (!props.authorId || isProcessing.value) return;

  isProcessing.value = true;
  showPopover.value = false;
  try {
    await followsStore.toggleAuthorFollow(props.authorId);
    notifySuccess(isFollowingAuthor.value ? '已关注' : '已取消关注');
  } catch {
    notifyError('操作失败，请重试');
  } finally {
    isProcessing.value = false;
  }
}

function handleSelect(action: string) {
  showPopover.value = false;
  showBlockSubmenu.value = false;

  switch (action) {
    case 'toggleFavorite':
      emit('toggleFavorite');
      break;
    case 'viewImages':
      emit('viewImages');
      break;
    case 'share':
      emit('share');
      break;
    case 'viewAuthor':
      emit('viewAuthor');
      break;
    case 'findSimilar':
      emit('findSimilar');
      break;
    case 'blockPost':
      emit('blockPost');
      break;
    case 'blockPostAndAuthor':
      emit('blockPostAndAuthor');
      break;
    case 'report':
      emit('report');
      break;
  }
}

function stopPropagation(e: Event) {
  e.stopPropagation();
}
</script>

<template>
  <div class="post-action-menu" :class="props.variant ?? 'floating'" @click="stopPropagation">
    <NPopover
      v-model:show="showPopover"
      trigger="click"
      placement="bottom-end"
      :show-arrow="false"
      raw
    >
      <template #trigger>
        <button class="menu-button" aria-label="更多操作">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="3" r="1.5" fill="currentColor" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            <circle cx="8" cy="13" r="1.5" fill="currentColor" />
          </svg>
        </button>
      </template>

      <div class="menu-dropdown">
        <!-- 收藏（list/minimal 视图显示） -->
        <button
          v-if="showFavorite"
          type="button"
          class="menu-option favorite-option"
          :class="{ active: isFavorited }"
          @click="handleSelect('toggleFavorite')"
        >
          <span class="menu-option-icon" v-html="isFavorited ? IconStarFilled : IconStar"></span>
          <span>{{ isFavorited ? '取消收藏' : '收藏' }}</span>
        </button>

        <!-- 分享 -->
        <button type="button" class="menu-option" @click="handleSelect('share')">
          <span class="menu-option-icon" v-html="IconShare"></span>
          <span>分享</span>
        </button>

        <!-- 查看大图 -->
        <button
          v-if="hasImages"
          type="button"
          class="menu-option"
          @click="handleSelect('viewImages')"
        >
          <span class="menu-option-icon" v-html="IconZoom"></span>
          <span>查看大图</span>
        </button>

        <div class="menu-divider" />

        <!-- 作者主页 -->
        <button type="button" class="menu-option" @click="handleSelect('viewAuthor')">
          <span class="menu-option-icon" v-html="IconUser"></span>
          <span>作者主页</span>
        </button>

        <!-- 关注/取消关注作者 -->
        <button
          v-if="authorId"
          type="button"
          class="menu-option"
          :disabled="isProcessing"
          @click="handleToggleFollowAuthor"
        >
          <span class="menu-option-icon" v-html="IconUsers"></span>
          <span>{{ isFollowingAuthor ? '取消关注作者' : '关注作者' }}</span>
        </button>

        <!-- 寻找相似 -->
        <button type="button" class="menu-option" @click="handleSelect('findSimilar')">
          <span class="menu-option-icon" v-html="IconSearch"></span>
          <span>寻找相似</span>
        </button>

        <div class="menu-divider" />

        <!-- 屏蔽（子菜单） -->
        <div class="menu-submenu-wrapper">
          <button
            type="button"
            class="menu-option has-submenu"
            @click="showBlockSubmenu = !showBlockSubmenu"
          >
            <span class="menu-option-icon" v-html="IconBlock"></span>
            <span>屏蔽</span>
            <span class="menu-option-chevron" :class="{ expanded: showBlockSubmenu }" v-html="IconChevronRight"></span>
          </button>

          <div v-if="showBlockSubmenu" class="menu-submenu">
            <button type="button" class="menu-option" @click="handleSelect('blockPost')">
              <span>仅屏蔽此帖</span>
            </button>
            <button
              v-if="authorId"
              type="button"
              class="menu-option"
              @click="handleSelect('blockPostAndAuthor')"
            >
              <span>屏蔽帖子和作者</span>
            </button>
          </div>
        </div>

        <!-- 举报 -->
        <button type="button" class="menu-option danger" @click="handleSelect('report')">
          <span class="menu-option-icon" v-html="IconFlag"></span>
          <span>举报</span>
        </button>
      </div>
    </NPopover>
  </div>
</template>

<style scoped>
.post-action-menu {
  z-index: 10;
}

.post-action-menu.floating {
  position: absolute;
  top: 8px;
  right: 8px;
}

/* stacked: 在按钮组中，保持圆形按钮样式 */
.post-action-menu.stacked {
  position: static;
}

/* compact: list/minimal 视图用 */
.post-action-menu.compact {
  position: static;
}

/* 默认按钮样式（floating/stacked 用） */
.menu-button {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--opz-bg-base) 85%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--opz-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  pointer-events: auto;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--opz-bg-base) 30%, transparent);
  opacity: 0.9;
}

.menu-button:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--opz-bg-base) 95%, transparent);
  transform: translateY(-1px) scale(1.05);
}

.menu-button:active {
  transform: scale(0.95);
}

/* compact 样式（list/minimal 视图用）：更紧凑、无背景 */
.post-action-menu.compact .menu-button {
  width: 28px;
  height: 28px;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  opacity: 0.6;
  border-radius: 6px;
}

.post-action-menu.compact .menu-button:hover {
  opacity: 1;
  background: var(--opz-bg-soft);
  transform: none;
}

.post-action-menu.compact .menu-button:active {
  transform: scale(0.95);
}

.post-action-menu.compact .menu-button svg {
  width: 14px;
  height: 14px;
}

/* 下拉菜单 */
.menu-dropdown {
  background: var(--opz-bg-base);
  border: 1px solid var(--opz-border);
  border-radius: 10px;
  padding: 6px;
  min-width: 150px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.menu-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 14px;
  color: var(--opz-text-primary);
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
}

.menu-option:hover {
  background: var(--opz-bg-soft);
}

.menu-option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-option.favorite-option {
  color: var(--opz-text-primary);
}

.menu-option.favorite-option.active {
  color: #f7b731;
}

.menu-option.favorite-option.active .menu-option-icon {
  opacity: 1;
  color: #f7b731;
}

.menu-option.danger {
  color: #e53935;
}

.menu-option.danger .menu-option-icon {
  color: #e53935;
}

.menu-option.danger:hover {
  background: rgba(229, 57, 53, 0.08);
}

.menu-option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  opacity: 0.7;
  color: var(--opz-text-secondary);
  flex-shrink: 0;
}

.menu-option-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.menu-option:hover .menu-option-icon {
  opacity: 1;
}

.menu-option.has-submenu {
  justify-content: flex-start;
}

.menu-option-chevron {
  display: flex;
  align-items: center;
  width: 14px;
  height: 14px;
  opacity: 0.5;
  color: var(--opz-text-tertiary);
  margin-left: auto;
  transition: transform 0.15s ease;
}

.menu-option-chevron :deep(svg) {
  width: 14px;
  height: 14px;
}

.menu-option-chevron.expanded {
  transform: rotate(90deg);
}

.menu-divider {
  height: 1px;
  background: var(--opz-border);
  margin: 4px 6px;
}

.menu-submenu-wrapper {
  position: relative;
}

.menu-submenu {
  padding-left: 12px;
  margin-top: 2px;
}

.menu-submenu .menu-option {
  font-size: 13px;
  padding: 6px 10px;
}

/* 手机端 */
@media (max-width: 600px) {
  .menu-button {
    width: 30px;
    height: 30px;
  }

  .menu-button svg {
    width: 15px;
    height: 15px;
  }

  .menu-dropdown {
    min-width: 140px;
  }

  .menu-option {
    font-size: 13px;
    padding: 7px 8px;
    gap: 8px;
  }

  .menu-option-icon {
    width: 16px;
    height: 16px;
  }

  .menu-option-icon :deep(svg) {
    width: 16px;
    height: 16px;
  }
}
</style>
