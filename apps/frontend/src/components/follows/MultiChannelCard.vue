<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NSpin } from 'naive-ui';
import type { Tag, WordMeta } from '@opz-hub/shared';
import { useMetadataStore } from '@/stores/metadata';
import ActionChip from '@/components/common/ActionChip.vue';

const KEYWORD_INITIAL_LIMIT = 40;
const KEYWORD_EXPAND_STEP = 40;
const KEYWORD_POOL_LIMIT = 200;

const props = defineProps<{
  channelIds: string[];
  followedTagIds: Set<string>;
  followedKeywords: Set<string>;
  blockedTags?: string[];
  blockedKeywords?: string[];
  defaultExpanded?: boolean;
}>();

const emit = defineEmits<{
  'toggle-tag': [tagId: string, tagName: string];
  'toggle-keyword': [keyword: string];
  'block-tag': [tagName: string];
  'block-keyword': [keyword: string];
  'unblock-tag': [tagName: string];
  'unblock-keyword': [keyword: string];
}>();

const metadataStore = useMetadataStore();

const isExpanded = ref(props.defaultExpanded ?? false);
const isLoading = ref(false);
const hasLoaded = ref(false);

// 多频道通用标签（出现在2个以上频道的标签）
const multiChannelTags = ref<Tag[]>([]);
// 多频道通用热词（全部）
const allKeywords = ref<string[]>([]);
// 热词显示数量限制
const keywordDisplayLimit = ref(KEYWORD_INITIAL_LIMIT);

// 可见的热词
const visibleKeywords = computed(() => allKeywords.value.slice(0, keywordDisplayLimit.value));

// 是否可以展开更多热词
const canExpandKeywords = computed(() => keywordDisplayLimit.value < allKeywords.value.length);

// 屏蔽标签名 Set（小写）
const blockedTagNamesLower = computed(() => new Set(props.blockedTags?.map((t) => t.toLowerCase()) ?? []));

// 屏蔽热词 Set
const blockedKeywordsSet = computed(() => new Set(props.blockedKeywords ?? []));

// 可见标签（排除已屏蔽，保持原始顺序）
const visibleTags = computed(() => {
  if (!multiChannelTags.value) return [];
  return multiChannelTags.value.filter(
    (t) => !blockedTagNamesLower.value.has(t.name.toLowerCase())
  );
});

// 已关注标签数量
const followedTagCount = computed(() => {
  if (!visibleTags.value || !props.followedTagIds) return 0;
  return visibleTags.value.filter((t) => props.followedTagIds.has(t.id)).length;
});

// 可见热词（排除已屏蔽，保持原始顺序）
const visibleAvailableKeywords = computed(() => {
  if (!visibleKeywords.value) return [];
  return visibleKeywords.value.filter((kw) => !blockedKeywordsSet.value.has(kw));
});

// 获取标签的 variant
function getTagVariant(tag: Tag): 'default' | 'active' {
  return props.followedTagIds?.has(tag.id) ? 'active' : 'default';
}

// 获取热词的 variant
function getKeywordVariant(keyword: string): 'default' | 'active' {
  return props.followedKeywords?.has(keyword) ? 'active' : 'default';
}

// 全部热词中已关注的数量
const totalFollowedKeywordsCount = computed(() => {
  if (!allKeywords.value || !props.followedKeywords) return 0;
  return allKeywords.value.filter((kw) => props.followedKeywords.has(kw)).length;
});

// 是否有任何已关注的内容
const hasFollowedContent = computed(() => followedTagCount.value > 0 || totalFollowedKeywordsCount.value > 0);

// 是否有内容可展示
const hasContent = computed(() => multiChannelTags.value.length > 0 || allKeywords.value.length > 0);

// 屏蔽的多频道通用标签（只显示在多频道标签列表中也存在的）
const blockedMultiChannelTags = computed(() => {
  if (!props.blockedTags?.length) return [];
  const multiTagNames = new Set(multiChannelTags.value.map((t) => t.name.toLowerCase()));
  return props.blockedTags.filter((tag) => multiTagNames.has(tag.toLowerCase()));
});

// 加载多频道数据
async function loadMultiChannelData() {
  if (hasLoaded.value || isLoading.value || props.channelIds.length === 0) return;

  isLoading.value = true;
  try {
    // 获取所有频道的标签
    const allTags = await metadataStore.getMultipleChannelTags(props.channelIds);

    // 按标签名聚合，记录每个标签所属的频道
    const tagByName = new Map<string, { tag: Tag; channelIds: Set<string> }>();
    for (const tag of allTags) {
      const key = tag.name.toLowerCase();
      const existing = tagByName.get(key);
      if (existing) {
        existing.channelIds.add(tag.channelId);
        // 保留使用次数最高的版本
        if (tag.usageCount > existing.tag.usageCount) {
          existing.tag = tag;
        }
      } else {
        tagByName.set(key, { tag, channelIds: new Set([tag.channelId]) });
      }
    }

    // 筛选出现在多个频道的标签
    const multiTags: Tag[] = [];
    for (const { tag, channelIds } of tagByName.values()) {
      if (channelIds.size > 1) {
        multiTags.push(tag);
      }
    }

    // 按使用次数排序
    multiTags.sort((a, b) => b.usageCount - a.usageCount);
    multiChannelTags.value = multiTags;

    // 获取全局热词（热词本身就是跨频道的）
    const wordMeta = await metadataStore.getGlobalWordMeta();
    allKeywords.value = wordMeta
      .filter((item: WordMeta) => item.type === 'keyword')
      .map((item: WordMeta) => item.word)
      .slice(0, KEYWORD_POOL_LIMIT);

    // 重置热词显示限制
    keywordDisplayLimit.value = KEYWORD_INITIAL_LIMIT;

    hasLoaded.value = true;
  } catch (error) {
    console.error('[MultiChannelCard] Failed to load data:', error);
  } finally {
    isLoading.value = false;
  }
}

