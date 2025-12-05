import { computed, reactive, type WritableComputedRef } from 'vue';
import type { PostSource } from './useFeed';

// 全局 segment 状态（模块级别，各路由独立保存）
const segmentState = reactive<Record<string, string>>({
  trending: 'trending-recommended',
  following: 'following-discord',
});

/**
 * 统一管理各 feed 页面的 segment 状态
 * AppLayout 和 View 组件共享同一份状态
 */
export function useFeedSegment<T extends string = string>(
  routeName: string
): WritableComputedRef<T> {
  return computed({
    get: () => segmentState[routeName] as T,
    set: (val: T) => {
      segmentState[routeName] = val;
    },
  });
}

// 类型化的 segment 访问
export function useTrendingSegment() {
  return useFeedSegment<PostSource>('trending');
}

export function useFollowingSegment() {
  return useFeedSegment<PostSource>('following');
}
