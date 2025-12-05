<script setup lang="ts">
/**
 * 通用 Chip 按钮组件
 * 统一项目中的 chip/pill 样式按钮
 */
import { computed } from 'vue';

type ChipVariant = 'default' | 'blocked' | 'skeleton' | 'closable';
type ChipSize = 'small' | 'medium';
type ChipShape = 'pill' | 'squared';

const props = withDefaults(
  defineProps<{
    /** 是否激活状态 */
    active?: boolean;
    /** 变体样式 */
    variant?: ChipVariant;
    /** 尺寸 */
    size?: ChipSize;
    /** 形状：pill 全圆角，squared 圆角矩形 */
    shape?: ChipShape;
    /** 是否禁用 */
    disabled?: boolean;
    /** 自定义宽度（skeleton 变体用） */
    width?: string;
  }>(),
  {
    active: false,
    variant: 'default',
    size: 'medium',
    shape: 'pill',
    disabled: false,
  }
);

const emit = defineEmits<{
  click: [event: MouseEvent];
  close: [event: MouseEvent];
}>();

const chipClass = computed(() => [
  'chip-button',
  `chip-${props.variant}`,
  `chip-${props.size}`,
  `chip-${props.shape}`,
  {
    'chip-active': props.active,
    'chip-disabled': props.disabled,
  },
]);

const chipStyle = computed(() => {
  if (props.width) {
    return { width: props.width };
  }
  return {};
});

function handleClick(event: MouseEvent) {
  if (props.disabled || props.variant === 'skeleton') return;
  emit('click', event);
}

function handleClose(event: MouseEvent) {
  event.stopPropagation();
  if (props.disabled) return;
  emit('close', event);
}
</script>

<template>
  <button
    type="button"
    :class="chipClass"
    :style="chipStyle"
    :disabled="disabled || variant === 'skeleton'"
    @click="handleClick"
  >
    <slot />
    <span v-if="variant === 'closable'" class="close-icon" @click="handleClose">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path
          d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
        />
      </svg>
    </span>
  </button>
</template>

<style scoped>
.chip-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: none;
  background: transparent;
  color: var(--opz-text-primary, var(--opz-text-primary));
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    transform 0.1s ease;
  user-select: none;
  white-space: nowrap;
}

/* 形状变体 */
.chip-pill {
  border-radius: 999px;
  background: color-mix(in srgb, var(--opz-bg-soft) 85%, transparent);
  border: 1px solid var(--opz-border);
  color: var(--opz-text-secondary);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
}

.chip-squared {
  border-radius: 10px;
  background: transparent;
}

/* 尺寸变体 */
.chip-medium {
  padding: 0.35rem 1rem;
  font-size: 0.9rem;
}

.chip-small {
  padding: 0.3rem 0.75rem;
  font-size: 0.8rem;
}

/* squared 尺寸微调（与翻页按钮对齐） */
.chip-squared.chip-medium {
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  font-size: 14px;
}

.chip-squared.chip-small {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  font-size: 13px;
}

/* 默认变体 - pill 形状 */
.chip-default.chip-pill:hover:not(.chip-disabled) {
  border-color: var(--opz-primary);
  color: var(--opz-text-primary);
}

.chip-default.chip-pill.chip-active {
  background: color-mix(in srgb, var(--opz-primary) 14%, var(--opz-bg-base));
  color: var(--opz-primary);
  border-color: var(--opz-primary);
  font-weight: 600;
  box-shadow:
    0 1px 3px color-mix(in srgb, var(--opz-primary) 20%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.chip-default.chip-pill.chip-active:hover:not(.chip-disabled) {
  background: color-mix(in srgb, var(--opz-primary) 18%, var(--opz-bg-base));
}

/* 默认变体 - squared 形状 */
.chip-default.chip-squared:hover:not(.chip-disabled):not(.chip-active) {
  background: var(--opz-bg-mute, #f2f2f2);
}

.chip-default.chip-squared:active:not(.chip-disabled) {
  transform: scale(0.95);
}

.chip-default.chip-squared.chip-active {
  background: var(--opz-primary, #5865f2);
  color: #fff;
  font-weight: 600;
  box-shadow:
    0 2px 8px color-mix(in srgb, var(--opz-primary, #5865f2) 35%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.chip-default.chip-squared.chip-active:hover:not(.chip-disabled) {
  background: color-mix(in srgb, var(--opz-primary, #5865f2) 90%, #000);
}

/* 屏蔽变体 */
.chip-blocked {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.chip-blocked:hover:not(.chip-disabled) {
  background: rgba(239, 68, 68, 0.15);
}

/* 可关闭变体 */
.chip-closable {
  padding-right: 0.5rem;
}

.chip-closable:hover:not(.chip-disabled) {
  border-color: var(--opz-primary);
  color: var(--opz-text-primary);
}

.close-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  margin-left: 0.15rem;
  border-radius: 50%;
  color: var(--opz-text-muted);
  transition: all 0.15s ease;
}

.close-icon svg {
  width: 0.75rem;
  height: 0.75rem;
}

.close-icon:hover {
  color: var(--opz-text-primary);
  background: var(--opz-bg-mute);
}

/* 骨架屏变体 */
.chip-skeleton {
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.08) 0%,
    rgba(148, 163, 184, 0.15) 50%,
    rgba(148, 163, 184, 0.08) 100%
  );
  background-size: 200% 100%;
  cursor: default;
  animation: chip-shimmer 1.8s ease-in-out infinite;
  min-height: 32px;
}

.chip-skeleton.chip-small {
  min-height: 28px;
}

/* Focus 可访问性 */
.chip-button:focus-visible {
  outline: 2px solid var(--opz-primary);
  outline-offset: 2px;
}

/* 禁用状态 */
.chip-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes chip-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 暗色主题适配 */
:root[data-theme='dark'] .chip-pill {
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15);
}

:root[data-theme='dark'] .chip-default.chip-pill.chip-active {
  box-shadow:
    0 1px 4px color-mix(in srgb, var(--opz-primary) 25%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

:root[data-theme='dark'] .chip-default.chip-squared:hover:not(.chip-disabled):not(.chip-active) {
  background: var(--opz-bg-mute, #282828);
}

:root[data-theme='dark'] .chip-default.chip-squared.chip-active {
  box-shadow:
    0 2px 12px color-mix(in srgb, var(--opz-primary, #5865f2) 40%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

:root[data-theme='dark'] .chip-skeleton {
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.05) 0%,
    rgba(148, 163, 184, 0.12) 50%,
    rgba(148, 163, 184, 0.05) 100%
  );
  background-size: 200% 100%;
}
</style>