// 监听频道变化，重新加载数据
watch(
  () => props.channelIds,
  () => {
    hasLoaded.value = false;
    if (isExpanded.value) {
      loadMultiChannelData();
    }
  },
  { deep: true }
);

// 展开时加载数据
watch(isExpanded, (expanded) => {
  if (expanded) {
    loadMultiChannelData();
  }
});

// 默认展开时立即加载
if (props.defaultExpanded) {
  loadMultiChannelData();
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}

function expandKeywordPool() {
  if (!canExpandKeywords.value) return;
  keywordDisplayLimit.value = Math.min(allKeywords.value.length, keywordDisplayLimit.value + KEYWORD_EXPAND_STEP);
}

function handleToggleTag(tag: Tag) {
  emit('toggle-tag', tag.id, tag.name);
}

function handleToggleKeyword(keyword: string) {
  emit('toggle-keyword', keyword);
}
</script>

<template>
  <div class="multi-channel-card" :class="{ expanded: isExpanded }">
    <!-- 卡片头部 -->
    <div class="card-header">
      <button type="button" class="channel-info" @click="toggleExpand">
        <span class="channel-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
            />
          </svg>
        </span>
        <span class="channel-name">多频道通用</span>
        <span v-if="hasFollowedContent && !isExpanded" class="followed-hint">
          {{ followedTagCount + totalFollowedKeywordsCount }} 项已关注
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
          <path
            d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z"
          />
        </svg>
      </button>
    </div>

    <!-- 展开内容 -->
    <div v-if="isExpanded" class="card-content">
      <div v-if="isLoading" class="loading-container">
        <NSpin size="small" />
      </div>
      <template v-else-if="hasContent">
        <!-- 标签区域 -->
        <section v-if="multiChannelTags.length > 0" class="content-section">
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
          <template v-if="blockedMultiChannelTags.length > 0">
            <div class="blocked-divider">
              <span class="blocked-label">已屏蔽</span>
            </div>
            <div class="chip-grid">
              <ActionChip
                v-for="tagName in blockedMultiChannelTags"
                :key="tagName"
                :label="tagName"
                variant="blocked"
                action-title="取消屏蔽"
                @click="emit('unblock-tag', tagName)"
                @action="emit('unblock-tag', tagName)"
              />
            </div>
          </template>
        </section>

        <!-- 热词区域 -->
        <section v-if="allKeywords.length > 0 || (blockedKeywords?.length ?? 0) > 0" class="content-section">
          <div class="section-header">
            <h4 class="section-label">热词</h4>
            <span v-if="allKeywords.length > 0" class="section-count"
              >{{ totalFollowedKeywordsCount }}/{{ allKeywords.length }}</span
            >
          </div>
          <div v-if="allKeywords.length > 0" class="chip-grid">
            <ActionChip
              v-for="kw in visibleAvailableKeywords"
              :key="kw"
              :label="kw"
              :variant="getKeywordVariant(kw)"
              action-title="屏蔽"
              @click="handleToggleKeyword(kw)"
              @action="emit('block-keyword', kw)"
            />
          </div>
          <button v-if="canExpandKeywords" type="button" class="expand-more-btn" @click="expandKeywordPool">
            展开更多热词 ({{ allKeywords.length - keywordDisplayLimit }} 个)
          </button>
          <template v-if="blockedKeywords?.length">
            <div class="blocked-divider">
              <span class="blocked-label">已屏蔽</span>
            </div>
            <div class="chip-grid">
              <ActionChip
                v-for="kw in blockedKeywords"
                :key="kw"
                :label="kw"
                variant="blocked"
                action-title="取消屏蔽"
                @click="emit('unblock-keyword', kw)"
                @action="emit('unblock-keyword', kw)"
              />
            </div>
          </template>
        </section>
      </template>
      <div v-else class="empty-state">暂无多频道通用的标签和热词</div>
    </div>
  </div>
</template>

<style scoped>
.multi-channel-card {
  border: 1px solid var(--opz-border);
  border-radius: 12px;
  background: transparent;
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.multi-channel-card.expanded {
  border-color: var(--opz-primary);
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
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

.channel-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--opz-primary) 15%, transparent);
  color: var(--opz-primary);
  flex-shrink: 0;
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

.content-section + .content-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--opz-border);
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

/* 展开更多按钮 */
.expand-more-btn {
  align-self: center;
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--opz-border);
  border-radius: 6px;
  background: transparent;
  color: var(--opz-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.expand-more-btn:hover {
  border-color: var(--opz-primary);
  color: var(--opz-primary);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 1.5rem;
  color: var(--opz-text-tertiary);
  font-size: 0.875rem;
}
</style>
