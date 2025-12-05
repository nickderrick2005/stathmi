<script setup lang="ts">
/**
 * 轻量确认气泡
 * 在点击位置附近显示确认/取消按钮
 */
import { computed, watch, ref, onMounted, onUnmounted } from 'vue';
import { useQuickConfirm } from '@/composables/useQuickConfirm';

const { state, handleConfirm, handleCancel, close } = useQuickConfirm();

const popoverRef = ref<HTMLElement | null>(null);

// 计算气泡位置（居中对齐，向上偏移）
const popoverStyle = computed(() => {
  if (!state.value.visible) return { display: 'none' };

  return {
    left: `${state.value.x}px`,
    top: `${state.value.y}px`,
  };
});

// 点击外部关闭
function handleClickOutside(e: MouseEvent) {
  if (popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
    handleCancel();
  }
}

// ESC 键关闭
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    handleCancel();
  }
}

watch(
  () => state.value.visible,
  (visible) => {
    if (visible) {
      // 延迟添加事件监听，避免立即触发
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleKeydown);
      }, 0);
    } else {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    }
  }
);

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="quick-confirm">
      <div v-if="state.visible" ref="popoverRef" class="quick-confirm-popover" :style="popoverStyle">
        <div class="quick-confirm-content">
          <span class="quick-confirm-message">{{ state.message }}</span>
          <div class="quick-confirm-actions">
            <button type="button" class="confirm-btn cancel" @click.stop="handleCancel">取消</button>
            <button type="button" class="confirm-btn primary" @click.stop="handleConfirm">确定</button>
          </div>
        </div>
        <div class="quick-confirm-arrow"></div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.quick-confirm-popover {
  position: fixed;
  z-index: 9999;
  transform: translate(-50%, -100%) translateY(-12px);
}

.quick-confirm-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  background: var(--opz-bg-elevated, #fff);
  border: 1px solid var(--opz-border);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.quick-confirm-message {
  font-size: 13px;
  color: var(--opz-text-primary);
  white-space: nowrap;
}

.quick-confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.confirm-btn {
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.confirm-btn.cancel {
  background: transparent;
  border: 1px solid var(--opz-border);
  color: var(--opz-text-secondary);
}

.confirm-btn.cancel:hover {
  background: var(--opz-bg-soft);
  border-color: var(--opz-text-tertiary);
}

.confirm-btn.primary {
  background: var(--opz-primary);
  border: 1px solid var(--opz-primary);
  color: #fff;
}

.confirm-btn.primary:hover {
  filter: brightness(1.1);
}

/* 箭头 */
.quick-confirm-arrow {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: var(--opz-bg-elevated, #fff);
  border-right: 1px solid var(--opz-border);
  border-bottom: 1px solid var(--opz-border);
  transform: translateX(-50%) rotate(45deg);
}

/* 过渡动画 */
.quick-confirm-enter-active,
.quick-confirm-leave-active {
  transition: all 0.15s ease;
}

.quick-confirm-enter-from,
.quick-confirm-leave-to {
  opacity: 0;
  transform: translate(-50%, -100%) translateY(-8px);
}
</style>
