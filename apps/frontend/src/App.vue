<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { darkTheme, NConfigProvider, NMessageProvider, NGlobalStyle } from 'naive-ui';
import { Theme } from '@opz-hub/shared';
import { useUserStore } from '@/stores/user';
import { useFollowsStore } from '@/stores/follows';
import { useFavoritesStore } from '@/stores/favorites';
import { useMetadataStore } from '@/stores/metadata';
import { usePreferencesStore } from '@/stores/preferences';
import { useRolesStore } from '@/stores/roles';
import AppLayout from '@/components/layout/AppLayout.vue';
import { useTheme } from '@/composables/useTheme';
import { useCustomCss } from '@/composables/useCustomCss';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import QuickConfirm from '@/components/common/QuickConfirm.vue';

const route = useRoute();

const userStore = useUserStore();
const followsStore = useFollowsStore();
const favoritesStore = useFavoritesStore();
const metadataStore = useMetadataStore();
const preferencesStore = usePreferencesStore();
const rolesStore = useRolesStore();
const { isSessionLoading, hasAttemptedSessionFetch } = storeToRefs(userStore);
const { resolvedTheme } = useTheme();
const { sanitizedCustomCss, hasCustomCss } = useCustomCss();

const naiveTheme = computed(() => (resolvedTheme.value === Theme.Dark ? darkTheme : null));
const isBootstrapping = computed(() => isSessionLoading.value || !hasAttemptedSessionFetch.value);

// 全屏页面（不显示 AppLayout）
const isFullscreenPage = computed(() => route.meta.fullscreen === true);

onMounted(async () => {
  // 公开数据预加载（不依赖登录状态）
  metadataStore.getChannels().catch(() => {});
  metadataStore.loadHotWordsMeta().catch(() => {});
  rolesStore.getRoles().catch(() => {});

  try {
    const session = await userStore.ensureSession();
    if (!session) return;

    // 后台加载用户配置与数据，不阻塞首屏
    void userStore
      .loadSettings()
      .then((settings) => {
        if (settings) {
          preferencesStore.loadFromUserSettings(settings);
        }
      })
      .catch((error) => {
        console.warn('[App] Failed to load settings', error);
      });

    void followsStore.loadAll().catch((error) => {
      console.warn('[App] Failed to load follows', error);
    });
    void favoritesStore.loadFavorites().catch((error) => {
      console.warn('[App] Failed to load favorites', error);
    });
  } catch (error) {
    console.warn('[App] Failed to bootstrap session', error);
  }
});
</script>

<template>
  <NConfigProvider :theme="naiveTheme">
    <NMessageProvider>
      <NGlobalStyle />
      <!-- 用户自定义 CSS 全局注入 -->
      <component :is="'style'" v-if="hasCustomCss">{{ sanitizedCustomCss }}</component>
      <div class="app-shell">
        <div v-if="isBootstrapping" class="app-loading">
          <LoadingSpinner size="lg" />
        </div>
        <!-- 全屏页面（登录、onboarding）不显示 AppLayout -->
        <template v-else-if="isFullscreenPage">
          <RouterView />
        </template>
        <AppLayout v-else>
          <RouterView v-slot="{ Component }">
            <KeepAlive :include="['TrendingFeedView', 'FollowingFeedView', 'CustomFeedView', 'SearchView']">
              <component :is="Component" />
            </KeepAlive>
          </RouterView>
        </AppLayout>
      </div>
    </NMessageProvider>
    <!-- 全局轻量确认气泡 -->
    <QuickConfirm />
  </NConfigProvider>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.app-loading {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  color: var(--opz-text-muted);
}
</style>
