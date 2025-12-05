<script setup lang="ts">
import { computed, ref } from 'vue';
import { NPopover } from 'naive-ui';
import type { DisplayMode } from '@opz-hub/shared';
import ChipButton from '@/components/common/ChipButton.vue';
import PaginationControl from '@/components/common/PaginationControl.vue';
import { useFeedDisplayMode } from '@/composables/useFeedDisplayMode';

const props = defineProps<{
  sortOptions?: Array<{ value: string; label: string }>;
  activeSort?: string; // e.g. weighted-desc / weighted-asc
  showFilter?: boolean;
  hasActiveFilters?: boolean;
  // 分页相关
  showPagination?: boolean;
  currentPage?: number;
  total?: number;
  pageSize?: number;
  paginationDisabled?: boolean;
  // 显示模式
  feedKey?: string;
}>();

const emit = defineEmits<{
  sort: [value: string]; // same format as activeSort
  filter: [];
  pageChange: [page: number];
  pageSizeChange: [size: number];
}>();

// 显示模式，响应式防止闭包
const { displayMode, setDisplayMode } = useFeedDisplayMode(() => props.feedKey ?? 'default');

// 下拉菜单状态
const showMobileSortMenu = ref(false);
const showSettingsMenu = ref(false);

const displayModeOptions: Array<{ value: DisplayMode; icon: string; title: string }> = [
  { value: 'large', icon: 'grid', title: '卡片' },
  { value: 'list', icon: 'list', title: '列表' },
  { value: 'minimal', icon: 'table', title: '极简' },
];

const pageSizeOptions = [20, 30, 40, 50, 100];

// 当前视图模式的图标类型
const currentModeIcon = computed(() => {
  const current = displayModeOptions.find((o) => o.value === displayMode.value);
  return current?.icon ?? 'grid';
});

function handleDisplayModeChange(mode: DisplayMode) {
  setDisplayMode(mode);
  showSettingsMenu.value = false;
}

function parseActiveSort(value: string | undefined) {
  if (!value) {
    return { base: '', direction: 'desc' as const };
  }
  const [base, direction] = value.split('-');
  return { base, direction: direction === 'asc' ? 'asc' : ('desc' as const) };
}

const resolvedSort = computed(() => parseActiveSort(props.activeSort));

// 当前排序的显示文本
const currentSortLabel = computed(() => {
  if (!props.sortOptions?.length) return '';
  const current = props.sortOptions.find((o) => o.value === resolvedSort.value.base);
  if (!current) return '';
  const arrow = resolvedSort.value.direction === 'asc' ? '↑' : '↓';
  return `${current.label} ${arrow}`;
});

function handleSortChange(value: string) {
  if (!props.sortOptions?.length) return;
  const { base, direction } = resolvedSort.value;
  const nextDirection = base === value && direction === 'desc' ? 'asc' : 'desc';
  emit('sort', `${value}-${nextDirection}`);
  showMobileSortMenu.value = false;
}

function openFilterDrawer() {
  emit('filter');
}

function sortLabel(optionValue: string, label: string) {
  if (resolvedSort.value.base !== optionValue) return label;
  return `${label} ${resolvedSort.value.direction === 'asc' ? '↑' : '↓'}`;
}

function handlePageChange(page: number) {
  emit('pageChange', page);
}

function handlePageSizeChange(size: number) {
  if (size === props.pageSize) return;
  emit('pageSizeChange', size);
  showSettingsMenu.value = false;
}

// 是否显示分页（有分页数据且超过一页）
const shouldShowPagination = computed(() => {
  if (!props.showPagination) return false;
  const total = props.total ?? 0;
  const pageSize = props.pageSize ?? 40;
  return total > pageSize;
});
</script>

