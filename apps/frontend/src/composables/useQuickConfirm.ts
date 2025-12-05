import { ref, readonly } from 'vue';

interface QuickConfirmState {
  visible: boolean;
  message: string;
  x: number;
  y: number;
  resolve: ((value: boolean) => void) | null;
}

const state = ref<QuickConfirmState>({
  visible: false,
  message: '',
  x: 0,
  y: 0,
  resolve: null,
});

/**
 * 轻量确认气泡
 * 在点击位置附近显示确认/取消按钮
 */
export function useQuickConfirm() {
  /**
   * 显示确认气泡
   * @param event 点击事件（用于定位）
   * @param message 确认消息
   * @returns Promise<boolean> 用户确认返回 true，取消返回 false
   */
  function confirm(event: Event, message: string): Promise<boolean> {
    // 获取点击位置
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();

    return new Promise((resolve) => {
      state.value = {
        visible: true,
        message,
        x: rect.left + rect.width / 2,
        y: rect.top,
        resolve,
      };
    });
  }

  function handleConfirm() {
    state.value.resolve?.(true);
    close();
  }

  function handleCancel() {
    state.value.resolve?.(false);
    close();
  }

  function close() {
    state.value = {
      visible: false,
      message: '',
      x: 0,
      y: 0,
      resolve: null,
    };
  }

  return {
    state: readonly(state),
    confirm,
    handleConfirm,
    handleCancel,
    close,
  };
}
