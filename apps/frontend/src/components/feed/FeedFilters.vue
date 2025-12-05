<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { NPopover, NSwitch, NSpin } from 'naive-ui';
import { useMetadataStore } from '@/stores/metadata';
import { useFollowsStore } from '@/stores/follows';
import type { Channel } from '@opz-hub/shared';

const props = defineProps<{
  selectedChannels: string[];
  includeInvalid: boolean;
  // 默认模式：'all' = 全部频道，'followed' = 已关注频道
  defaultMode?: 'all' | 'followed';
  // 加载状态
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:selectedChannels': [channels: string[]];
  'update:includeInvalid': [value: boolean];
}>();

const metadataStore = useMetadataStore();
const followsStore = useFollowsStore();

const showPopover = ref(false);

// 本地状态：乐观更新，立即响应用户操作
const localChannels = ref<string[]>([...props.selectedChannels]);
const localIncludeInvalid = ref(props.includeInvalid);

// 同步外部 props 到本地状态
watch(
  () => props.selectedChannels,
  (val) => {
    localChannels.value = [...val];
  }
);

watch(
  () => props.includeInvalid,
  (val) => {
    localIncludeInvalid.value = val;
  }
);

onMounted(async () => {
  await Promise.all([metadataStore.getChannels(), followsStore.loadChannelFollows()]);
});

const allChannels = computed<Channel[]>(() => metadataStore.cachedChannels || []);

// 关注的频道
const followedChannels = computed<Channel[]>(() => {
  const followedIds = followsStore.followedChannelIds;
  return allChannels.value.filter((c) => followedIds.has(c.id));
});

// 未关注的频道
const unfollowedChannels = computed<Channel[]>(() => {
  const followedIds = followsStore.followedChannelIds;
  return allChannels.value.filter((c) => !followedIds.has(c.id));
});

// 判断是否处于"仅关注"状态
const isFollowedMode = computed(() => {
  const followedIds = followsStore.followedChannelIds;
  if (localChannels.value.length !== followedIds.size || followedIds.size === 0) return false;
  return localChannels.value.every((id) => followedIds.has(id));
});

// 当处于"已关注"模式时，自动同步关注列表变化
watch(
  () => followsStore.followedChannelIds,
  (newFollowedIds) => {
    if (!isFollowedMode.value) return;
    // 关注列表变化，自动更新筛选条件
    const newChannels = Array.from(newFollowedIds);
    if (newChannels.length > 0) {
      updateChannels(newChannels);
    }
  },
  { deep: true }
);

// 筛选按钮显示文字
const filterLabel = computed(() => {
  if (localChannels.value.length === 0) return '全部频道';
  if (isFollowedMode.value) return '已关注';
  if (localChannels.value.length === 1) {
    const channel = allChannels.value.find((c) => c.id === localChannels.value[0]);
    return channel?.name || '1 个频道';
  }
  return `${localChannels.value.length} 个频道`;
});

// 是否偏离默认状态（用于按钮变色提示）
const hasActiveFilters = computed(() => {
  // includeInvalid 默认为 false，开启即偏离
  if (localIncludeInvalid.value) return true;

  const defaultMode = props.defaultMode ?? 'all';
  const followedIds = followsStore.followedChannelIds;

  if (defaultMode === 'all') {
    // 默认全部，选了任何频道即偏离
    return localChannels.value.length > 0;
  } else {
    // 默认已关注
    // 如果没有关注频道，默认等同于"全部"，选了频道才算偏离
    if (followedIds.size === 0) {
      return localChannels.value.length > 0;
    }
    // 不在已关注状态即偏离（选了"全部"或自定义频道）
    return !isFollowedMode.value;
  }
});

// 乐观更新：先更新本地状态，再 emit，然后关闭 popover
function updateChannels(channels: string[]) {
  localChannels.value = channels;
  emit('update:selectedChannels', channels);
  showPopover.value = false;
}

function handleChannelClick(channelId: string) {
  // 如果当前是"全部"或"已关注"状态，点击频道切换为只选中那一个
  if (localChannels.value.length === 0 || isFollowedMode.value) {
    updateChannels([channelId]);
    return;
  }

  // 自定义模式：切换逻辑
  const current = [...localChannels.value];
  const index = current.indexOf(channelId);
  if (index === -1) {
    current.push(channelId);
  } else {
    current.splice(index, 1);
  }
  updateChannels(current);
}

function selectAll() {
  updateChannels([]);
}

function selectFollowed() {
  updateChannels(Array.from(followsStore.followedChannelIds));
}

function handleIncludeInvalidChange(value: boolean) {
  localIncludeInvalid.value = value;
  emit('update:includeInvalid', value);
}
</script>

