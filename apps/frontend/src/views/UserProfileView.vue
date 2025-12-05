<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import ViewShell from '@/components/layout/ViewShell.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import UserAuthorCard from '@/components/user/UserAuthorCard.vue';
import UserFeaturedPost from '@/components/user/UserFeaturedPost.vue';
import UserProfileFilters from '@/components/user/UserProfileFilters.vue';
import PostFeedList from '@/components/feed/PostFeedList.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';
import { useUserProfile } from '@/composables/useUserProfile';
import { useUserPosts } from '@/composables/useUserPosts';
import { useRolesStore } from '@/stores/roles';

const route = useRoute();
const rolesStore = useRolesStore();

// 用户ID
const userId = computed(() => route.params.id as string);

// 用户资料
const {
  profile,
  featuredPost,
  loading: profileLoading,
  error: profileError,
  isOwnProfile,
  isFollowing,
  creationDays,
  displayName,
  pendingFollow,
  pendingFeatured,
  toggleFollow,
  setFeaturedPost,
  refresh: refreshProfile,
} = useUserProfile(userId);

// 用户帖子
const channelStats = computed(() => profile.value?.channelStats ?? []);
const {
  posts,
  loading: postsLoading,
  error: postsError,
  total,
  currentPage,
  channelId,
  sort,
  pageSize,
  hasMore,
  isPageMode,
  channelOptions,
  sortOptions,
  loadMore,
  setPage,
  changeChannel,
  changeSort,
  refresh: refreshPosts,
} = useUserPosts(userId, channelStats);

// 加载角色数据
onMounted(() => {
  rolesStore.getRoles();
});

// 页面标题
const pageTitle = computed(() => {
  if (profileLoading.value) return '加载中...';
  if (displayName.value) return displayName.value;
  return `用户 ${userId.value}`;
});
</script>

<template>
  <ViewShell :title="pageTitle" show-back>
    <!-- 加载中 -->
    <div v-if="profileLoading && !profile" class="loading-container">
      <LoadingSpinner />
    </div>

    <!-- 错误 -->
    <ErrorMessage
      v-else-if="profileError"
      :message="profileError.message"
      @retry="refreshProfile"
    />

    <!-- 主内容 -->
    <div v-else-if="profile" class="profile-layout">
      <!-- 左侧栏 -->
      <aside class="profile-sidebar">
        <UserAuthorCard
          :profile="profile"
          :is-following="isFollowing"
          :is-own-profile="isOwnProfile"
          :creation-days="creationDays"
          :total-posts="total"
          :pending="pendingFollow"
          @toggle-follow="toggleFollow"
        />

        <UserFeaturedPost
          v-if="featuredPost || isOwnProfile"
          :post="featuredPost"
          :is-own-profile="isOwnProfile"
          :loading="pendingFeatured"
          @select="setFeaturedPost"
        />
      </aside>

      <!-- 右侧主内容 -->
      <main class="profile-main">
        <!-- 筛选栏 -->
        <UserProfileFilters
          :channel-options="channelOptions"
          :sort-options="sortOptions"
          :channel-id="channelId"
          :sort="sort"
          :total="total"
          :current-page="currentPage"
          :page-size="pageSize"
          :is-page-mode="isPageMode"
          @update:channel-id="changeChannel"
          @update:sort="changeSort"
          @page-change="setPage"
        />

        <!-- 帖子列表 -->
        <PostFeedList
          :posts="posts"
          :loading="postsLoading"
          :error="postsError"
          :has-more="hasMore"
          :is-page-mode="isPageMode"
          :total="total"
          :page-size="pageSize"
          :current-page="currentPage"
          :show-pagination-controls="false"
          :on-load-more="loadMore"
          :on-page-change="setPage"
          :on-retry="refreshPosts"
          :on-refresh="refreshPosts"
          feed-key="user-profile"
          default-display-mode="list"
        />
      </main>
    </div>
  </ViewShell>
</template>

<style scoped>
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.profile-layout {
  display: flex;
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.profile-sidebar {
  flex-shrink: 0;
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: sticky;
  top: 1rem;
  height: fit-content;
}

.profile-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 移动端响应式 */
@media (max-width: 767px) {
  .profile-layout {
    flex-direction: column;
    gap: 0.75rem;
  }

  .profile-sidebar {
    width: 100%;
    position: static;
    flex-direction: column;
    gap: 0.75rem;
  }

}
</style>
