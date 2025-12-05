import { computed, ref, watch, shallowRef, type Ref } from 'vue';
import { defineStore } from 'pinia';
import { useUserStore } from './user';
import type { UserSettings } from '@opz-hub/shared';

type BlockSettingsKey = 'hiddenTags' | 'hiddenKeywords' | 'blockedAuthors' | 'blockedPosts';

/**
 * 创建一个只在数组内容变化时才更新的 Set
 */
function createCachedSet(sourceRef: Ref<string[]>) {
  const cachedSet = shallowRef(new Set<string>());
  let lastArrayRef: string[] | null = null;

  return computed(() => {
    const arr = sourceRef.value;
    // 只有当数组引用变化时才重建 Set
    if (arr !== lastArrayRef) {
      lastArrayRef = arr;
      cachedSet.value = new Set(arr);
    }
    return cachedSet.value;
  });
}

/**
 * 创建乐观更新的屏蔽操作
 */
function createBlockActions(
  optimisticRef: Ref<string[]>,
  settingsKey: BlockSettingsKey,
  userStore: ReturnType<typeof useUserStore>
) {
  const isBlocked = (value: string) => optimisticRef.value.includes(value);

  async function block(value: string) {
    if (isBlocked(value)) return;
    const prev = [...optimisticRef.value];
    optimisticRef.value = [...prev, value];
    try {
      await userStore.updateSettings({ [settingsKey]: optimisticRef.value } as Partial<UserSettings>);
    } catch (error) {
      optimisticRef.value = prev;
      throw error;
    }
  }

  async function unblock(value: string) {
    if (!isBlocked(value)) return;
    const prev = [...optimisticRef.value];
    optimisticRef.value = prev.filter((v) => v !== value);
    try {
      await userStore.updateSettings({ [settingsKey]: optimisticRef.value } as Partial<UserSettings>);
    } catch (error) {
      optimisticRef.value = prev;
      throw error;
    }
  }

  return { isBlocked, block, unblock };
}

/**
 * 统一屏蔽管理 Store
 * 从 userStore.settings 读取屏蔽数据，提供乐观更新操作
 */
export const useBlocksStore = defineStore('blocks', () => {
  const userStore = useUserStore();

  // 乐观更新的本地状态
  const optimisticTags = ref<string[]>([]);
  const optimisticKeywords = ref<string[]>([]);
  const optimisticAuthors = ref<string[]>([]);
  const optimisticPosts = ref<string[]>([]);

  // 监听 userStore.settings 变化，同步到本地状态
  watch(
    () => userStore.settings,
    (settings) => {
      if (settings) {
        optimisticTags.value = settings.hiddenTags || [];
        optimisticKeywords.value = settings.hiddenKeywords || [];
        optimisticAuthors.value = settings.blockedAuthors || [];
        optimisticPosts.value = settings.blockedPosts || [];
      }
    },
    { immediate: true }
  );

  // 创建各类型的屏蔽操作
  const tagActions = createBlockActions(optimisticTags, 'hiddenTags', userStore);
  const keywordActions = createBlockActions(optimisticKeywords, 'hiddenKeywords', userStore);
  const authorActions = createBlockActions(optimisticAuthors, 'blockedAuthors', userStore);
  const postActions = createBlockActions(optimisticPosts, 'blockedPosts', userStore);

  // 缓存的 Set
  const blockedTagsSet = createCachedSet(optimisticTags);
  const blockedAuthorsSet = createCachedSet(optimisticAuthors);
  const blockedPostsSet = createCachedSet(optimisticPosts);

  return {
    // State
    blockedTags: computed(() => optimisticTags.value),
    blockedKeywords: computed(() => optimisticKeywords.value),
    blockedAuthors: computed(() => optimisticAuthors.value),
    blockedPosts: computed(() => optimisticPosts.value),

    // Set 形式
    blockedTagsSet,
    blockedAuthorsSet,
    blockedPostsSet,

    // Check methods
    isTagBlocked: tagActions.isBlocked,
    isKeywordBlocked: keywordActions.isBlocked,
    isAuthorBlocked: authorActions.isBlocked,
    isPostBlocked: postActions.isBlocked,

    // Actions
    blockTag: tagActions.block,
    unblockTag: tagActions.unblock,
    blockKeyword: keywordActions.block,
    unblockKeyword: keywordActions.unblock,
    blockAuthor: authorActions.block,
    unblockAuthor: authorActions.unblock,
    blockPost: postActions.block,
    unblockPost: postActions.unblock,
  };
});