<template>
  <NPopover v-model:show="showPopover" trigger="click" placement="bottom-start" :show-arrow="false" raw>
    <template #trigger>
      <button type="button" class="filter-btn" :class="{ active: hasActiveFilters, loading: props.loading }">
        <NSpin v-if="props.loading" :size="14" />
        <svg v-else class="filter-icon" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span class="filter-label">{{ filterLabel }}</span>
      </button>
    </template>

    <div class="filter-dropdown">
      <!-- 快捷选项 -->
      <div class="quick-actions">
        <button type="button" class="quick-btn" :class="{ active: localChannels.length === 0 }" @click="selectAll">
          全部
        </button>
        <button
          type="button"
          class="quick-btn"
          :class="{ active: isFollowedMode }"
          :disabled="followedChannels.length === 0"
          @click="selectFollowed"
        >
          已关注
        </button>
      </div>

      <div class="divider" />

      <!-- 关注的频道 -->
      <div v-if="followedChannels.length > 0" class="channel-section">
        <div class="section-title">关注频道</div>
        <div class="channel-grid">
          <button
            v-for="channel in followedChannels"
            :key="channel.id"
            type="button"
            class="channel-chip"
            :class="{ selected: localChannels.includes(channel.id) }"
            @click="handleChannelClick(channel.id)"
          >
            {{ channel.name }}
          </button>
        </div>
      </div>

      <!-- 未关注的频道 -->
      <div v-if="unfollowedChannels.length > 0" class="channel-section">
        <div class="section-title">其他频道</div>
        <div class="channel-grid">
          <button
            v-for="channel in unfollowedChannels"
            :key="channel.id"
            type="button"
            class="channel-chip"
            :class="{ selected: localChannels.includes(channel.id) }"
            @click="handleChannelClick(channel.id)"
          >
            {{ channel.name }}
          </button>
        </div>
      </div>

      <div class="divider" />

      <!-- 显示无效帖子开关 -->
      <div class="option-row">
        <span class="option-label">显示锁定和无数据作品</span>
        <NSwitch :value="localIncludeInvalid" size="small" @update:value="handleIncludeInvalidChange" />
      </div>
    </div>
  </NPopover>
</template>

<style scoped>
.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--opz-border);
  border-radius: 10px;
  background: var(--opz-bg-soft);
  color: var(--opz-text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-btn:hover {
  background: var(--opz-bg-mute);
}

.filter-btn.active {
  background: var(--opz-primary);
  border-color: var(--opz-primary);
  color: white;
}

.filter-icon {
  width: 14px;
  height: 14px;
  opacity: 0.7;
}

.filter-btn.active .filter-icon {
  opacity: 1;
}

.filter-btn.loading {
  pointer-events: none;
}

.filter-label {
  white-space: nowrap;
}

.filter-dropdown {
  min-width: 280px;
  max-width: 360px;
  padding: 12px;
  background: var(--opz-bg-base);
  border: 1px solid var(--opz-border);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.quick-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.quick-btn {
  flex: 1;
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

.quick-btn:hover {
  background: var(--opz-bg-soft);
}

.quick-btn.active {
  background: var(--opz-primary);
  border-color: var(--opz-primary);
  color: white;
}

.quick-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.divider {
  height: 1px;
  margin: 12px 0;
  background: var(--opz-border);
}

.channel-section {
  margin-bottom: 8px;
}

.section-title {
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--opz-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.channel-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.channel-chip {
  padding: 6px 12px;
  border: 1px solid var(--opz-border);
  border-radius: 999px;
  background: transparent;
  color: var(--opz-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.channel-chip:hover {
  background: var(--opz-bg-soft);
  border-color: var(--opz-text-tertiary);
}

.channel-chip.selected {
  background: var(--opz-primary);
  border-color: var(--opz-primary);
  color: white;
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.option-label {
  font-size: 13px;
  color: var(--opz-text-primary);
}

/* 暗色主题 */
:root[data-theme='dark'] .filter-btn {
  background: var(--opz-bg-soft);
  border-color: var(--opz-border);
}

:root[data-theme='dark'] .filter-btn:hover {
  background: var(--opz-bg-mute);
}

:root[data-theme='dark'] .filter-dropdown {
  background: var(--opz-bg-elevated);
  border-color: var(--opz-border);
}

:root[data-theme='dark'] .quick-btn {
  border-color: var(--opz-border);
}

:root[data-theme='dark'] .quick-btn:hover {
  background: var(--opz-bg-mute);
}

:root[data-theme='dark'] .channel-chip {
  border-color: var(--opz-border);
}

:root[data-theme='dark'] .channel-chip:hover {
  background: var(--opz-bg-mute);
}

/* 移动端 */
@media (max-width: 640px) {
  .filter-label {
    display: none;
  }

  .filter-btn {
    padding: 0 10px;
  }

  .filter-dropdown {
    min-width: 260px;
  }
}
</style>
