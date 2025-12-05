<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { AuthorAutocompleteItem, Channel } from '@opz-hub/shared';
import type { SearchMode } from '@/types/search';
import ChipButton from '@/components/common/ChipButton.vue';
import WorkgroupNotice from './WorkgroupNotice.vue';
import AuthorAutocompleteCard from './AuthorAutocompleteCard.vue';
import { useSearchStore } from '@/stores/search';
import { useMetadataStore } from '@/stores/metadata';

const props = defineProps<{
  searchMode?: SearchMode;
  suggestions?: string[];
  loading?: boolean;
  history?: string[];
  authors?: AuthorAutocompleteItem[];
  authorsLoading?: boolean;
}>();

const emit = defineEmits<{
  select: [keyword: string];
  removeHistory: [keyword: string];
  clearHistory: [];
  selectAuthor: [author: AuthorAutocompleteItem];
  searchAuthorPosts: [author: AuthorAutocompleteItem];
}>();

const searchStore = useSearchStore();
const metadataStore = useMetadataStore();

const isAuthorMode = computed(() => props.searchMode === 'authors');

// 频道列表
const channels = computed<Channel[]>(() => metadataStore.cachedChannels || []);
const loadingChannels = ref(false);
const selectedChannel = computed(() => searchStore.filters.category);
const channelExpanded = ref(true);
// const hotSearchExpanded = ref(false);

// 当前选中的频道名称
const selectedChannelName = computed(() => {
  if (!selectedChannel.value) return '全部';
  return channels.value.find((c) => c.id === selectedChannel.value)?.name || '全部';
});

// 加载频道数据
onMounted(async () => {
  if (!metadataStore.cachedChannels) {
    loadingChannels.value = true;
    try {
      await metadataStore.getChannels();
    } finally {
      loadingChannels.value = false;
    }
  }
});

// 处理频道选择
function handleChannelSelect(channelId: string | null) {
  searchStore.patch({ category: channelId ?? undefined });
}

function handleSelect(keyword: string) {
  emit('select', keyword);
}

function handleRemoveHistory(keyword: string, event: Event) {
  event.stopPropagation();
  emit('removeHistory', keyword);
}

function handleClearHistory() {
  emit('clearHistory');
}

function handleAuthorClick(author: AuthorAutocompleteItem) {
  emit('selectAuthor', author);
}

function handleSearchAuthorPosts(author: AuthorAutocompleteItem) {
  emit('searchAuthorPosts', author);
}
</script>

<template>
  <section class="search-suggestions">
    <!-- 作者模式：显示作者补全结果 -->
    <template v-if="isAuthorMode">
      <div class="section">
        <div class="header">
          <p class="title">作者搜索结果</p>
        </div>
        <div v-if="authorsLoading" class="author-grid">
          <div v-for="i in 3" :key="i" class="author-skeleton" />
        </div>
        <div v-else-if="!authors?.length" class="empty">输入关键词搜索作者</div>
        <div v-else class="author-grid">
          <AuthorAutocompleteCard
            v-for="author in authors"
            :key="author.id"
            :author="author"
            @click="handleAuthorClick(author)"
            @search-posts="handleSearchAuthorPosts(author)"
          />
        </div>
      </div>
    </template>

    <!-- 作品模式 -->
    <template v-else>
      <!-- 频道筛选（默认展开） -->
      <div class="section">
        <button type="button" class="header clickable" @click="channelExpanded = !channelExpanded">
          <p class="title">频道</p>
          <span class="collapse-info">
            {{ selectedChannelName }}
            <svg class="expand-icon" :class="{ expanded: channelExpanded }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>
        <template v-if="channelExpanded">
          <div v-if="loadingChannels" class="chip-row">
            <ChipButton size="small" variant="skeleton" width="3rem" />
            <ChipButton size="small" variant="skeleton" width="4rem" />
            <ChipButton size="small" variant="skeleton" width="3.5rem" />
          </div>
          <div v-else class="chip-row">
            <ChipButton size="small" :active="!selectedChannel" @click="handleChannelSelect(null)">
              全部
            </ChipButton>
            <ChipButton
              v-for="channel in channels"
              :key="channel.id"
              size="small"
              :active="selectedChannel === channel.id"
              @click="handleChannelSelect(channel.id)"
            >
              {{ channel.name }}
            </ChipButton>
          </div>
        </template>
      </div>

      <!-- 搜索历史 -->
      <div v-if="props.history?.length" class="section">
        <div class="header">
          <p class="title">搜索历史</p>
          <button type="button" class="clear-btn" @click="handleClearHistory">清空</button>
        </div>
        <div class="chip-row">
          <ChipButton
            v-for="keyword in props.history"
            :key="keyword"
            size="small"
            variant="closable"
            @click="handleSelect(keyword)"
            @close="handleRemoveHistory(keyword, $event)"
          >
            {{ keyword }}
          </ChipButton>
        </div>
      </div>

      <!-- TODO: 大家在搜（暂时隐藏） -->
    </template>

    <!-- 工作组提示（两种模式都显示） -->
    <WorkgroupNotice />
  </section>
</template>

<style scoped>
.search-suggestions {
  display: flex;
  flex-direction: column;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 0;
  border-top: 1px solid var(--opz-border);
}

.section:first-child {
  padding-top: 0;
  border-top: none;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header.clickable {
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.header.clickable:hover .title {
  color: var(--opz-text-primary);
}

.collapse-info {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--opz-text-secondary);
}

.expand-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.2s ease;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.title {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--opz-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  transition: color 0.15s ease;
}

.clear-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  color: var(--opz-text-secondary);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-btn:hover {
  background: var(--opz-primary-soft, rgba(74, 144, 226, 0.15));
  border-color: var(--opz-primary);
  color: var(--opz-primary);
}

:root[data-theme='dark'] .clear-btn {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

:root[data-theme='dark'] .clear-btn:hover {
  background: var(--opz-primary-soft, rgba(74, 144, 226, 0.2));
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.author-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.author-skeleton {
  height: 56px;
  background: var(--opz-bg-soft);
  border-radius: 10px;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}

.empty {
  color: var(--opz-text-muted);
  font-size: 0.8125rem;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .author-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .section {
    padding: 0.875rem 0;
    gap: 0.4rem;
  }

  .chip-row {
    gap: 0.4rem;
  }

  .clear-btn {
    padding: 3px 8px;
    font-size: 0.65rem;
  }
}
</style>
