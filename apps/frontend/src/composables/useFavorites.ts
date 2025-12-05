/**
 * 收藏功能 composable
 *
 * 提供带 UI 反馈的收藏切换操作
 * 状态查询直接使用 useFavoritesStore
 *
 * 注：收藏数据的预加载已移至 App.vue，在用户登录后统一加载
 *
 * 使用示例：
 * ```ts
 * const favoritesStore = useFavoritesStore();
 * const { toggleFavorite } = useFavorites();
 *
 * // 检查是否收藏：使用 store
 * const isFav = favoritesStore.isFavorited(postId);
 *
 * // 切换收藏（带 toast）：使用 composable
 * await toggleFavorite(postId);
 * ```
 */
import { useFavoritesStore } from '@/stores/favorites';
import { notifyError, notifySuccess } from '@/utils/notifications';

export function useFavorites() {
  const favoritesStore = useFavoritesStore();

  /**
   * 防御性检查：确保收藏数据已加载
   * 正常流程下数据已在 App.vue 预加载，此处作为兜底
   */
  async function ensureLoaded() {
    if (favoritesStore.initialized || favoritesStore.loading) return;
    try {
      await favoritesStore.loadFavorites();
    } catch (error) {
      console.error('[useFavorites] fallback preload failed', error);
    }
  }

  /**
   * 切换收藏状态，带 toast 反馈
   */
  async function toggleFavorite(postId: string): Promise<void> {
    await ensureLoaded();
    const wasFavorited = favoritesStore.isFavorited(postId);

    try {
      await favoritesStore.toggleFavorite(postId);
      notifySuccess(wasFavorited ? '已取消收藏' : '已收藏');
    } catch {
      notifyError(wasFavorited ? '取消收藏失败' : '收藏失败');
    }
  }

  return {
    toggleFavorite,
  };
}
