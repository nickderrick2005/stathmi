<script setup lang="ts">
import { NModal } from 'naive-ui';

defineProps<{
  show: boolean;
  firstUrl: string; // 首楼链接
  updateUrl: string; // 最新更新链接
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'selected', url: string): void;
}>();

function selectUrl(url: string) {
  emit('selected', url);
  emit('update:show', false);
}

function handleClose() {
  emit('update:show', false);
}
</script>

<template>
  <NModal :show="show" :mask-closable="true" @update:show="handleClose">
    <div class="prompt-modal">
      <h3 class="modal-title">选择跳转位置</h3>
      <p class="modal-desc">这篇帖子有更新，你想跳转到哪里？</p>

      <div class="option-list">
        <button type="button" class="option-card" @click="selectUrl(updateUrl)">
          <div class="option-icon update">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20V4M5 11l7-7 7 7" />
            </svg>
          </div>
          <div class="option-content">
            <span class="option-title">跳转到最新更新</span>
            <span class="option-desc">查看帖子最新内容</span>
          </div>
          <span class="option-tag recommend">推荐</span>
        </button>

        <button type="button" class="option-card" @click="selectUrl(firstUrl)">
          <div class="option-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div class="option-content">
            <span class="option-title">跳转到首楼</span>
            <span class="option-desc">从头开始阅读</span>
          </div>
        </button>
      </div>

      <p class="modal-hint">
        如果 Discord 无法正常打开，可以在「设置 → 浏览行为」中切换为浏览器模式
      </p>
    </div>
  </NModal>
</template>

<style scoped>
.prompt-modal {
  padding: 1.5rem;
  background: var(--opz-bg-base);
  border-radius: 12px;
  max-width: 400px;
  width: 90vw;
  margin: 1rem;
}

.modal-title {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.modal-desc {
  margin: 0 0 1.25rem;
  font-size: 0.9375rem;
  color: var(--opz-text-secondary);
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.option-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem;
  border-radius: 10px;
  border: 1.5px solid var(--opz-border);
  background: var(--opz-bg-base);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.option-card:hover {
  border-color: var(--opz-primary);
  background: var(--opz-bg-elevated);
}

.option-card:active {
  transform: scale(0.98);
}

.option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--opz-bg-elevated);
  color: var(--opz-text-secondary);
  flex-shrink: 0;
}

.option-icon.update {
  background: color-mix(in srgb, var(--opz-primary) 12%, var(--opz-bg-elevated));
  color: var(--opz-primary);
}

.option-card:hover .option-icon {
  background: color-mix(in srgb, var(--opz-primary) 15%, var(--opz-bg-elevated));
  color: var(--opz-primary);
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
  min-width: 0;
}

.option-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.option-desc {
  font-size: 0.8125rem;
  color: var(--opz-text-tertiary);
}

.option-tag {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 500;
  flex-shrink: 0;
}

.option-tag.recommend {
  background: color-mix(in srgb, var(--opz-primary) 15%, transparent);
  color: var(--opz-primary);
}

.modal-hint {
  margin: 1rem 0 0;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--opz-bg-elevated);
  font-size: 0.75rem;
  color: var(--opz-text-tertiary);
  line-height: 1.5;
}
</style>
