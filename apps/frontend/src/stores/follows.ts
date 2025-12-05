import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { ChannelFollowResponse, FollowResponse, TagFollowResponse } from '@opz-hub/shared';
import {
  listFollows,
  followAuthor,
  unfollowAuthor,
  listTagFollows,
  followTag,
  unfollowTag,
  listChannelFollows,
  followChannel,
  unfollowChannel,
} from '@/api/follows';

/**
 * 关注管理 Store
 * 管理用户关注的作者、标签和频道，提供关注/取消关注操作
 *
 * 数据来源：从 /follows, /follows/tags, /follows/channels 接口加载
 * 副作用：关注操作会实时更新后端并刷新本地状态
 */
export const useFollowsStore = defineStore('follows', () => {
  const authorFollows = ref<FollowResponse[]>([]);
  const tagFollows = ref<TagFollowResponse[]>([]);
  const channelFollows = ref<ChannelFollowResponse[]>([]);
  const isLoading = ref(false);
  const hasLoadedAuthors = ref(false);
  const hasLoadedTags = ref(false);
  const hasLoadedChannels = ref(false);

  // 关注的作者 ID 集合
  const followedAuthorIds = computed(() => new Set(authorFollows.value.map((f) => f.authorId)));

  // 关注的标签 ID 集合
  const followedTagIds = computed(() => new Set(tagFollows.value.map((f) => f.tagId)));

  // 关注的标签名称集合
  const followedTagNames = computed(() => new Set(tagFollows.value.map((f) => f.tag.name)));

  // 关注的频道 ID 集合
  const followedChannelIds = computed(() => new Set(channelFollows.value.map((f) => f.channelId)));

  /**
   * 加载用户关注的作者列表
   */
  async function loadAuthorFollows(force = false) {
    if (hasLoadedAuthors.value && !force) {
      return authorFollows.value;
    }

    isLoading.value = true;
    try {
      const result = await listFollows();
      authorFollows.value = result;
      hasLoadedAuthors.value = true;
      return result;
    } catch (error) {
      console.error('[FollowsStore] Failed to load author follows:', error);
      // 静默失败，避免阻塞应用初始化
      hasLoadedAuthors.value = true;
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 加载用户关注的标签列表
   */
  async function loadTagFollows(force = false) {
    if (hasLoadedTags.value && !force) {
      return tagFollows.value;
    }

    isLoading.value = true;
    try {
      const result = await listTagFollows();
      tagFollows.value = result;
      hasLoadedTags.value = true;
      return result;
    } catch (error) {
      console.error('[FollowsStore] Failed to load tag follows:', error);
      // 静默失败，避免阻塞应用初始化
      hasLoadedTags.value = true;
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 加载用户关注的频道列表
   * TODO: 等待后端接口 /api/follows/channels
   */
  async function loadChannelFollows(force = false) {
    if (hasLoadedChannels.value && !force) {
      return channelFollows.value;
    }

    isLoading.value = true;
    try {
      const result = await listChannelFollows();
      channelFollows.value = result;
      hasLoadedChannels.value = true;
      return result;
    } catch (error) {
      console.error('[FollowsStore] Failed to load channel follows:', error);
      // 后端接口未实现时，静默失败
      hasLoadedChannels.value = true;
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 加载所有关注数据（作者 + 标签 + 频道）
   */
  async function loadAll(force = false) {
    await Promise.all([loadAuthorFollows(force), loadTagFollows(force), loadChannelFollows(force)]);
  }

  /**
   * 检查是否关注了某个作者
   */
  function isFollowingAuthor(authorId: string): boolean {
    return followedAuthorIds.value.has(authorId);
  }

  /**
   * 检查是否关注了某个频道
   */
  function isFollowingChannel(channelId: string): boolean {
    return followedChannelIds.value.has(channelId);
  }

  /**
   * 检查是否关注了某个标签（通过标签 ID）
   */
  function isFollowingTagById(tagId: string): boolean {
    return followedTagIds.value.has(tagId);
  }

  /**
   * 检查是否关注了某个标签（通过标签名称）
   */
  function isFollowingTagByName(tagName: string): boolean {
    return followedTagNames.value.has(tagName);
  }

  /**
   * 关注作者（乐观更新 + 失败回滚）
   */
  async function addAuthorFollow(authorId: string) {
    if (isFollowingAuthor(authorId)) {
      return;
    }

    // 乐观更新：立即添加到本地状态（仅需 authorId 用于 followedAuthorIds 判断）
    const optimisticFollow: FollowResponse = {
      authorId,
      createdAt: new Date().toISOString(),
      author: {
        id: authorId,
        username: '',
        avatar: '',
        discordRoles: [],
        joinedAt: '',
        followers: 0,
        following: 0,
      },
    };
    authorFollows.value = [...authorFollows.value, optimisticFollow];

    try {
      await followAuthor(authorId);
      // 后台刷新获取完整 author 信息（不阻塞 UI）
      loadAuthorFollows(true);
    } catch (error) {
      // 回滚
      authorFollows.value = authorFollows.value.filter((f) => f.authorId !== authorId);
      console.error('[FollowsStore] Failed to follow author:', error);
      throw error;
    }
  }

  /**
   * 取消关注作者（乐观更新 + 失败回滚）
   */
  async function removeAuthorFollow(authorId: string) {
    if (!isFollowingAuthor(authorId)) {
      return;
    }

    const originalFollows = [...authorFollows.value];
    authorFollows.value = authorFollows.value.filter((f) => f.authorId !== authorId);

    try {
      await unfollowAuthor(authorId);
    } catch (error) {
      authorFollows.value = originalFollows;
      console.error('[FollowsStore] Failed to unfollow author:', error);
      throw error;
    }
  }

  /**
   * 关注标签（乐观更新 + 失败回滚）
   */
  async function addTagFollow(tagId: string, tagName: string) {
    if (isFollowingTagById(tagId)) {
      return;
    }

    // 乐观更新：立即添加到本地状态
    const optimisticFollow: TagFollowResponse = {
      tagId,
      createdAt: new Date().toISOString(),
      tag: { id: tagId, name: tagName, channelId: '', usageCount: 0 },
    };
    tagFollows.value = [...tagFollows.value, optimisticFollow];

    try {
      await followTag(tagId);
    } catch (error) {
      // 回滚
      tagFollows.value = tagFollows.value.filter((f) => f.tagId !== tagId);
      console.error('[FollowsStore] Failed to follow tag:', error);
      throw error;
    }
  }

  /**
   * 取消关注标签（乐观更新 + 失败回滚）
   */
  async function removeTagFollow(tagId: string) {
    if (!isFollowingTagById(tagId)) {
      return;
    }

    const originalFollows = [...tagFollows.value];
    tagFollows.value = tagFollows.value.filter((f) => f.tagId !== tagId);

    try {
      await unfollowTag(tagId);
    } catch (error) {
      tagFollows.value = originalFollows;
      console.error('[FollowsStore] Failed to unfollow tag:', error);
      throw error;
    }
  }

  /**
   * 切换作者关注状态
   */
  async function toggleAuthorFollow(authorId: string) {
    if (isFollowingAuthor(authorId)) {
      await removeAuthorFollow(authorId);
    } else {
      await addAuthorFollow(authorId);
    }
  }

  /**
   * 切换标签关注状态
   */
  async function toggleTagFollow(tagId: string, tagName: string) {
    if (isFollowingTagById(tagId)) {
      await removeTagFollow(tagId);
    } else {
      await addTagFollow(tagId, tagName);
    }
  }

  /**
   * 关注频道（乐观更新 + 失败回滚）
   */
  async function addChannelFollow(channelId: string) {
    if (isFollowingChannel(channelId)) {
      return;
    }

    // 乐观更新：立即添加到本地状态（仅需 channelId 用于 followedChannelIds 计算）
    const optimisticFollow: ChannelFollowResponse = {
      channelId,
      createdAt: new Date().toISOString(),
      channel: { id: channelId, name: '', guildId: '', guildName: '', postCount: 0 },
    };
    channelFollows.value = [...channelFollows.value, optimisticFollow];

    try {
      await followChannel(channelId);
    } catch (error) {
      // 回滚
      channelFollows.value = channelFollows.value.filter((f) => f.channelId !== channelId);
      console.error('[FollowsStore] Failed to follow channel:', error);
      throw error;
    }
  }

  /**
   * 取消关注频道（乐观更新 + 失败回滚）
   */
  async function removeChannelFollow(channelId: string) {
    if (!isFollowingChannel(channelId)) {
      return;
    }

    const originalFollows = [...channelFollows.value];
    channelFollows.value = channelFollows.value.filter((f) => f.channelId !== channelId);

    try {
      await unfollowChannel(channelId);
    } catch (error) {
      channelFollows.value = originalFollows;
      console.error('[FollowsStore] Failed to unfollow channel:', error);
      throw error;
    }
  }

  /**
   * 切换频道关注状态
   */
  async function toggleChannelFollow(channelId: string) {
    if (isFollowingChannel(channelId)) {
      await removeChannelFollow(channelId);
    } else {
      await addChannelFollow(channelId);
    }
  }

  /**
   * 清空所有关注数据
   */
  function clear() {
    authorFollows.value = [];
    tagFollows.value = [];
    channelFollows.value = [];
    hasLoadedAuthors.value = false;
    hasLoadedTags.value = false;
    hasLoadedChannels.value = false;
  }

  return {
    authorFollows: computed(() => authorFollows.value),
    tagFollows: computed(() => tagFollows.value),
    channelFollows: computed(() => channelFollows.value),
    followedAuthorIds,
    followedTagIds,
    followedTagNames,
    followedChannelIds,
    isLoading: computed(() => isLoading.value),
    hasLoadedAuthors: computed(() => hasLoadedAuthors.value),
    hasLoadedTags: computed(() => hasLoadedTags.value),
    hasLoadedChannels: computed(() => hasLoadedChannels.value),
    loadAuthorFollows,
    loadTagFollows,
    loadChannelFollows,
    loadAll,
    isFollowingAuthor,
    isFollowingTagById,
    isFollowingTagByName,
    isFollowingChannel,
    addAuthorFollow,
    removeAuthorFollow,
    addTagFollow,
    removeTagFollow,
    addChannelFollow,
    removeChannelFollow,
    toggleAuthorFollow,
    toggleTagFollow,
    toggleChannelFollow,
    clear,
  };
});
