<script setup lang="ts">
import { ref } from 'vue';
import ActionChip from '@/components/common/ActionChip.vue';

const props = defineProps<{
  blockedTags: string[];
  blockedKeywords: string[];
  customKeywords: string[];
  channelId: string;
}>();

const emit = defineEmits<{
  unblockTag: [{ channelId: string; tag: string }];
  unblockKeyword: [{ channelId: string; keyword: string }];
  removeCustomKeyword: [{ channelId: string; keyword: string }];
  addCustomKeyword: [{ channelId: string; keyword: string }];
}>();

const showBlockedSection = ref(false);
const newKeywordInput = ref('');

function handleAddKeyword() {
  const keyword = newKeywordInput.value.trim();
  if (!keyword) return;
  emit('addCustomKeyword', { channelId: props.channelId, keyword });
  newKeywordInput.value = '';
}
</script>

<template>
  <div class="filter-card collapsible">
    <button class="collapse-header" type="button" @click="showBlockedSection = !showBlockedSection">
      <span>已屏蔽内容 ({{ blockedTags.length + blockedKeywords.length + customKeywords.length }})</span>
      <span class="collapse-icon" :class="{ expanded: showBlockedSection }">▼</span>
    </button>
    <transition name="collapse">
      <div v-show="showBlockedSection" class="collapse-content">
        <div v-if="blockedTags.length" class="blocked-group">
          <p class="group-label">标签</p>
          <div class="chip-row">
            <ActionChip
              v-for="tag in blockedTags"
              :key="`blocked-${tag}`"
              :label="tag"
              variant="blocked"
              action-title="取消屏蔽"
              @click="emit('unblockTag', { channelId, tag })"
              @action="emit('unblockTag', { channelId, tag })"
            />
          </div>
        </div>
        <div v-if="blockedKeywords.length || customKeywords.length" class="blocked-group">
          <p class="group-label">关键词</p>
          <div class="chip-row">
            <ActionChip
              v-for="keyword in blockedKeywords"
              :key="`blocked-kw-${keyword}`"
              :label="keyword"
              variant="blocked"
              action-title="取消屏蔽"
              @click="emit('unblockKeyword', { channelId, keyword })"
              @action="emit('unblockKeyword', { channelId, keyword })"
            />
            <ActionChip
              v-for="keyword in customKeywords"
              :key="`custom-kw-${keyword}`"
              :label="keyword"
              variant="blocked"
              action-title="移除"
              @click="emit('removeCustomKeyword', { channelId, keyword })"
              @action="emit('removeCustomKeyword', { channelId, keyword })"
            />
          </div>
        </div>
        <div class="add-keyword">
          <input
            v-model="newKeywordInput"
            type="text"
            placeholder="添加自定义关键词..."
            @keyup.enter="handleAddKeyword"
          />
          <button type="button" @click="handleAddKeyword">添加</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.filter-card {
  border: 1px solid var(--opz-border);
  border-radius: 16px;
}

.filter-card.collapsible {
  padding: 0;
}

.collapse-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  font-weight: 600;
  color: var(--opz-text-primary);
  text-align: left;
  transition: background 0.2s;
}

.collapse-header:hover {
  background: rgba(148, 163, 184, 0.05);
}

.collapse-icon {
  font-size: 0.7rem;
  transition: transform 0.2s;
}

.collapse-icon.expanded {
  transform: rotate(180deg);
}

.collapse-content {
  padding: 0 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.blocked-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.group-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--opz-text-muted);
  margin: 0;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.add-keyword {
  display: flex;
  gap: 0.5rem;
}

.add-keyword input {
  flex: 1;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--opz-border);
  border-radius: 8px;
  background: var(--opz-bg-base);
  color: var(--opz-text-primary);
  font-size: 0.875rem;
}

.add-keyword button {
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: var(--opz-primary);
  color: white;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.2s;
}

.add-keyword button:hover {
  background: color-mix(in srgb, var(--opz-primary) 85%, black);
}

/* 折叠动画 */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
