<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NSpin } from 'naive-ui';
import type { Channel, Tag } from '@opz-hub/shared';
import { useMetadataStore } from '@/stores/metadata';
import ActionChip from '@/components/common/ActionChip.vue';

const props = defineProps<{
  channel: Channel;
  isFollowed: boolean;
  followedTagIds: Set<string>;
  blockedTagNames?: Set<string>;
  defaultExpanded?: boolean;
}>();

const emit = defineEmits<{
  'toggle-channel': [channelId: string];
  'toggle-tag': [tagId: string, tagName: string];
  'block-tag': [tagName: string];
  'unblock-tag': [tagId: string, tagName: string];
}>();

const metadataStore = useMetadataStore();

const isExpanded = ref(props.defaultExpanded ?? false);
const tags = ref<Tag[]>([]);
const isLoading = ref(false);
const hasLoaded = ref(false);

// 该频道被屏蔽的标签
const channelBlockedTags = computed(() => {
  if (!props.blockedTagNames?.size) return [];
  return tags.value.filter((t) => props.blockedTagNames!.has(t.name));
});

// 可见标签（排除已屏蔽，保持原始顺序）
const visibleTags = computed(() => {
  if (!tags.value) return [];
  return tags.value.filter((t) => !props.blockedTagNames?.has(t.name));
});

// 已关注标签数量
const followedTagCount = computed(() => {
  if (!visibleTags.value || !props.followedTagIds) return 0;
  return visibleTags.value.filter((t) => props.followedTagIds.has(t.id)).length;
});

// 是否有任何已关注的内容
const hasFollowedContent = computed(() => followedTagCount.value > 0);

// 获取标签的 variant
function getTagVariant(tag: Tag): 'default' | 'active' {
  return props.followedTagIds.has(tag.id) ? 'active' : 'default';
}

// 懒加载频道数据
async function loadChannelData() {
  if (hasLoaded.value || isLoading.value) return;

  isLoading.value = true;
  try {
    const channelTags = await metadataStore.getChannelTags(props.channel.id);
    tags.value = channelTags.sort((a, b) => b.usageCount - a.usageCount);
    hasLoaded.value = true;
  } catch (error) {
    console.error('[ChannelCard] Failed to load channel data:', error);
  } finally {
    isLoading.value = false;
  }
}

// 展开时加载数据
watch(isExpanded, (expanded) => {
  if (expanded) {
    loadChannelData();
  }
});

// 默认展开时立即加载
if (props.defaultExpanded) {
  loadChannelData();
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}

function handleToggleChannel() {
  emit('toggle-channel', props.channel.id);
}

function handleToggleTag(tag: Tag) {
  emit('toggle-tag', tag.id, tag.name);
}
</script>

<template>
  <div class="channel-card" :class="{ followed: isFollowed, expanded: isExpanded }">
    <!-- 卡片头部 -->
    <div class="card-header">
      <button type="button" class="follow-toggle" @click="handleToggleChannel">
        <span class="follow-icon" :class="{ active: isFollowed }">
          <svg v-if="isFollowed" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4a.75.75 0 01.75.75v2.5h2.5a.75.75 0 010 1.5h-2.5v2.5a.75.75 0 01-1.5 0v-2.5h-2.5a.75.75 0 010-1.5h2.5v-2.5A.75.75 0 018 4z" />
          </svg>
        </span>
      </button>
      <button type="button" class="channel-info" @click="toggleExpand">
        <span class="channel-name">{{ channel.name }}</span>
        <span v-if="hasFollowedContent && !isExpanded" class="followed-hint">
          {{ followedTagCount }} 个标签已关注
        </span>
      </button>
      <button type="button" class="expand-toggle" @click="toggleExpand">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          class="expand-icon"
          :class="{ expanded: isExpanded }"
        >
          <path d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" />
        </svg>
      </button>
    </div>

    <!-- 展开内容 -->
    <div v-if="isExpanded" class="card-content">
      <div v-if="isLoading" class="loading-container">
        <NSpin size="small" />
      </div>
      <template v-else>
        <!-- 标签区域 -->
        <section v-if="tags.length > 0" class="content-section">
          <div class="section-header">
            <h4 class="section-label">标签</h4>
            <span class="section-count">{{ followedTagCount }}/{{ visibleTags.length }}</span>
          </div>
          <div class="chip-grid">
            <ActionChip
              v-for="tag in visibleTags"
              :key="tag.id"
              :label="tag.name"
              :variant="getTagVariant(tag)"
              action-title="屏蔽"
              @click="handleToggleTag(tag)"
              @action="emit('block-tag', tag.name)"
            />
          </div>
          <template v-if="channelBlockedTags.length > 0">
            <div class="blocked-divider">
              <span class="blocked-label">已屏蔽</span>
            </div>
            <div class="chip-grid">
              <ActionChip
                v-for="tag in channelBlockedTags"
                :key="tag.id"
                :label="tag.name"
                variant="blocked"
                action-title="取消屏蔽"
                @click="emit('unblock-tag', tag.id, tag.name)"
                @action="emit('unblock-tag', tag.id, tag.name)"
              />
            </div>
          </template>
        </section>

        <!-- 空状态 -->
        <div v-if="tags.length === 0" class="empty-state">
          暂无可关注的标签
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.channel-card {
  border: 1px solid var(--opz-border);
  border-radius: 12px;
  background: transparent;
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.channel-card.followed {
  border-color: var(--opz-primary);
}

.channel-card.expanded {
  border-color: var(--opz-primary);
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
}

.follow-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1.5px solid var(--opz-border);
  background: transparent;
  color: var(--opz-text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.follow-toggle:hover {
  border-color: var(--opz-primary);
  color: var(--opz-primary);
}

.follow-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.follow-icon.active {
  color: var(--opz-primary);
}

.follow-toggle:has(.follow-icon.active) {
  border-color: var(--opz-primary);
  background: color-mix(in srgb, var(--opz-primary) 10%, transparent);
}

.channel-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.channel-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.followed-hint {
  font-size: 0.75rem;
  color: var(--opz-text-tertiary);
}

.expand-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--opz-text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.expand-toggle:hover {
  background: var(--opz-bg-elevated);
  color: var(--opz-text-primary);
}

.expand-icon {
  transition: transform 0.2s ease;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

/* 卡片内容 */
.card-content {
  padding: 1rem;
  border-top: 1px solid var(--opz-border);
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 1.5rem;
}

/* 内容分区 */
.content-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.section-label {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--opz-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.section-count {
  font-size: 0.75rem;
  color: var(--opz-text-tertiary);
}

/* Chip 网格 */
.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

/* 屏蔽分割线 */
.blocked-divider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  margin-bottom: 0.25rem;
}

.blocked-divider::before,
.blocked-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--opz-border);
}

.blocked-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--opz-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 1.5rem;
  color: var(--opz-text-tertiary);
  font-size: 0.875rem;
}
</style>
