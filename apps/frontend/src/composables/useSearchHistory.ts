import { useLocalStorage } from '@vueuse/core';

const STORAGE_KEY = 'opz-search-history';
const MAX_HISTORY_SIZE = 10;

const history = useLocalStorage<string[]>(STORAGE_KEY, []);

export function useSearchHistory() {
  function addToHistory(keyword: string) {
    const trimmed = keyword.trim();
    if (!trimmed) return;

    // 移除已存在的相同关键词，将新的放到最前面
    const filtered = history.value.filter((item) => item !== trimmed);
    history.value = [trimmed, ...filtered].slice(0, MAX_HISTORY_SIZE);
  }

  function removeFromHistory(keyword: string) {
    history.value = history.value.filter((item) => item !== keyword);
  }

  function clearHistory() {
    history.value = [];
  }

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
}
