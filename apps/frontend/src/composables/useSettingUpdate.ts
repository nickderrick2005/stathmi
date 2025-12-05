import { ref } from 'vue';

/**
 * 通用设置更新逻辑
 * 封装 isSaving 状态和错误处理
 */
export function useSettingUpdate() {
  const isSaving = ref(false);

  async function update<T>(
    updateFn: () => Promise<T>,
    onError?: (e: unknown) => void
  ): Promise<T | undefined> {
    isSaving.value = true;
    try {
      return await updateFn();
    } catch (e) {
      onError?.(e);
      return undefined;
    } finally {
      isSaving.value = false;
    }
  }

  return { isSaving, update };
}
