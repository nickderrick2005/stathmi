<script setup lang="ts">
/**
 * 通用筛选区组件
 * 合并 TagFilterSection 和 KeywordFilterSection 的共同逻辑
 * 支持标签和关键词两种数据类型
 * 支持逐级展开（当数量超过阈值时）
 */
import { computed, ref, watch } from 'vue';
import type { FilterRelation } from '@/stores/filters';
import ActionChip from '@/components/common/ActionChip.vue';
import ChipButton from '@/components/common/ChipButton.vue';
import FilterCard from '@/components/common/FilterCard.vue';
import RelationAndIcon from '@/assets/icons/relation-and.svg?raw';
import RelationOrIcon from '@/assets/icons/relation-or.svg?raw';

// 统一的筛选项接口
interface FilterItem {
  id: string;
  label: string;
}

const INITIAL_LIMIT = 12;
const EXPAND_STEP = 12;

const props = defineProps<{
  /** 卡片标题 */
  title: string;
  /** 卡片描述 */
  description?: string;
  /** 筛选项列表（支持 { id, label } 或纯字符串数组） */
  items: FilterItem[] | string[];
  /** 已激活的项（使用 label 匹配） */
  activeItems: string[];
  /** 已屏蔽的项（使用 label 匹配） */
  blockedItems: string[];
  /** 是否加载中 */
  loading?: boolean;
  /** 频道 ID */
  channelId: string;
  /** AND/OR 关系 */
  relation: FilterRelation;
  /** 骨架屏数量 */
  skeletonCount?: number;
  /** 空状态文案 */
  emptyText?: string;
  /** 是否全部显示（禁用本地展开） */
  showAll?: boolean;
  /** 是否可以从后端加载更多 */
  canLoadMore?: boolean;
  /** 是否正在加载更多 */
  loadingMore?: boolean;
}>();

const emit = defineEmits<{
  toggle: [{ channelId: string; value: string }];
  block: [{ channelId: string; value: string }];
  unblock: [{ channelId: string; value: string }];
  toggleRelation: [{ channelId: string }];
  loadMore: [];
}>();

// 当前展示数量限制
const displayLimit = ref(INITIAL_LIMIT);

// 频道/数据变化时重置展示数量
watch(() => [props.channelId, props.items], () => {
  displayLimit.value = INITIAL_LIMIT;
});

// 规范化为统一格式
const normalizedItems = computed<FilterItem[]>(() => {
  return props.items.map((item) => {
    if (typeof item === 'string') {
      return { id: item, label: item };
    }
    return item;
  });
});

// 过滤掉已屏蔽的项
const availableItems = computed(() => {
  return normalizedItems.value.filter((item) => !props.blockedItems.includes(item.label));
});

// 已激活的项优先排序（方便用户快速取消）
const sortedItems = computed(() => {
  const active: FilterItem[] = [];
  const rest: FilterItem[] = [];
  for (const item of availableItems.value) {
    if (props.activeItems.includes(item.label)) {
      active.push(item);
    } else {
      rest.push(item);
    }
  }
  return [...active, ...rest];
});

// 当前可见的项
const visibleItems = computed(() => {
  // showAll 模式下显示全部
  if (props.showAll) {
    return sortedItems.value;
  }
  return sortedItems.value.slice(0, displayLimit.value);
});

// 是否还有更多可本地展开（非 showAll 模式）
const canExpand = computed(() => {
  if (props.showAll) return false;
  return displayLimit.value < availableItems.value.length;
});

// 剩余数量
const remainingCount = computed(() => {
  return Math.max(0, availableItems.value.length - displayLimit.value);
});

// 展开更多
function expandMore() {
  displayLimit.value = Math.min(availableItems.value.length, displayLimit.value + EXPAND_STEP);
}

// 骨架屏宽度配置
const skeletonWidths = ['4rem', '6rem', '3rem', '5rem', '4rem'];

