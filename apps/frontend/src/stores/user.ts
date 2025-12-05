import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { SessionUser, UserSettings } from '@opz-hub/shared';
import { fetchSessionUser } from '@/api/auth';
import { fetchUserSettings, updateUserSettings, fetchFollowingFeedViewedAt, updateFollowingFeedViewedAt } from '@/api/users';
import { onUnauthorized } from '@/api/client';
import { useThemeStore } from './theme';

export const useUserStore = defineStore('user', () => {
  const session = ref<SessionUser | null>(null);
  const settings = ref<UserSettings | null>(null);
  const followingFeedViewedAt = ref<string | null>(null);
  const isSessionLoading = ref(false);
  const hasAttemptedSessionFetch = ref(false);
  const hasLoadedSettings = ref(false);
  const hasLoadedFollowingFeedViewedAt = ref(false);
  let pendingSessionPromise: Promise<SessionUser | null> | null = null;
  const themeStore = useThemeStore();

  const isAuthenticated = computed(() => Boolean(session.value));
  // 用户存在但缺少 orientations -> 需要强制 onboarding。
  const requiresOnboarding = computed(() =>
    Boolean(session.value && (!session.value.orientations || session.value.orientations.length === 0))
  );

  async function loadSession() {
    if (pendingSessionPromise) {
      return pendingSessionPromise;
    }

    isSessionLoading.value = true;
    pendingSessionPromise = (async () => {
      try {
        const result = await fetchSessionUser({ silent: true });
        session.value = result;
        return result;
      } catch (error) {
        session.value = null;
        throw error;
      } finally {
        hasAttemptedSessionFetch.value = true;
        isSessionLoading.value = false;
      }
    })();

    try {
      return await pendingSessionPromise;
    } finally {
      pendingSessionPromise = null;
    }
  }

  async function ensureSession() {
    if (session.value || hasAttemptedSessionFetch.value) {
      return session.value;
    }

    try {
      return await loadSession();
    } catch {
      return null;
    }
  }

  async function loadSettings(force = false) {
    if (!session.value) {
      return null;
    }

    if (hasLoadedSettings.value && !force) {
      return settings.value;
    }

    const result = await fetchUserSettings();
    settings.value = result;
    hasLoadedSettings.value = true;
    themeStore.setTheme(result.theme);
    return result;
  }

  function setSession(user: SessionUser | null) {
    session.value = user;
  }

  function clearSession() {
    session.value = null;
    settings.value = null;
    followingFeedViewedAt.value = null;
    hasLoadedSettings.value = false;
    hasLoadedFollowingFeedViewedAt.value = false;
  }

  function setOrientation(orientations: string[]) {
    if (!session.value) {
      return;
    }
    session.value = { ...session.value, orientations };
  }

  /**
   * 统一的设置更新方法
   * 封装 API 调用和本地状态同步，供 preferences、useTheme 等调用
   * @param partial 要更新的设置字段
   */
  async function updateSettings(partial: Partial<UserSettings>) {
    if (!isAuthenticated.value) {
      return;
    }

    const result = await updateUserSettings(partial);
    settings.value = result;

    // 如果更新了主题，同步到 themeStore
    if (partial.theme !== undefined) {
      themeStore.setTheme(result.theme);
    }
  }

  // 加载关注 Feed 上次查看时间
  async function loadFollowingFeedViewedAt(force = false) {
    if (!session.value) {
      return null;
    }
    if (hasLoadedFollowingFeedViewedAt.value && !force) {
      return followingFeedViewedAt.value;
    }
    const result = await fetchFollowingFeedViewedAt();
    followingFeedViewedAt.value = result.viewedAt;
    hasLoadedFollowingFeedViewedAt.value = true;
    return result.viewedAt;
  }

  // 更新关注 Feed 上次查看时间
  async function saveFollowingFeedViewedAt(viewedAt: string) {
    if (!session.value) {
      return;
    }
    await updateFollowingFeedViewedAt(viewedAt);
    followingFeedViewedAt.value = viewedAt;
  }

  onUnauthorized(() => {
    clearSession();
    hasAttemptedSessionFetch.value = true;
  });

  return {
    session,
    settings,
    followingFeedViewedAt,
    isSessionLoading,
    hasAttemptedSessionFetch,
    hasLoadedSettings,
    isAuthenticated,
    requiresOnboarding,
    loadSession,
    ensureSession,
    loadSettings,
    setSession,
    clearSession,
    setOrientation,
    updateSettings,
    loadFollowingFeedViewedAt,
    saveFollowingFeedViewedAt,
  };
});
