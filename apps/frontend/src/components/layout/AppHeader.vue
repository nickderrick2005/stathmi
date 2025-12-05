<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { onClickOutside } from '@vueuse/core';
import { Theme } from '@opz-hub/shared';
import type { AuthorAutocompleteItem } from '@opz-hub/shared';
import { useUserStore } from '@/stores/user';
import { useTheme } from '@/composables/useTheme';
import { notifyError, notifySuccess } from '@/utils/notifications';
import SearchBar from '@/components/search/SearchBar.vue';
import SearchSuggestions from '@/components/search/SearchSuggestions.vue';
import MobileSearchDrawer from '@/components/layout/header/MobileSearchDrawer.vue';
import ProfileDrawer from '@/components/layout/header/ProfileDrawer.vue';
import PersistentFilterDrawer from '@/components/layout/header/PersistentFilterDrawer.vue';
import HeaderAvatar from '@/components/layout/header/HeaderAvatar.vue';
import ProfileMenu from '@/components/layout/header/ProfileMenu.vue';
import ThemeSelector from '@/components/layout/header/ThemeSelector.vue';
import { useSearchForm } from '@/composables/useSearchForm';
import { useSearchHistory } from '@/composables/useSearchHistory';
import { useAuthorAutocomplete } from '@/composables/useAuthorAutocomplete';
import type { SearchFilters as SearchFilterState, SearchMode } from '@/types/search';
import { storeToRefs } from 'pinia';
import { useUIStore } from '@/stores/ui';
import { fetchHotSearchQueries } from '@/api/search';
import { logout } from '@/api/auth';
import { fetchUnreadNotificationCount } from '@/api/notifications';

const tabs = [
  { path: '/trending', label: '热门' },
  { path: '/following', label: '我的' },
  { path: '/custom', label: '分区' },
];

