import { computed, watch } from 'vue';
import { usePreferredDark } from '@vueuse/core';
import { Theme } from '@opz-hub/shared';
import { useThemeStore } from '@/stores/theme';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';

export function useTheme() {
  const themeStore = useThemeStore();
  const userStore = useUserStore();
  const prefersDark = usePreferredDark();

  const { currentTheme } = storeToRefs(themeStore);

  const resolvedTheme = computed<Theme>(() => {
    if (currentTheme.value === Theme.Auto) {
      return prefersDark.value ? Theme.Dark : Theme.Light;
    }
    return currentTheme.value;
  });

  const isDarkMode = computed(() => resolvedTheme.value === Theme.Dark);

  async function setTheme(next: Theme) {
    // 先更新本地主题（乐观更新）
    themeStore.setTheme(next);
    // 同步到服务器（userStore.updateSettings 内部会再次同步 themeStore）
    await userStore.updateSettings({ theme: next });
  }

  async function toggleTheme() {
    const next = resolvedTheme.value === Theme.Dark ? Theme.Light : Theme.Dark;
    await setTheme(next);
  }

  watch(
    resolvedTheme,
    (value) => {
      if (typeof document === 'undefined') {
        return;
      }
      document.documentElement.dataset.theme = value;
    },
    { immediate: true }
  );

  return {
    currentTheme,
    resolvedTheme,
    isDarkMode,
    setTheme,
    toggleTheme,
  };
}
