<script setup lang="ts">
import type { AuthorAutocompleteItem } from '@opz-hub/shared';
import type { SearchFilters, SearchMode } from '@/types/search';
import SearchBar from '@/components/search/SearchBar.vue';
import SearchSuggestions from '@/components/search/SearchSuggestions.vue';
import SearchIcon from '@/assets/icons/search.svg?raw';
import CloseIcon from '@/assets/icons/close.svg?raw';

const props = defineProps<{
  show: boolean;
  filters: SearchFilters;
  searchMode?: SearchMode;
  suggestions: string[];
  suggestionsLoading?: boolean;
  history?: string[];
  authors?: AuthorAutocompleteItem[];
  authorsLoading?: boolean;
}>();

const emit = defineEmits<{
  'update:show': [boolean];
  'update:searchMode': [SearchMode];
  submit: [];
  change: [Partial<SearchFilters>];
  selectSuggestion: [keyword: string];
  removeHistory: [keyword: string];
  clearHistory: [];
  selectAuthor: [author: AuthorAutocompleteItem];
  searchAuthorPosts: [author: AuthorAutocompleteItem];
}>();

function closeDrawer() {
  emit('update:show', false);
}

function handleSubmit() {
  emit('submit');
}

function handleChange(partial: Partial<SearchFilters>) {
  emit('change', partial);
}

function handleSelect(keyword: string) {
  emit('selectSuggestion', keyword);
}
</script>

<template>
  <n-drawer
    :show="props.show"
    placement="right"
    :width="'100%'"
    :auto-focus="false"
    @update:show="emit('update:show', $event)"
  >
    <n-drawer-content :body-content-style="{ padding: 0 }">
      <!-- 头部 -->
      <div class="drawer-header">
        <div class="header-icon" v-html="SearchIcon"></div>
        <h3 class="header-title">搜索</h3>
        <button class="close-btn" @click="closeDrawer" v-html="CloseIcon"></button>
      </div>

      <!-- 搜索区域 -->
      <div class="drawer-body">
        <SearchBar
          :model-value="props.filters.q"
          :search-mode="props.searchMode"
          input-id="mobile-search"
          @update:modelValue="(value) => handleChange({ q: value })"
          @update:searchMode="emit('update:searchMode', $event)"
          @submit="handleSubmit"
        />
        <SearchSuggestions
          :search-mode="props.searchMode"
          :suggestions="props.suggestions"
          :loading="props.suggestionsLoading"
          :history="props.history"
          :authors="props.authors"
          :authors-loading="props.authorsLoading"
          @select="handleSelect"
          @removeHistory="emit('removeHistory', $event)"
          @clearHistory="emit('clearHistory')"
          @selectAuthor="emit('selectAuthor', $event)"
          @searchAuthorPosts="emit('searchAuthorPosts', $event)"
        />
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--opz-border);
  background: var(--opz-bg-soft);
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--opz-radius-md);
  background: var(--opz-primary);
  color: white;
}

.header-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.header-title {
  flex: 1;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--opz-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--opz-bg-mute);
  color: var(--opz-text-primary);
}

.close-btn :deep(svg) {
  width: 20px;
  height: 20px;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 1.25rem;
}
</style>
