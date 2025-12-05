import { ref, computed, watch, onUnmounted, type Ref } from 'vue';
import type { UserProfileExtended, Post } from '@opz-hub/shared';
import { fetchUserProfileExtended, updateFeaturedPost } from '@/api/users';
import { fetchPostsByIds } from '@/api/posts';
import { useUserStore } from '@/stores/user';
import { useFollowsStore } from '@/stores/follows';
import { useFollows } from './useFollows';
import { notifyError, notifySuccess } from '@/utils/notifications';

/**
 * 用户个人主页数据管理
 */
export function useUserProfile(userId: Ref<string>) {
  const userStore = useUserStore();
  const followsStore = useFollowsStore();
  const { toggleFollowAuthor } = useFollows();

  // 组件卸载标记
  let isMounted = true;

  // 状态
  const profile = ref<UserProfileExtended | null>(null);
  const featuredPost = ref<Post | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const pendingFollow = ref(false);
  const pendingFeatured = ref(false);

  // 计算属性
  const isOwnProfile = computed(() => userStore.session?.id === userId.value);
  const isFollowing = computed(() => followsStore.isFollowingAuthor(userId.value));

  // 创作天数
  const creationDays = computed(() => {
    if (!profile.value?.joinedAt) return 0;
    const joinDate = new Date(profile.value.joinedAt);
    const now = new Date();
    return Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
  });

  // 显示名称
  const displayName = computed(() => {
    if (!profile.value) return '';
    return profile.value.nickname ?? profile.value.globalName ?? profile.value.username;
  });

  // 加载用户资料
  async function loadProfile() {
    if (!userId.value) return;

    loading.value = true;
    error.value = null;

    try {
      const result = await fetchUserProfileExtended(userId.value);
      if (!isMounted) return;
      profile.value = result;

      // 加载推荐作品
      if (result.featuredPostId) {
        const posts = await fetchPostsByIds([result.featuredPostId]);
        if (!isMounted) return;
        featuredPost.value = posts[0] ?? null;
      } else {
        featuredPost.value = null;
      }
    } catch (e) {
      if (!isMounted) return;
      error.value = e instanceof Error ? e : new Error('加载用户资料失败');
      profile.value = null;
      featuredPost.value = null;
    } finally {
      if (isMounted) loading.value = false;
    }
  }

  // 关注/取消关注
  async function toggleFollow() {
    if (pendingFollow.value) return;

    pendingFollow.value = true;
    try {
      await toggleFollowAuthor(userId.value);
    } finally {
      if (isMounted) pendingFollow.value = false;
    }
  }

  // 设置推荐作品（乐观更新）
  async function setFeaturedPost(postId: string | null) {
    if (pendingFeatured.value || !isOwnProfile.value) return;

    // 保存旧值用于回滚
    const oldPostId = profile.value?.featuredPostId;
    const oldPost = featuredPost.value;

    // 乐观更新本地状态
    if (profile.value) {
      profile.value = { ...profile.value, featuredPostId: postId ?? undefined };
    }
    if (!postId) {
      featuredPost.value = null;
    }

    pendingFeatured.value = true;
    try {
      // 并行发送更新请求和加载帖子详情
      const updatePromise = updateFeaturedPost(postId);
      const postPromise = postId ? fetchPostsByIds([postId]) : Promise.resolve([]);

      const [, posts] = await Promise.all([updatePromise, postPromise]);
      if (!isMounted) return;

      // 更新 featuredPost（如果设置了新作品）
      if (postId) {
        featuredPost.value = posts[0] ?? null;
      }

      notifySuccess(postId ? '已设置代表作' : '已清除代表作');
    } catch (e) {
      if (!isMounted) return;
      console.error('[useUserProfile] setFeaturedPost error:', e);

      // 失败时回滚
      if (profile.value) {
        profile.value = { ...profile.value, featuredPostId: oldPostId };
      }
      featuredPost.value = oldPost;

      notifyError('设置代表作失败');
    } finally {
      if (isMounted) pendingFeatured.value = false;
    }
  }

  // 刷新数据
  async function refresh() {
    await loadProfile();
  }

  // 监听 userId 变化，自动重新加载
  watch(userId, () => {
    loadProfile();
  }, { immediate: true });

  // 清理
  onUnmounted(() => {
    isMounted = false;
  });

  return {
    // 状态
    profile,
    featuredPost,
    loading,
    error,
    pendingFollow,
    pendingFeatured,
    // 计算属性
    isOwnProfile,
    isFollowing,
    creationDays,
    displayName,
    // 方法
    loadProfile,
    toggleFollow,
    setFeaturedPost,
    refresh,
  };
}
