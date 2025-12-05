<script setup lang="ts">
import type { DisplayMode } from '@opz-hub/shared';

interface ModeOption {
  value: DisplayMode;
  label: string;
  desc: string;
}

defineProps<{
  modelValue: DisplayMode;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: DisplayMode];
}>();

const options: ModeOption[] = [
  { value: 'large', label: '卡片', desc: '大图展示，精致优雅' },
  { value: 'list', label: '列表', desc: '紧凑，高信息密度' },
  { value: 'minimal', label: '极简', desc: '纯文字，省流高速' },
];
</script>

<template>
  <div class="display-mode-grid">
    <button
      v-for="mode in options"
      :key="mode.value"
      type="button"
      class="display-mode-card"
      :class="{ active: modelValue === mode.value }"
      @click="emit('update:modelValue', mode.value)"
    >
      <!-- 示意图 -->
      <div class="mode-preview" :class="mode.value">
        <template v-if="mode.value === 'large'">
          <!-- 卡片模式：3 个竖向小卡片横排 -->
          <div class="preview-card"><span class="pill"></span></div>
          <div class="preview-card"><span class="pill"></span></div>
          <div class="preview-card"><span class="pill"></span></div>
        </template>
        <template v-else-if="mode.value === 'list'">
          <!-- 列表模式：文字在左，图在右 -->
          <div class="preview-row">
            <div class="preview-text">
              <div class="preview-line"></div>
              <div class="preview-line short"></div>
            </div>
            <div class="preview-thumb"></div>
          </div>
          <div class="preview-row">
            <div class="preview-text">
              <div class="preview-line"></div>
              <div class="preview-line short"></div>
            </div>
            <div class="preview-thumb"></div>
          </div>
        </template>
        <template v-else>
          <!-- 极简模式：纯文字行 -->
          <div class="preview-text-row"><span class="dot"></span><span class="text"></span></div>
          <div class="preview-text-row"><span class="dot"></span><span class="text"></span></div>
          <div class="preview-text-row"><span class="dot"></span><span class="text"></span></div>
        </template>
      </div>
      <div class="mode-info">
        <span class="mode-label">{{ mode.label }}</span>
        <span class="mode-desc">{{ mode.desc }}</span>
      </div>
    </button>
  </div>
</template>

<style scoped>
.display-mode-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.display-mode-card {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.75rem;
  border-radius: 10px;
  border: 1.5px solid var(--opz-border);
  background: var(--opz-bg-base);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.display-mode-card:hover {
  border-color: var(--opz-primary);
}

.display-mode-card.active {
  border-color: var(--opz-primary);
  background: color-mix(in srgb, var(--opz-primary) 8%, var(--opz-bg-base));
}

/* 示意图容器 */
.mode-preview {
  height: 72px;
  border-radius: 6px;
  background: var(--opz-bg-elevated);
  overflow: hidden;
  padding: 0.5rem;
}

/* 卡片模式示意 */
.mode-preview.large {
  display: flex;
  gap: 0.375rem;
  justify-content: center;
  align-items: stretch;
}

.mode-preview.large .preview-card {
  flex: 1;
  max-width: 28px;
  background: var(--opz-primary);
  opacity: 0.2;
  border-radius: 3px;
  position: relative;
}

.mode-preview.large .preview-card .pill {
  position: absolute;
  top: 4px;
  left: 3px;
  width: 10px;
  height: 4px;
  border-radius: 2px;
  background: var(--opz-bg-base);
  opacity: 0.9;
}

/* 列表模式示意 */
.mode-preview.list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  justify-content: center;
}

.mode-preview.list .preview-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

.mode-preview.list .preview-thumb {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: var(--opz-primary);
  opacity: 0.2;
  flex-shrink: 0;
}

.mode-preview.list .preview-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.mode-preview.list .preview-line {
  height: 6px;
  border-radius: 2px;
  background: var(--opz-text-tertiary);
  opacity: 0.4;
}

.mode-preview.list .preview-line.short {
  width: 60%;
  opacity: 0.25;
}

/* 极简模式示意 */
.mode-preview.minimal {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  justify-content: center;
}

.mode-preview.minimal .preview-text-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.mode-preview.minimal .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--opz-primary);
  opacity: 0.5;
}

.mode-preview.minimal .text {
  height: 6px;
  width: 80%;
  border-radius: 2px;
  background: var(--opz-text-tertiary);
  opacity: 0.35;
}

.mode-preview.minimal .preview-text-row:nth-child(2) .text {
  width: 65%;
}

.mode-preview.minimal .preview-text-row:nth-child(3) .text {
  width: 75%;
}

/* 模式信息 */
.mode-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.mode-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.mode-desc {
  font-size: 0.6875rem;
  color: var(--opz-text-tertiary);
  line-height: 1.3;
}

.display-mode-card.active .mode-label {
  color: var(--opz-primary);
}

@media (max-width: 480px) {
  .display-mode-grid {
    grid-template-columns: 1fr;
  }

  .display-mode-card {
    flex-direction: row;
    align-items: center;
  }

  .mode-preview {
    width: 80px;
    height: 56px;
    flex-shrink: 0;
  }

  .mode-info {
    flex: 1;
  }
}
</style>
