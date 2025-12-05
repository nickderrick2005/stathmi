<script setup lang="ts">
import { ref } from 'vue';
import { NPopover } from 'naive-ui';
import { Theme } from '@opz-hub/shared';

const props = defineProps<{
  currentTheme: Theme;
}>();

const emit = defineEmits<{
  setTheme: [Theme];
  openCssSettings: [];
}>();

const showPopover = ref(false);

type ThemeOptionValue = Theme | 'customCss';
type IconType = 'light' | 'dark' | 'auto' | 'css';

interface ThemeOptionItem {
  label: string;
  value: ThemeOptionValue;
  iconType: IconType;
}

const options: ThemeOptionItem[] = [
  { label: '浅色', value: Theme.Light, iconType: 'light' },
  { label: '深色', value: Theme.Dark, iconType: 'dark' },
  { label: '跟随系统', value: Theme.Auto, iconType: 'auto' },
  { label: '自定义 CSS', value: 'customCss', iconType: 'css' },
];

const themeToIconType: Record<Theme, IconType> = {
  [Theme.Light]: 'light',
  [Theme.Dark]: 'dark',
  [Theme.Auto]: 'auto',
};

function handleSelect(value: ThemeOptionValue) {
  showPopover.value = false;
  if (value === 'customCss') {
    emit('openCssSettings');
  } else {
    emit('setTheme', value);
  }
}
</script>

<template>
  <NPopover
    v-model:show="showPopover"
    trigger="click"
    placement="bottom"
    :show-arrow="false"
    raw
  >
    <template #trigger>
      <button type="button" class="theme-btn" title="切换主题">
        <!-- 浅色 -->
        <svg v-if="themeToIconType[currentTheme] === 'light'" class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        <!-- 深色 -->
        <svg v-else-if="themeToIconType[currentTheme] === 'dark'" class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
        <!-- 跟随系统 -->
        <svg v-else class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
        </svg>
      </button>
    </template>
    <div class="theme-dropdown">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="theme-option"
        :class="{ active: option.value === currentTheme }"
        @click="handleSelect(option.value)"
      >
        <!-- 浅色 -->
        <svg v-if="option.iconType === 'light'" class="theme-option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        <!-- 深色 -->
        <svg v-else-if="option.iconType === 'dark'" class="theme-option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
        <!-- 跟随系统 -->
        <svg v-else-if="option.iconType === 'auto'" class="theme-option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
        </svg>
        <!-- 自定义CSS -->
        <svg v-else class="theme-option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9.5 7.5l-5 5 5 5M14.5 7.5l5 5-5 5" />
        </svg>
        <span>{{ option.label }}</span>
      </button>
    </div>
  </NPopover>
</template>

<style scoped>
.theme-btn {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid var(--opz-border);
  background: var(--opz-bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.theme-btn:hover {
  background: var(--opz-bg-mute);
  transform: scale(1.05);
}

.theme-btn:active {
  transform: scale(0.95);
}

.theme-icon {
  width: 1.1rem;
  height: 1.1rem;
  opacity: 0.8;
  color: var(--opz-text-primary);
}

.theme-btn:hover .theme-icon {
  opacity: 1;
}

/* 下拉菜单 */
.theme-dropdown {
  background: var(--opz-bg-base);
  border: 1px solid var(--opz-border);
  border-radius: 10px;
  padding: 6px;
  min-width: 140px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 14px;
  color: var(--opz-text-primary);
  cursor: pointer;
  transition: background 0.15s ease;
}

.theme-option:hover {
  background: var(--opz-bg-soft);
}

.theme-option.active {
  background: var(--opz-primary);
  color: #fff;
}

.theme-option-icon {
  width: 18px;
  height: 18px;
  opacity: 0.7;
  color: var(--opz-text-primary);
}

.theme-option.active .theme-option-icon {
  opacity: 1;
  color: #fff;
}
</style>
