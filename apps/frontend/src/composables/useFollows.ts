import { useFollowsStore } from '@/stores/follows';
import { notifyError, notifySuccess } from '@/utils/notifications';

/**
 * 提供带 UI 反馈的关注切换操作
 * 状态查询直接使用 useFollowsStore
 *
 * 注：关注数据的预加载已移至 App.vue，在用户登录后统一加载
 */
export function useFollows() {
  const followsStore = useFollowsStore();

  /**
   * 切换作者关注状态，带 toast 反馈
   */
  async function toggleFollowAuthor(authorId: string): Promise<void> {
    const wasFollowing = followsStore.isFollowingAuthor(authorId);

    try {
      await followsStore.toggleAuthorFollow(authorId);
      notifySuccess(wasFollowing ? '已取消关注' : '已关注');
    } catch (error) {
      console.error('[useFollows] toggleFollowAuthor error:', error);
      notifyError(wasFollowing ? '取消关注失败' : '关注失败');
    }
  }

  /**
   * 切换标签关注状态，带 toast 反馈
   */
  async function toggleFollowTag(tagId: string, tagName: string): Promise<void> {
    const wasFollowing = followsStore.isFollowingTagById(tagId);

    try {
      await followsStore.toggleTagFollow(tagId, tagName);
      notifySuccess(wasFollowing ? '已取消关注标签' : '已关注标签');
    } catch (error) {
      console.error('[useFollows] toggleFollowTag error:', error);
      notifyError(wasFollowing ? '取消关注标签失败' : '关注标签失败');
    }
  }

  return {
    toggleFollowAuthor,
    toggleFollowTag,
  };
}
