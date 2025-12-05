<script setup lang="ts">
import { computed, ref } from 'vue';
import { NPopover } from 'naive-ui';
import type { UserProfileSort } from '@opz-hub/shared';
import PaginationControl from '@/components/common/PaginationControl.vue';

export interface ChannelOption {
  value: string | null;
  label: string;
  count: number;
}

export interface SortOption {
  value: UserProfileSort;
  label: string;
}

const props = defineProps<{
  channelOptions: ChannelOption[];
  sortOptions: SortOption[];
  channelId: string | null;
  sort: UserProfileSort;
  // 分页相关
  total?: number;
  currentPage?: number;
  pageSize?: number;
  isPageMode?: boolean;
}>();

const emit = defineEmits<{
  'update:channelId': [value: string | null];
  'update:sort': [value: UserProfileSort];
  'pageChange': [page: number];
}>();

// 下拉菜单状态
const showChannelMenu = ref(false);
const showSortMenu = ref(false);

// 当前分区名称
const currentChannelLabel = computed(() => {
  const opt = props.channelOptions.find((o) => o.value === props.channelId);
  return opt ? `${opt.label} (${opt.count})` : '全部';
});

// 当前排序名称
const currentSortLabel = computed(() => {
  const opt = props.sortOptions.find((o) => o.value === props.sort);
  return opt?.label ?? '排序';
});

// 是否显示分页
const shouldShowPagination = computed(() => {
  if (!props.isPageMode) return false;
  const total = props.total ?? 0;
  const pageSize = props.pageSize ?? 40;
  return total > pageSize;
});

function selectChannel(value: string | null) {
  emit('update:channelId', value);
  showChannelMenu.value = false;
}

function selectSort(value: UserProfileSort) {
  emit('update:sort', value);
  showSortMenu.value = false;
}

function handlePageChange(page: number) {
  emit('pageChange', page);
}
</script>

<template>
  <div class="profile-filters">
    <div class="filters-left">
      <!-- 分区筛选 -->
      <NPopover
        v-model:show="showChannelMenu"
        trigger="click"
        placement="bottom-start"
        :show-arrow="false"
        raw
      >
        <template #trigger>
          <button type="button" class="filter-trigger">
            <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span class="filter-label">{{ currentChannelLabel }}</span>
            <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </template>
        <div class="filter-dropdown">
          <div class="dropdown-section-title">分区筛选</div>
          <button
            v-for="option in channelOptions"
            :key="option.value ?? '__all__'"
            type="button"
            class="dropdown-option"
            :class="{ active: channelId === option.value }"
            @click="selectChannel(option.value)"
          >
            <span>{{ option.label }}</span>
            <span class="option-count">{{ option.count }}</span>
          </button>
        </div>
      </NPopover>

      <!-- 排序筛选 -->
      <NPopover
        v-model:show="showSortMenu"
        trigger="click"
        placement="bottom-start"
        :show-arrow="false"
        raw
      >
        <template #trigger>
          <button type="button" class="filter-trigger">
            <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M6 12h12M9 18h6" stroke-linecap="round" />
            </svg>
            <span class="filter-label">{{ currentSortLabel }}</span>
            <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </template>
        <div class="filter-dropdown">
          <div class="dropdown-section-title">排序方式</div>
          <button
            v-for="option in sortOptions"
            :key="option.value"
            type="button"
            class="dropdown-option"
            :class="{ active: sort === option.value }"
            @click="selectSort(option.value)"
          >
            <span>{{ option.label }}</span>
          </button>
        </div>
      </NPopover>
    </div>

    <div class="filters-right">
      <PaginationControl
        v-if="shouldShowPagination"
        compact
        :current="currentPage || 1"
        :total="total || 0"
        :page-size="pageSize || 40"
        @page-change="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped>
.profile-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filters-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filters-right {
  display: flex;
  align-items: center;
  margin-left: auto;
}

/* 筛选按钮 */
.filter-trigger {
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

.filter-trigger:hover {
  background: var(--opz-bg-mute, #f2f2f2);
}

.filter-icon {
  width: 16px;
  height: 16px;
  color: var(--opz-text-secondary);
}

.filter-label {
  white-space: nowrap;
}

.dropdown-arrow {
  width: 14px;
  height: 14px;
  opacity: 0.5;
  margin-left: -2px;
}

/* 下拉菜单 */
.filter-dropdown {
  background: var(--opz-bg-base);
  border: 1px solid var(--opz-border);
  border-radius: 12px;
  padding: 8px;
  min-width: 160px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
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
  background: var(--opz-bg-soft);
  color: var(--opz-primary);
  font-weight: 500;
}

.option-count {
  font-size: 12px;
  color: var(--opz-text-tertiary);
}

.dropdown-option.active .option-count {
  color: var(--opz-primary);
  opacity: 0.7;
}

/* 暗色主题适配 */
:root[data-theme='dark'] .filter-trigger {
  background: var(--opz-bg-soft, #222);
  border-color: var(--opz-border, rgba(84, 84, 84, 0.48));
}

:root[data-theme='dark'] .filter-trigger:hover {
  background: var(--opz-bg-mute, #282828);
}

:root[data-theme='dark'] .filter-dropdown {
  background: var(--opz-bg-elevated, #2a2a2a);
  border-color: var(--opz-border, rgba(84, 84, 84, 0.48));
}

:root[data-theme='dark'] .dropdown-option:hover {
  background: var(--opz-bg-mute, #333);
}

:root[data-theme='dark'] .dropdown-option.active {
  background: var(--opz-bg-mute, #333);
}

/* 移动端 */
@media (max-width: 640px) {
  .profile-filters {
    gap: 0.4rem;
  }

  .filters-left {
    gap: 0.4rem;
  }

  .filter-trigger {
    height: 32px;
    padding: 0 8px;
    font-size: 12px;
  }

  .filter-label {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