<template>
  <div class="feed-topbar">
    <div class="left">
      <!-- 左侧插槽：用于放置筛选组件等 -->
      <slot />

      <!-- 桌面端：完整排序按钮组 -->
      <div v-if="sortOptions?.length" class="sort-group desktop-only">
        <ChipButton
          v-for="option in sortOptions"
          :key="option.value"
          :active="resolvedSort.base === option.value"
          shape="squared"
          size="small"
          @click="handleSortChange(option.value)"
        >
          {{ sortLabel(option.value, option.label) }}
        </ChipButton>
      </div>

      <!-- 移动端：排序下拉 -->
      <NPopover
        v-if="sortOptions?.length"
        v-model:show="showMobileSortMenu"
        trigger="click"
        placement="bottom-start"
        :show-arrow="false"
        raw
        class="mobile-only"
      >
        <template #trigger>
          <button type="button" class="mobile-sort-btn mobile-only">
            <svg class="sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M6 12h12M9 18h6" stroke-linecap="round" />
            </svg>
            <span class="sort-label">{{ currentSortLabel }}</span>
          </button>
        </template>
        <div class="mobile-dropdown">
          <div class="dropdown-section-title">排序方式</div>
          <button
            v-for="option in sortOptions"
            :key="option.value"
            type="button"
            class="dropdown-option"
            :class="{ active: resolvedSort.base === option.value }"
            @click="handleSortChange(option.value)"
          >
            <span>{{ option.label }}</span>
            <span v-if="resolvedSort.base === option.value" class="sort-direction">
              {{ resolvedSort.direction === 'asc' ? '↑' : '↓' }}
            </span>
          </button>
        </div>
      </NPopover>
    </div>

    <div class="right">
      <!-- 统一的视图设置下拉（桌面端+移动端） -->
      <NPopover
        v-if="feedKey"
        v-model:show="showSettingsMenu"
        trigger="click"
        placement="bottom-end"
        :show-arrow="false"
        raw
      >
        <template #trigger>
          <button type="button" class="settings-trigger">
            <!-- 动态图标：根据当前视图模式 -->
            <svg v-if="currentModeIcon === 'grid'" class="mode-icon" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <svg v-else-if="currentModeIcon === 'list'" class="mode-icon" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="4" width="5" height="4" rx="1" />
              <rect x="10" y="5" width="11" height="2" rx="1" />
              <rect x="3" y="10" width="5" height="4" rx="1" />
              <rect x="10" y="11" width="11" height="2" rx="1" />
              <rect x="3" y="16" width="5" height="4" rx="1" />
              <rect x="10" y="17" width="11" height="2" rx="1" />
            </svg>
            <svg v-else class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
              <path d="M9 3v18" />
            </svg>
            <span class="settings-label">视图</span>
          </button>
        </template>
        <div class="settings-dropdown">
          <!-- 视图模式 -->
          <div class="dropdown-section-title">视图模式</div>
          <div class="view-mode-options">
            <button
              v-for="option in displayModeOptions"
              :key="option.value"
              type="button"
              class="view-mode-btn"
              :class="{ active: displayMode === option.value }"
              @click="handleDisplayModeChange(option.value)"
            >
              <svg v-if="option.icon === 'grid'" class="mode-icon" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <svg v-else-if="option.icon === 'list'" class="mode-icon" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="4" width="5" height="4" rx="1" />
                <rect x="10" y="5" width="11" height="2" rx="1" />
                <rect x="3" y="10" width="5" height="4" rx="1" />
                <rect x="10" y="11" width="11" height="2" rx="1" />
                <rect x="3" y="16" width="5" height="4" rx="1" />
                <rect x="10" y="17" width="11" height="2" rx="1" />
              </svg>
              <svg
                v-else-if="option.icon === 'table'"
                class="mode-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
                <path d="M9 3v18" />
              </svg>
              <span>{{ option.title }}</span>
            </button>
          </div>

          <!-- 分页大小 -->
          <div class="dropdown-divider" />
          <div class="dropdown-section-title">每页数量</div>
          <div class="page-size-options">
            <button
              v-for="size in pageSizeOptions"
              :key="size"
              type="button"
              class="page-size-btn"
              :class="{ active: pageSize === size }"
              @click="handlePageSizeChange(size)"
            >
              {{ size }}
            </button>
          </div>
        </div>
      </NPopover>

      <button
        v-if="showFilter"
        type="button"
        class="filter-trigger"
        :class="{ active: hasActiveFilters }"
        @click="openFilterDrawer"
      >
        <img src="@/assets/icons/filter.svg" alt="" class="icon" />
        <span class="filter-text">筛选</span>
      </button>

      <PaginationControl
        v-if="shouldShowPagination"
        compact
        :current="currentPage || 1"
        :total="total || 0"
        :page-size="pageSize || 40"
        :disabled="paginationDisabled"
        @page-change="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped>
.feed-topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 0 0.5rem;
}