const searchSuggestions = ref<string[]>([]);
const searchSuggestionLoading = ref(false);

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const { setTheme, currentTheme } = useTheme();
const { formState: searchFilters, updateForm: updateSearchForm, submit: submitSearch } = useSearchForm();
const { history: searchHistory, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
const showSearchFilters = ref(false);
const searchContainerRef = ref<HTMLElement | null>(null);
const unreadCount = ref(0);
const isSearchRoute = computed(() => route.name === 'search');

// 搜索模式
const searchMode = ref<SearchMode>('posts');
const isAuthorMode = computed(() => searchMode.value === 'authors');

// 作者自动补全
const { authors: authorSuggestions, loading: authorSuggestionsLoading } = useAuthorAutocomplete(
  computed(() => searchFilters.q),
  isAuthorMode
);

// 全局 UI State
const uiStore = useUIStore();
const {
  showFilterDrawer: showPersistentDrawer,
  showMobileSearch: showSearchDrawer,
  showProfileDrawer,
} = storeToRefs(uiStore);

const userId = computed(() => userStore.session?.id ?? null);
const userAvatar = computed(() => userStore.session?.avatar ?? null);
const userDiscordRoles = computed(() => userStore.session?.discordRoles ?? []);
// 显示名称优先级：服务器昵称 > 全局名称 > 用户名
const userDisplayName = computed(
  () => userStore.session?.nickname ?? userStore.session?.globalName ?? userStore.session?.username ?? null
);
const hasUnreadNotifications = computed(() => unreadCount.value > 0);

async function loadSearchSuggestions() {
  searchSuggestionLoading.value = true;
  try {
    const response = await fetchHotSearchQueries(12);
    const keywords = [...(response.hotSearchQuery ?? []), ...(response.hotSearchTokens ?? [])]
      .map((item) => item.word)
      .filter(Boolean);
    // 去重保持顺序
    const uniqueKeywords = Array.from(new Set(keywords));
    const fallback = ['东方Project', 'MMD', '赛事', '同人'];
    searchSuggestions.value = (uniqueKeywords.length ? uniqueKeywords : fallback).slice(0, 12);
  } catch (error) {
    console.warn('[AppHeader] Failed to load search suggestions', error);
  } finally {
    searchSuggestionLoading.value = false;
  }
}

async function loadUnreadCount() {
  try {
    const { count } = await fetchUnreadNotificationCount();
    unreadCount.value = count;
  } catch {
    // 静默失败，保持为 0
  }
}

// 点击搜索区域外部时关闭筛选面板
onClickOutside(searchContainerRef, () => {
  showSearchFilters.value = false;
});

onMounted(() => {
  void loadSearchSuggestions();
  void loadUnreadCount();
});

async function handleSetTheme(theme: Theme) {
  try {
    await setTheme(theme);
  } catch (error) {
    notifyError('切换主题失败，请稍后再试');
    throw error;
  }
}

async function handleLogout() {
  try {
    await logout();
    userStore.clearSession();
    showProfileDrawer.value = false;
    notifySuccess('已退出登录');
    await router.push('/login');
  } catch (error) {
    notifyError('退出登录失败，请稍后再试');
    throw error;
  }
}

// 搜索流转：局部表单状态 -> Pinia search store -> 路由 query -> 自定义 Feed 渲染
async function pushSearch(partial: Partial<SearchFilterState>, source: 'desktop' | 'mobile') {
  try {
    await submitSearch(partial);
    // 保存搜索关键词到历史
    const keyword = partial.q ?? searchFilters.q;
    if (keyword?.trim()) {
      addToHistory(keyword);
    }
    if (source === 'desktop') {
      showSearchFilters.value = true;
    }
  } catch (error) {
    notifyError('搜索失败，请稍后再试');
    throw error;
  }
}

async function handleSearchSubmit(source: 'desktop' | 'mobile') {
  if (source === 'mobile') {
    showSearchDrawer.value = false;
  }
  await pushSearch({}, source);
}

function handleSearchFocus() {
  showSearchFilters.value = true;
  if (!searchSuggestions.value.length && !searchSuggestionLoading.value) {
    void loadSearchSuggestions();
  }
}

async function handleSuggestionSelect(keyword: string, source: 'desktop' | 'mobile') {
  await pushSearch({ q: keyword, tags: [] }, source);
  if (source === 'mobile') {
    showSearchDrawer.value = false;
  }
}

function openMobileSearch() {
  showSearchDrawer.value = true;
}

function openProfileDrawer() {
  showProfileDrawer.value = true;
}

async function navigateFromDrawer(path: string) {
  showProfileDrawer.value = false;
  await router.push(path);
}

async function navigateFromMenu(path: string) {
  await router.push(path);
}

async function openCssSettings() {
  await router.push('/settings');
}

// 处理作者卡片点击 -> 跳转作者主页
function handleAuthorSelect(author: AuthorAutocompleteItem) {
  showSearchFilters.value = false;
  showSearchDrawer.value = false; // 移动端关闭抽屉
  void router.push(`/user/${author.id}`);
}

// 处理搜索作者作品按钮点击 -> 搜索该作者的作品
async function handleSearchAuthorPosts(author: AuthorAutocompleteItem) {
  searchMode.value = 'posts';
  showSearchFilters.value = false;
  await pushSearch({ q: author.displayName, tags: [] }, 'desktop');
}
</script>

<template>
  <header class="app-header">
    <div class="desktop-bar">
      <RouterLink class="logo" to="/trending">
        <img src="/default-img/title.png" alt="星图ΣΤΑΘΜΗ" class="logo-img" />
      </RouterLink>
      <nav class="nav-links">
        <RouterLink v-for="tab in tabs" :key="tab.path" :to="tab.path">{{ tab.label }}</RouterLink>
      </nav>
      <div ref="searchContainerRef" class="search-container">
        <div class="search-region">
          <SearchBar
            v-model="searchFilters.q"
            v-model:search-mode="searchMode"
            input-id="desktop-search"
            @focus="handleSearchFocus"
            @submit="() => handleSearchSubmit('desktop')"
          />
        </div>
        <transition name="fade">
          <div v-if="showSearchFilters" class="filter-wrapper desktop-only">
            <SearchSuggestions
              :search-mode="searchMode"
              :suggestions="searchSuggestions"
              :loading="searchSuggestionLoading"
              :history="searchHistory"
              :authors="authorSuggestions"
              :authors-loading="authorSuggestionsLoading"
              @select="(keyword) => handleSuggestionSelect(keyword, 'desktop')"
              @removeHistory="removeFromHistory"
              @clearHistory="clearHistory"
              @selectAuthor="handleAuthorSelect"
              @searchAuthorPosts="handleSearchAuthorPosts"
            />
          </div>
        </transition>
      </div>
      <div class="desktop-actions">
        <ThemeSelector :current-theme="currentTheme" @set-theme="handleSetTheme" @open-css-settings="openCssSettings" />
        <ProfileMenu
          :avatar-url="userAvatar"
          :username="userDisplayName"
          :user-id="userId"
          :discord-roles="userDiscordRoles"
          :has-unread="hasUnreadNotifications"
          @navigate="navigateFromMenu"
          @logout="handleLogout"
        />
      </div>
    </div>

    <div class="mobile-bar">
      <div class="mobile-left">
        <HeaderAvatar :avatar-url="userAvatar" :has-unread="hasUnreadNotifications" @click="openProfileDrawer" />
      </div>

      <nav class="mobile-tabs">
        <RouterLink v-for="tab in tabs" :key="tab.path" :to="tab.path">{{ tab.label }}</RouterLink>
      </nav>

      <div class="mobile-actions">
        <ThemeSelector :current-theme="currentTheme" @set-theme="handleSetTheme" @open-css-settings="openCssSettings" />
        <button class="header-icon-btn" type="button" title="搜索" @click="openMobileSearch">
          <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>
  </header>

  <MobileSearchDrawer
    v-model:show="showSearchDrawer"
    v-model:search-mode="searchMode"
    :filters="searchFilters"
    :suggestions="searchSuggestions"
    :suggestions-loading="searchSuggestionLoading"
    :history="searchHistory"
    :authors="authorSuggestions"
    :authors-loading="authorSuggestionsLoading"
    @change="updateSearchForm"
    @submit="() => handleSearchSubmit('mobile')"
    @selectSuggestion="(keyword) => handleSuggestionSelect(keyword, 'mobile')"
    @removeHistory="removeFromHistory"
    @clearHistory="clearHistory"
    @selectAuthor="handleAuthorSelect"
    @searchAuthorPosts="handleSearchAuthorPosts"
  />

  <!-- PersistentFilterDrawer 内部直接操作 store -->
  <PersistentFilterDrawer v-if="!isSearchRoute" v-model:show="showPersistentDrawer" />

  <ProfileDrawer
    v-model:show="showProfileDrawer"
    :avatar-url="userAvatar"
    :user-id="userId"
    :username="userDisplayName"
    :discord-roles="userDiscordRoles"
    :has-unread="hasUnreadNotifications"
    @navigate="navigateFromDrawer"
    @logout="handleLogout"
  />
</template>

<style scoped>
.app-header {
  border-bottom: 1px solid var(--opz-border);
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--opz-bg-base);
}

