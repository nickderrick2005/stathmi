import { computed, ref, type MaybeRefOrGetter, toValue } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import type { DisplayMode } from '@opz-hub/shared';
import { usePreferencesStore } from '@/stores/preferences';

const STORAGE_KEY = 'opz:feed-display-modes';

// 全局响应式存储
const feedDisplayModes = ref<Record<string, DisplayMode>>({});
let isInitialized = false;

// 初始化延迟执行，避免模块级副作用
function ensureInitialized() {
  if (isInitialized) return;
  isInitialized = true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      feedDisplayModes.value = JSON.parse(stored);
    }
  } catch {
    feedDisplayModes.value = {};
  }
}

// 保存到 localStorage（防抖 300ms）
const saveToStorage = useDebounceFn(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(feedDisplayModes.value));
  } catch {
    // localStorage 可能已满或被禁用
  }
}, 300);

/**
 * Feed 级别显示模式管理
 * @param feedKeyOrGetter feed 标识（支持响应式），如 'trending-recommended', 'following', 'custom:channel1,channel2'
 * @param defaultMode 可选的默认模式，优先于全局设置
 */
export function useFeedDisplayMode(feedKeyOrGetter: MaybeRefOrGetter<string>, defaultMode?: DisplayMode) {
  ensureInitialized();

  const preferencesStore = usePreferencesStore();

  // 响应式 feedKey
  const resolvedFeedKey = computed(() => toValue(feedKeyOrGetter));

  // 当前 feed 的 displayMode（无设置时优先使用 defaultMode，再回退到全局）
  const displayMode = computed<DisplayMode>(() => {
    return feedDisplayModes.value[resolvedFeedKey.value] ?? defaultMode ?? preferencesStore.displayMode;
  });

  // 设置当前 feed 的 displayMode（仅在值改变时保存）
  function setDisplayMode(mode: DisplayMode) {
    const key = resolvedFeedKey.value;
    if (feedDisplayModes.value[key] === mode) return;
    feedDisplayModes.value[key] = mode;
    saveToStorage();
  }

  // 清除当前 feed 的设置（恢复为全局默认）
  function clearDisplayMode() {
    const key = resolvedFeedKey.value;
    if (!(key in feedDisplayModes.value)) return;
    delete feedDisplayModes.value[key];
    saveToStorage();
  }

  // 是否使用了自定义设置（非全局默认）
  const hasCustomSetting = computed(() => {
    return resolvedFeedKey.value in feedDisplayModes.value;
  });

  return {
    displayMode,
    setDisplayMode,
    clearDisplayMode,
    hasCustomSetting,
  };
}