.left {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.sort-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  background: var(--opz-bg-soft, #f8f8f8);
  border: 1px solid var(--opz-border, rgba(60, 60, 60, 0.12));
  border-radius: 12px;
}

.right {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-left: auto;
}

/* 统一的视图设置按钮 */
.settings-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--opz-border, rgba(60, 60, 60, 0.12));
  border-radius: 10px;
  background: var(--opz-bg-soft, #f8f8f8);
  color: var(--opz-text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.settings-trigger:hover {
  background: var(--opz-bg-mute, #f2f2f2);
}

.settings-trigger .mode-icon {
  width: 16px;
  height: 16px;
  color: var(--opz-text-secondary);
}

.settings-label {
  white-space: nowrap;
}

.mode-icon {
  width: 16px;
  height: 16px;
}

.filter-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--opz-border, rgba(60, 60, 60, 0.12));
  border-radius: 10px;
  background: var(--opz-bg-soft, #f8f8f8);
  color: var(--opz-text-primary, var(--opz-text-primary));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    transform 0.1s ease;
}

.filter-trigger:hover {
  background: var(--opz-bg-mute, #f2f2f2);
}

.filter-trigger:active {
  transform: scale(0.95);
}

.filter-trigger.active {
  background: var(--opz-primary, #4a90e2);
  border-color: var(--opz-primary, #4a90e2);
  color: white;
}

.filter-trigger.active:hover {
  opacity: 0.9;
}

.filter-trigger.active .icon {
  filter: brightness(0) invert(1);
  opacity: 1;
}

.icon {
  width: 14px;
  height: 14px;
  opacity: 0.75;
}

/* 移动端排序按钮 */
.mobile-sort-btn {
  display: none;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--opz-border, rgba(60, 60, 60, 0.12));
  border-radius: 10px;
  background: var(--opz-bg-soft, #f8f8f8);
  color: var(--opz-text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mobile-sort-btn:hover {
  background: var(--opz-bg-mute, #f2f2f2);
}

.mobile-sort-btn .sort-icon {
  width: 16px;
  height: 16px;
  opacity: 0.7;
}

.mobile-sort-btn .sort-label {
  white-space: nowrap;
}

/* 统一下拉菜单 */
.settings-dropdown,
.mobile-dropdown {
  background: var(--opz-bg-base);
  border: 1px solid var(--opz-border);
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.settings-dropdown {
  min-width: 200px;
}

.mobile-dropdown {
  min-width: 140px;
}

.dropdown-section-title {
  padding: 6px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--opz-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dropdown-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  border: none;
  outline: none;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  color: var(--opz-text-primary);
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
}

.dropdown-option:hover {
  background: var(--opz-bg-soft);
}

.dropdown-option.active {
  background: var(--opz-primary);
  color: #fff;
  font-weight: 500;
}

.sort-direction {
  font-weight: 600;
  color: inherit;
}

.dropdown-divider {
  height: 1px;
  background: var(--opz-border);
  margin: 8px 4px;
}

/* 视图模式选项 */
.view-mode-options {
  display: flex;
  gap: 4px;
  padding: 4px;
}

.view-mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  padding: 10px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--opz-text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-mode-btn:hover {
  background: var(--opz-bg-soft);
}

.view-mode-btn.active {
  background: var(--opz-primary);
  border-color: var(--opz-primary);
  color: white;
}

.view-mode-btn .mode-icon {
  width: 20px;
  height: 20px;
}

/* 分页大小选项 */
.page-size-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px;
}

.page-size-btn {
  min-width: 44px;
  padding: 8px 12px;
  border: 1px solid var(--opz-border);
  border-radius: 8px;
  background: transparent;
  color: var(--opz-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.page-size-btn:hover {
  background: var(--opz-bg-soft);
  border-color: var(--opz-text-tertiary);
}

.page-size-btn.active {
  background: var(--opz-primary);
  border-color: var(--opz-primary);
  color: white;
}

/* 响应式：桌面端/移动端切换 */
.desktop-only {
  display: flex;
}

.mobile-only {
  display: none;
}

/* 暗色主题适配 */
:root[data-theme='dark'] .sort-group {
  background: var(--opz-bg-soft, #222);
  border-color: var(--opz-border, rgba(84, 84, 84, 0.48));
}

:root[data-theme='dark'] .settings-trigger,
:root[data-theme='dark'] .mobile-sort-btn {
  background: var(--opz-bg-soft, #222);
  border-color: var(--opz-border, rgba(84, 84, 84, 0.48));
}

:root[data-theme='dark'] .settings-trigger:hover,
:root[data-theme='dark'] .mobile-sort-btn:hover {
  background: var(--opz-bg-mute, #282828);
}

:root[data-theme='dark'] .filter-trigger {
  background: var(--opz-bg-soft, #222);
  border-color: var(--opz-border, rgba(84, 84, 84, 0.48));
}

:root[data-theme='dark'] .filter-trigger:hover {
  background: var(--opz-bg-mute, #282828);
}

:root[data-theme='dark'] .filter-trigger .icon {
  filter: invert(1);
}

:root[data-theme='dark'] .filter-trigger.active {
  background: var(--opz-primary, #4a90e2);
  border-color: var(--opz-primary, #4a90e2);
}

:root[data-theme='dark'] .filter-trigger.active .icon {
  filter: brightness(0) invert(1);
}

:root[data-theme='dark'] .settings-dropdown,
:root[data-theme='dark'] .mobile-dropdown {
  background: var(--opz-bg-elevated, #2a2a2a);
  border-color: var(--opz-border, rgba(84, 84, 84, 0.48));
}

:root[data-theme='dark'] .dropdown-option:hover,
:root[data-theme='dark'] .view-mode-btn:hover {
  background: var(--opz-bg-mute, #333);
}

:root[data-theme='dark'] .view-mode-btn.active {
  background: var(--opz-primary);
  border-color: var(--opz-primary);
  color: white;
}

:root[data-theme='dark'] .page-size-btn {
  border-color: var(--opz-border, rgba(84, 84, 84, 0.48));
}

:root[data-theme='dark'] .page-size-btn:hover {
  background: var(--opz-bg-mute, #333);
}

/* 移动端样式 */
@media (max-width: 640px) {
  .feed-topbar {
    flex-wrap: nowrap;
    gap: 0.4rem;
    padding: 0.2rem 0 0.4rem;
  }

  .right {
    gap: 0.4rem;
  }

  .filter-text,
  .settings-label {
    display: none;
  }

  .filter-trigger {
    height: 34px;
    padding: 0 10px;
  }

  .settings-trigger {
    padding: 0 8px;
  }

  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: flex;
  }

  .mobile-sort-btn {
    display: flex;
  }
}
</style>
