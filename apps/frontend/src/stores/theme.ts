import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { Theme } from '@opz-hub/shared';

const STORAGE_KEY = 'opz-theme';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return Theme.Auto;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && Object.values(Theme).includes(stored as Theme)) {
    return stored as Theme;
  }

  return Theme.Auto;
}

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<Theme>(readInitialTheme());

  function setTheme(next: Theme) {
    currentTheme.value = next;
  }

  watch(
    currentTheme,
    (value) => {
      if (typeof window === 'undefined') {
        return;
      }
      window.localStorage.setItem(STORAGE_KEY, value);
    },
    { flush: 'post' }
  );

  return { currentTheme, setTheme };
});