function getItemState(label: string): 'default' | 'blocked' | 'active' {
  if (props.blockedItems.includes(label)) return 'blocked';
  if (props.activeItems.includes(label)) return 'active';
  return 'default';
}

function getActionTitle(label: string): string {
  const state = getItemState(label);
  if (state === 'blocked') return '取消屏蔽';
  if (state === 'active') return '取消选中';
  return '屏蔽';
}

function handleChipClick(label: string) {
  if (getItemState(label) !== 'blocked') {
    emit('toggle', { channelId: props.channelId, value: label });
  }
}

function handleChipAction(label: string) {
  const state = getItemState(label);
  if (state === 'blocked') {
    emit('unblock', { channelId: props.channelId, value: label });
  } else if (state === 'active') {
    emit('toggle', { channelId: props.channelId, value: label });
  } else {
    emit('block', { channelId: props.channelId, value: label });
  }
}
</script>

<template>
  <FilterCard :title="title" :description="description">
    <template #actions>
      <button
        v-if="activeItems.length > 1"
        type="button"
        class="relation-toggle"
        :class="{ active: relation === 'AND' }"
        :title="relation === 'AND' ? '切换为「任一」关系' : '切换为「全部」关系'"
        @click="emit('toggleRelation', { channelId })"
      >
        <span v-html="relation === 'AND' ? RelationAndIcon : RelationOrIcon"></span>
        <span class="relation-text">{{ relation === 'AND' ? '全部' : '任一' }}</span>
      </button>
    </template>

    <div v-if="loading" class="chip-row">
      <ChipButton
        v-for="(width, index) in skeletonWidths.slice(0, skeletonCount || 5)"
        :key="`skeleton-${index}`"
        variant="skeleton"
        :width="width"
      />
    </div>
    <div v-else-if="!availableItems.length" class="loading-hint">
      {{ emptyText || '暂无数据' }}
    </div>
    <template v-else>
      <div class="chip-row">
        <ActionChip
          v-for="item in visibleItems"
          :key="item.id"
          :label="item.label"
          :variant="getItemState(item.label)"
          :action-title="getActionTitle(item.label)"
          @click="handleChipClick(item.label)"
          @action="handleChipAction(item.label)"
        />
      </div>
      <!-- 本地展开更多 -->
      <button
        v-if="canExpand"
        type="button"
        class="expand-btn"
        @click="expandMore"
      >
        展开更多 ({{ remainingCount }})
      </button>
      <!-- 从后端加载更多 -->
      <button
        v-if="canLoadMore"
        type="button"
        class="expand-btn"
        :disabled="loadingMore"
        @click="emit('loadMore')"
      >
        {{ loadingMore ? '加载中...' : '加载更多热词' }}
      </button>
    </template>
  </FilterCard>
</template>

<style scoped>
.relation-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--opz-border);
  border-radius: 8px;
  background: var(--opz-bg-base);
  color: var(--opz-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.relation-toggle:hover {
  border-color: #0ea5e9;
  color: #0ea5e9;
}

.relation-toggle.active {
  background: rgba(14, 165, 233, 0.1);
  border-color: #0ea5e9;
  color: #0ea5e9;
}

.relation-toggle :deep(svg) {
  width: 16px;
  height: 16px;
  display: block;
}

.relation-text {
  font-size: 0.75rem;
  font-weight: 600;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.loading-hint {
  padding: 1rem;
  text-align: center;
  color: var(--opz-text-muted);
  font-size: 0.875rem;
}

.expand-btn {
  display: block;
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.5rem;
  border: 1px solid var(--opz-border);
  border-radius: var(--opz-radius-md);
  background: transparent;
  color: var(--opz-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--opz-transition-fast);
}

.expand-btn:hover {
  border-color: var(--opz-primary);
  color: var(--opz-primary);
  background: color-mix(in srgb, var(--opz-primary) 5%, transparent);
}
</style>