.desktop-bar {
  display: none;
  align-items: center;
  gap: 2rem;
  padding: 0 2rem;
  height: 3.5rem;
}

.desktop-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mobile-bar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  padding: 0 1rem;
  height: 3.5rem;
}

.mobile-left {
  display: flex;
  align-items: center;
}

.mobile-tabs {
  justify-self: center;
  display: flex;
  gap: 1.25rem;
  height: 100%;
  align-items: center;
}

.mobile-tabs a {
  position: relative;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 0.25rem;
  text-decoration: none;
  font-size: 1rem;
  font-weight: 600;
  color: var(--opz-text-muted);
  transition: color 0.2s;
}

.mobile-tabs a:hover {
  color: var(--opz-text-primary);
}

.mobile-tabs a.router-link-active {
  color: var(--opz-text-primary);
}

.mobile-tabs a.router-link-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--opz-primary);
  border-radius: 3px 3px 0 0;
}

.mobile-actions {
  display: flex;
  gap: 0.35rem;
}

.logo {
  display: flex;
  align-items: center;
  text-decoration: none;
}

.logo-img {
  height: 1.75rem;
  width: auto;
  filter: var(--opz-icon-filter);
}

.nav-links {
  display: none;
  gap: 1rem;
  height: 100%;
}

.nav-links a {
  position: relative;
  display: flex;
  align-items: center;
  height: 100%;
  color: var(--opz-text-muted);
  text-decoration: none;
  font-weight: 600;
  font-size: 1rem;
  padding: 0 0.25rem;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: var(--opz-text-primary);
}

.nav-links a.router-link-active {
  color: var(--opz-text-primary);
}

.nav-links a.router-link-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--opz-primary);
  border-radius: 3px 3px 0 0;
}

.search-container {
  flex: 1;
  position: relative;
}

.search-region {
  display: flex;
  gap: 0.5rem;
}

.header-icon-btn {
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

.header-icon-btn:hover {
  background: var(--opz-bg-mute);
  transform: scale(1.05);
}

.header-icon-btn:active {
  transform: scale(0.95);
}

.header-icon-btn .icon-svg {
  width: 1.1rem;
  height: 1.1rem;
  opacity: 0.8;
  color: var(--opz-text-primary);
}

.header-icon-btn:hover .icon-svg {
  opacity: 1;
}

.filter-wrapper {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  padding-top: 0.5rem;
  z-index: 10;
}

.filter-wrapper :deep(.search-suggestions) {
  background: var(--opz-bg-base);
  border: 1px solid var(--opz-border);
  border-radius: 12px;
  padding: 1rem;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.desktop-only {
  display: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (min-width: 900px) {
  .desktop-bar {
    display: flex;
  }

  .nav-links {
    display: flex;
  }

  .desktop-only {
    display: block;
  }

  .mobile-bar {
    display: none;
  }
}
</style>
