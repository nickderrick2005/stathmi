import { ref, watch } from 'vue';
import { useScroll } from '@vueuse/core';

/**
 * 滚动隐藏 composable
 * 向下滚动时隐藏，向上滚动或接近顶部时显示
 * @param threshold 距离顶部多少像素内始终显示（默认 100）
 */
export function useScrollHideOnDown(threshold = 100) {
  const { directions, y } = useScroll(window);
  const isVisible = ref(true);

  watch([() => directions.top, () => directions.bottom, y], () => {
    // 顶部始终可见
    if (y.value < threshold) {
      isVisible.value = true;
      return;
    }

    // 向上滚动可见，向下滚动隐藏
    if (directions.top) {
      isVisible.value = true;
    } else if (directions.bottom) {
      isVisible.value = false;
    }
  });

  return { isVisible };
}
