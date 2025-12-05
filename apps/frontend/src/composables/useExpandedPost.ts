import { ref, readonly, computed } from 'vue';
import type { Post } from '@opz-hub/shared';

/**
 * 卡片展开状态管理（单例模式）
 * 同时只能展开一张卡片
 */

// 模块级单例状态
const expandedPost = ref<Post | null>(null);
const cardRect = ref<DOMRect | null>(null);

export function useExpandedPost() {
  /**
   * 展开卡片
   */
  function expand(post: Post, rect: DOMRect) {
    expandedPost.value = post;
    cardRect.value = rect;
  }

  /**
   * 收起卡片
   */
  function collapse() {
    expandedPost.value = null;
    cardRect.value = null;
  }

  /**
   * 是否已展开
   */
  const isExpanded = computed(() => expandedPost.value !== null);

  return {
    expandedPost: readonly(expandedPost),
    cardRect: readonly(cardRect),
    isExpanded,
    expand,
    collapse,
  };
}
