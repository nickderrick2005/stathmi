import { defineStore } from 'pinia';
import type { FavoriteResponse } from '@opz-hub/shared';
import { listFavorites, addFavorite, removeFavorite } from '@/api/favorites';

// 开发环境测试帖 ID，用于视觉回归验证收藏态
const DEV_TEST_POST_ID = 'post_main_test';

interface FavoritesState {
  favoritePostIds: Set<string>;
  favorites: FavoriteResponse[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

export const useFavoritesStore = defineStore('favorites', {
  state: (): FavoritesState => ({
    // DEV 环境默认点亮测试帖的收藏态，方便视觉回归
    favoritePostIds: import.meta.env.DEV ? new Set([DEV_TEST_POST_ID]) : new Set<string>(),
    favorites: [],
    loading: false,
    error: null,
    initialized: false,
  }),
  getters: {
    isFavorited: (state) => (postId: string) => state.favoritePostIds.has(postId),
  },
  actions: {
    replaceFavoriteIds(ids: Iterable<string>) {
      this.favoritePostIds = new Set(ids);
    },
    markLocal(postId: string) {
      if (this.favoritePostIds.has(postId)) return;
      this.favoritePostIds = new Set([...this.favoritePostIds, postId]);
    },
    unmarkLocal(postId: string) {
      if (!this.favoritePostIds.has(postId)) return;
      const next = new Set(this.favoritePostIds);
      next.delete(postId);
      this.favoritePostIds = next;
    },
    async loadFavorites() {
      if (this.loading) return;
      this.loading = true;
      this.error = null;
      try {
        // 同步后端收藏集合，防止前端乐观状态漂移
        const records = await listFavorites();
        this.favorites = records;
        const ids = new Set(records.map((item) => item.postId));
        if (import.meta.env.DEV) {
          ids.add(DEV_TEST_POST_ID);
        }
        this.favoritePostIds = ids;
        this.initialized = true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : '加载收藏失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async addFavorite(postId: string) {
      await addFavorite(postId);
      this.markLocal(postId);
    },
    async removeFavorite(postId: string) {
      await removeFavorite(postId);
      this.unmarkLocal(postId);
    },
    /**
     * 切换收藏状态（乐观更新 + 自动回滚）
     */
    async toggleFavorite(postId: string) {
      const previous = new Set(this.favoritePostIds);
      const alreadyFavorited = this.isFavorited(postId);

      // 乐观更新
      if (alreadyFavorited) {
        this.unmarkLocal(postId);
      } else {
        this.markLocal(postId);
      }

      try {
        if (alreadyFavorited) {
          await removeFavorite(postId);
        } else {
          await addFavorite(postId);
        }
      } catch (error) {
        // 回滚
        this.replaceFavoriteIds(previous);
        throw error;
      }
    },
  },
});
