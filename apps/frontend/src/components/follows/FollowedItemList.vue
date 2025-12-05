<script setup lang="ts">
import { computed } from 'vue';
import { NEmpty } from 'naive-ui';
import { useQuickConfirm } from '@/composables/useQuickConfirm';

export interface FollowedItem {
  id: string;
  name: string;
  groupId?: string;
  groupName?: string;
  extra?: string; // 额外信息，如帖子数
}

export interface ItemGroup {
  id: string;
  name: string;
}

const props = defineProps<{
  items: FollowedItem[];
  groups?: ItemGroup[];
  emptyText?: string;
  loading?: boolean;
  removeConfirmText?: string;
}>();

const emit = defineEmits<{
  remove: [id: string];
}>();

// 按分组归类
const groupedItems = computed(() => {
  if (!props.groups || props.groups.length === 0) {
    return [{ group: null, items: props.items }];
  }

  const groupMap = new Map<string, FollowedItem[]>();
  const ungrouped: FollowedItem[] = [];

  for (const item of props.items) {
    if (item.groupId) {
      if (!groupMap.has(item.groupId)) {
        groupMap.set(item.groupId, []);
      }
      groupMap.get(item.groupId)!.push(item);
    } else {
      ungrouped.push(item);
    }
  }

  const result: { group: ItemGroup | null; items: FollowedItem[] }[] = [];

  // 先添加无分组的
  if (ungrouped.length > 0) {
    result.push({ group: { id: 'global', name: '通用' }, items: ungrouped });
  }

  // 再添加有分组的
  for (const group of props.groups) {
    const groupItems = groupMap.get(group.id);
    if (groupItems && groupItems.length > 0) {
      result.push({ group, items: groupItems });
    }
  }

  return result;
});

const { confirm } = useQuickConfirm();

async function handleRemove(e: Event, id: string) {
  const confirmed = await confirm(e, props.removeConfirmText || '确定要移除吗？');
  if (!confirmed) return;
  emit('remove', id);
}
</script>

<template>
  <div class="followed-item-list">
    <div v-if="loading" class="loading">加载中...</div>
    <template v-else-if="items.length > 0">
      <div v-for="groupData in groupedItems" :key="groupData.group?.id || 'ungrouped'" class="item-group">
        <h4 v-if="groupData.group && groupedItems.length > 1" class="group-title">
          {{ groupData.group.name }}
        </h4>
        <ul class="item-list">
          <li v-for="item in groupData.items" :key="item.id" class="item">
            <span class="item-name">{{ item.name }}</span>
            <span v-if="item.extra" class="item-extra">{{ item.extra }}</span>
            <button class="remove-btn" aria-label="移除" @click="handleRemove($event, item.id)">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </li>
        </ul>
      </div>
    </template>
    <NEmpty v-else :description="emptyText || '暂无数据'" />
  </div>
</template>

<style scoped>
.followed-item-list {
  width: 100%;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--opz-text-secondary);
}

.item-group {
  margin-bottom: 1rem;
}

.item-group:last-child {
  margin-bottom: 0;
}

.group-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--opz-text-secondary);
  margin: 0 0 0.5rem 0;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--opz-border);
}

.item-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.item {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  background: var(--opz-bg-soft);
  border: 1px solid var(--opz-border);
}

.item-name {
  font-size: 0.875rem;
}

.item-extra {
  font-size: 0.75rem;
  color: var(--opz-text-secondary);
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--opz-text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.remove-btn:hover {
  background: var(--opz-danger);
  color: white;
}
</style>
