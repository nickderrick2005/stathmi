import { onActivated, onDeactivated, onMounted, watch, ref, nextTick, type Ref } from 'vue';

// 全局滚动位置存储
const scrollPositions = new Map<string, number>();

/**
 * 为 KeepAlive 缓存的组件保存和恢复 window 滚动位置
 *
 * subKey 变化时只保存旧位置，不自动恢复新位置。
 * 调用者需在适当时机（如数据加载完成后）调用返回的 restoreNow 方法。
 *
 * @param key 存储键（通常是路由/组件名）
 * @param subKeyRef 可选的 segment key（如 source ref），用于每个 segment 独立保存位置
 */
export function useScrollRestore(key: string, subKeyRef?: Ref<string>) {
  // 待恢复的 subKey
  const pendingRestoreKey = ref<string | null>(null);

  function buildKey(subKey?: string): string {
    return subKey ? `${key}:${subKey}` : key;
  }

  function savePosition(subKey?: string) {
    scrollPositions.set(buildKey(subKey), window.scrollY);
  }

  function restorePosition(subKey?: string) {
    const fullKey = buildKey(subKey);
    const saved = scrollPositions.get(fullKey);

    // nextTick 确保 Vue DOM 更新完成，双 rAF 确保虚拟滚动内容渲染完成
    nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, saved ?? 0);
        });
      });
    });
  }

  /**
   * 手动触发滚动恢复
   * 如果有待恢复的 subKey，执行恢复并清除 pending 状态
   */
  function restoreNow() {
    if (pendingRestoreKey.value != null) {
      restorePosition(pendingRestoreKey.value);
      pendingRestoreKey.value = null;
    }
  }

  // 首次进入时恢复滚动位置
  onMounted(() => {
    restorePosition(subKeyRef?.value);
  });

  // 路由切换：保存/恢复当前 segment 的位置
  onDeactivated(() => {
    savePosition(subKeyRef?.value);
  });

  onActivated(() => {
    restorePosition(subKeyRef?.value);
  });

  // segment 切换：保存旧位置，记录待恢复 key
  if (subKeyRef) {
    watch(
      subKeyRef,
      (newVal, oldVal) => {
        if (oldVal == null || newVal === oldVal) return;
        savePosition(oldVal);
        pendingRestoreKey.value = newVal;
      },
      { flush: 'pre' }
    );
  }

  return {
    restoreNow,
    hasPendingRestore: pendingRestoreKey,
  };
}
