import { ref, computed, watch, onUnmounted, type Ref } from 'vue';
import type { Post, UserProfileSort, ChannelStats } from '@opz-hub/shared';
import { fetchUserPosts } from '@/api/users';
import { useMetadataStore } from '@/stores/metadata';

const DEFAULT_PAGE_SIZE = 20;

/**
 * 用户帖子列表数据管理
 */
export function useUserPosts(userId: Ref<string>, channelStats: Ref<ChannelStats[]>) {
  const metadataStore = useMetadataStore();

  // 组件卸载标记
  let isMounted = true;

  // 状态
  const posts = ref<Post[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const total = ref(0);
  const currentPage = ref(1);

  // 筛选条件
  const channelId = ref<string | null>(null);
  const sort = ref<UserProfileSort>('updated-desc');

  // 计算属性
  const pageSize = computed(() => DEFAULT_PAGE_SIZE);
  const hasMore = computed(() => posts.value.length < total.value);
  // 个人主页始终使用分页模式
  const isPageMode = computed(() => true);

  // 频道名映射（使用 metadata 中的简化名称）
  const channelNameMap = computed(() => {
    const channels = metadataStore.cachedChannels;
    if (!channels) return new Map<string, string>();
    return new Map(channels.map((c) => [c.id, c.name]));
  });

  // 带数量的分区选项
  const channelOptions = computed(() => {
    const allCount = channelStats.value.reduce((sum, c) => sum + c.postCount, 0);
    const nameMap = channelNameMap.value;
    return [
      { value: null, label: '全部', count: allCount },
      ...channelStats.value.map((c) => ({
        value: c.channelId,
        label: nameMap.get(c.channelId) ?? c.channelName,
        count: c.postCount,
      })),
    ];
  });

  // 排序选项
  const sortOptions = [
    { value: 'updated-desc' as const, label: '更新时间 ↓' },
    { value: 'updated-asc' as const, label: '更新时间 ↑' },
    { value: 'created-desc' as const, label: '发布时间 ↓' },
    { value: 'created-asc' as const, label: '发布时间 ↑' },
    { value: 'likes-desc' as const, label: '点赞数 ↓' },
    { value: 'likes-asc' as const, label: '点赞数 ↑' },
  ];

  // 加载帖子
  async function loadPosts(reset = false) {
    if (!userId.value) return;

    if (reset) {
      currentPage.value = 1;
      posts.value = [];
    }

    loading.value = true;
    error.value = null;

    try {
      const offset = (currentPage.value - 1) * pageSize.value;
      const result = await fetchUserPosts(userId.value, {
        channelId: channelId.value ?? undefined,
        sort: sort.value,
        limit: pageSize.value,
        offset,
      });

      if (!isMounted) return;

      if (reset || isPageMode.value) {
        posts.value = result.posts;
      } else {
        posts.value = [...posts.value, ...result.posts];
      }
      total.value = result.total;
    } catch (e) {
      if (!isMounted) return;
      error.value = e instanceof Error ? e : new Error('加载帖子失败');
    } finally {
      if (isMounted) loading.value = false;
    }
  }

  // 加载更多（无限滚动）
  async function loadMore() {
    if (loading.value || !hasMore.value) return;
    currentPage.value++;
    await loadPosts();
  }

  // 切换页码（分页模式）
  async function setPage(page: number) {
    if (page === currentPage.value) return;
    currentPage.value = page;
    await loadPosts(); // 保留已设置的页码
  }

  // 切换分区
  async function changeChannel(newChannelId: string | null) {
    if (newChannelId === channelId.value) return;
    channelId.value = newChannelId;
    await loadPosts(true);
  }

  // 切换排序
  async function changeSort(newSort: UserProfileSort) {
    if (newSort === sort.value) return;
    sort.value = newSort;
    await loadPosts(true);
  }

  // 刷新
  async function refresh() {
    await loadPosts(true);
  }

  // 监听 userId 变化，自动重新加载
  watch(
    userId,
    () => {
      channelId.value = null;
      sort.value = 'updated-desc';
      loadPosts(true);
    },
    { immediate: true }
  );

  // 清理
  onUnmounted(() => {
    isMounted = false;
  });

  return {
    // 状态
    posts,
    loading,
    error,
    total,
    currentPage,
    channelId,
    sort,
    // 计算属性
    pageSize,
    hasMore,
    isPageMode,
    channelOptions,
    sortOptions,
    // 方法
    loadPosts,
    loadMore,
    setPage,
    changeChannel,
    changeSort,
    refresh,
  };
}
