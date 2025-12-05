import { ref, onMounted, onUnmounted } from 'vue';

/**
 * 下拉刷新 composable
 * 仅在移动端且页面滚动到顶部时触发
 */
export function usePullRefresh(onRefresh: () => Promise<void>) {
  const isPulling = ref(false);
  const isRefreshing = ref(false);
  const pullDistance = ref(0);

  const THRESHOLD = 60; // 触发刷新的阈值
  const MAX_PULL = 100; // 最大下拉距离
  let startY = 0;
  let isAtTop = true;
  let isMounted = true;

  function onTouchStart(e: TouchEvent) {
    if (isRefreshing.value) return;
    isAtTop = window.scrollY <= 0;
    if (!isAtTop) return;
    startY = e.touches[0]?.clientY ?? 0;
    isPulling.value = true;
  }

  function onTouchMove(e: TouchEvent) {
    if (!isPulling.value || isRefreshing.value || !isAtTop) return;

    const currentY = e.touches[0]?.clientY ?? 0;
    const diff = currentY - startY;

    if (diff > 0) {
      // 阻力效果：下拉越多阻力越大
      pullDistance.value = Math.min(diff * 0.5, MAX_PULL);
      if (pullDistance.value > 10) {
        e.preventDefault();
      }
    }
  }

  async function onTouchEnd() {
    if (!isPulling.value) return;
    isPulling.value = false;

    if (pullDistance.value >= THRESHOLD && !isRefreshing.value) {
      isRefreshing.value = true;
      pullDistance.value = THRESHOLD; // 保持在阈值位置

      try {
        await onRefresh();
      } finally {
        // 组件已卸载则不再更新状态
        if (!isMounted) return;
        isRefreshing.value = false;
        pullDistance.value = 0;
      }
    } else {
      pullDistance.value = 0;
    }
  }

  onMounted(() => {
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  });

  onUnmounted(() => {
    isMounted = false;
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  });

  return {
    isPulling,
    isRefreshing,
    pullDistance,
    threshold: THRESHOLD,
  };
}
