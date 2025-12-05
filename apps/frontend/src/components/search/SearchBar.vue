<script setup lang="ts">
import { computed, ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import type { SearchMode } from '@/types/search';

const props = defineProps<{
  modelValue: string;
  searchMode?: SearchMode;
  placeholder?: string;
  inputId?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [string];
  'update:searchMode': [SearchMode];
  submit: [];
  focus: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const modeSelectorRef = ref<HTMLElement | null>(null);
const showModeDropdown = ref(false);

const searchModes = [
  { value: 'posts' as SearchMode, label: '作品', icon: 'posts' },
  { value: 'authors' as SearchMode, label: '作者', icon: 'authors' },
];

const currentMode = computed(() => props.searchMode ?? 'posts');
const currentModeLabel = computed(() => searchModes.find((m) => m.value === currentMode.value)?.label ?? '作品');

const dynamicPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder;
  return currentMode.value === 'authors' ? '搜索作者用户名或昵称' : '搜索帖子、作者或标签';
});

onClickOutside(modeSelectorRef, () => {
  showModeDropdown.value = false;
});

function selectMode(mode: SearchMode) {
  emit('update:searchMode', mode);
  showModeDropdown.value = false;
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}

function handleSubmit() {
  inputRef.value?.blur();
  emit('submit');
}

function handleClear() {
  emit('update:modelValue', '');
  inputRef.value?.focus();
}
</script>

<template>
  <form class="search-bar" @submit.prevent="handleSubmit">
    <label class="sr-only" :for="props.inputId ?? 'global-search'">搜索</label>

    <div class="search-input-container">
      <!-- 搜索模式选择器（内嵌） -->
      <div ref="modeSelectorRef" class="mode-selector">
        <button type="button" class="mode-trigger" @click.stop="showModeDropdown = !showModeDropdown">
          <svg v-if="currentMode === 'posts'" class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <svg v-else class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span class="mode-label">{{ currentModeLabel }}</span>
          <svg class="dropdown-icon" :class="{ expanded: showModeDropdown }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <Transition name="dropdown">
          <div v-if="showModeDropdown" class="mode-dropdown">
            <button
              v-for="mode in searchModes"
              :key="mode.value"
              type="button"
              class="mode-option"
              :class="{ active: currentMode === mode.value }"
              @click="selectMode(mode.value)"
            >
              <svg v-if="mode.value === 'posts'" class="option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <svg v-else class="option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {{ mode.label }}
            </button>
          </div>
        </Transition>
      </div>

      <div class="divider" />

      <input
        :id="props.inputId ?? 'global-search'"
        ref="inputRef"
        class="search-input"
        type="search"
        name="q"
        :placeholder="dynamicPlaceholder"
        :value="modelValue"
        autocomplete="off"
        @focus="emit('focus')"
        @input="handleInput"
      />

      <button v-show="modelValue" type="button" class="clear-button" aria-label="清除" @click="handleClear">
        <svg viewBox="0 0 20 20" fill="currentColor" class="clear-icon">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      <button type="submit" class="search-button">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </form>
</template>

<style scoped>
.search-bar {
  width: 100%;
}

.search-input-container {
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--opz-bg-base);
  border: 1px solid var(--opz-border);
  border-radius: 999px;
  padding: 0.25rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input-container:focus-within {
  border-color: var(--opz-primary);
  box-shadow: 0 0 0 3px var(--opz-primary-soft, rgba(74, 144, 226, 0.15));
}

.mode-selector {
  position: relative;
  flex-shrink: 0;
  align-self: stretch;
}

.mode-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 100%;
  padding: 0 0.6rem;
  background: transparent;
  border: none;
  border-radius: 999px 0 0 999px;
  color: var(--opz-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.mode-trigger:hover {
  background: var(--opz-bg-soft);
  color: var(--opz-text-primary);
}

.mode-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.mode-label {
  line-height: 1;
  white-space: nowrap;
}

.dropdown-icon {
  width: 12px;
  height: 12px;
  opacity: 0.6;
  transition: transform 0.2s ease;
}

.dropdown-icon.expanded {
  transform: rotate(180deg);
}

.mode-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 100%;
  background: var(--opz-bg-base);
  border: 1px solid var(--opz-border);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  z-index: 30;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem 0.75rem;
  background: none;
  border: none;
  color: var(--opz-text-secondary);
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-option:hover {
  background: var(--opz-bg-soft);
  color: var(--opz-text-primary);
}

.mode-option.active {
  background: var(--opz-primary-soft, rgba(74, 144, 226, 0.1));
  color: var(--opz-primary);
  font-weight: 500;
}

.option-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.divider {
  width: 1px;
  height: 1.25rem;
  background: var(--opz-border);
  flex-shrink: 0;
  margin: 0 0.25rem;
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  padding: 0.4rem 0.5rem;
  background: transparent;
  color: var(--opz-text-primary);
  font-size: 0.875rem;
}

.search-input:focus {
  outline: none;
}

.search-input::placeholder {
  color: var(--opz-text-muted);
}

/* Hide default search cancel button in Chrome/Safari */
.search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.clear-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  background: transparent;
  border: none;
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  color: var(--opz-text-muted);
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.clear-button:hover {
  background: var(--opz-bg-soft);
  color: var(--opz-text-primary);
}

.clear-icon {
  width: 1rem;
  height: 1rem;
}

.search-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 50%;
  background: var(--opz-primary);
  color: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.search-button:hover {
  filter: brightness(1.1);
}

.search-button:active {
  transform: scale(0.95);
}

.search-icon {
  width: 1rem;
  height: 1rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .search-input-container {
    padding: 0.2rem;
  }

  .mode-trigger {
    padding: 0.35rem 0.4rem 0.35rem 0.5rem;
    font-size: 0.75rem;
    gap: 0.25rem;
  }

  .mode-icon {
    width: 12px;
    height: 12px;
  }

  .dropdown-icon {
    width: 10px;
    height: 10px;
  }

  .divider {
    height: 1rem;
    margin: 0 0.15rem;
  }

  .search-input {
    padding: 0.35rem 0.4rem;
    font-size: 0.8125rem;
  }

  .search-button {
    width: 1.75rem;
    height: 1.75rem;
  }

  .search-icon {
    width: 0.875rem;
    height: 0.875rem;
  }
}
</style>
