<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ORIENTATION_OPTIONS } from '@/utils/constants';

const props = defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  save: [orientations: string[]];
}>();

const localValue = ref<string[]>([...props.modelValue]);

// 当外部基线值改变时同步（保存成功后 userStore 更新会触发）
watch(
  () => props.modelValue,
  (newVal) => {
    localValue.value = [...newVal];
  }
);

// 是否有变化（与基线比较）
const hasChanged = computed(() => {
  if (localValue.value.length !== props.modelValue.length) return true;
  return !localValue.value.every((v) => props.modelValue.includes(v));
});

function toggleOrientation(value: string) {
  const index = localValue.value.indexOf(value);
  if (index > -1) {
    localValue.value.splice(index, 1);
  } else {
    localValue.value.push(value);
  }
}

function handleSave() {
  emit('save', [...localValue.value]);
}
</script>

<template>
  <div class="orientation-card">
    <div class="card-header">
      <div class="header-info">
        <span class="header-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
            />
          </svg>
        </span>
        <span class="header-title">兴趣方向</span>
      </div>
    </div>

    <div class="card-content">
      <div class="orientation-grid">
        <button
          v-for="option in ORIENTATION_OPTIONS"
          :key="option.value"
          type="button"
          class="orientation-item"
          :class="{ active: localValue.includes(option.value) }"
          @click="toggleOrientation(option.value)"
        >
          <span class="item-check">
            <svg
              v-if="localValue.includes(option.value)"
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path
                d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
              />
            </svg>
          </span>
          <span class="item-label">{{ option.label }}</span>
          <span class="item-desc">{{ option.desc }}</span>
        </button>
      </div>

      <button v-if="hasChanged" type="button" class="save-btn" :disabled="localValue.length === 0" @click="handleSave">
        保存
      </button>
    </div>
  </div>
</template>

<style scoped>
.orientation-card {
  border: 1px solid var(--opz-border);
  border-radius: 12px;
  background: var(--opz-bg-card);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, color-mix(in srgb, var(--opz-accent) 8%, var(--opz-bg-base)), var(--opz-bg-base));
}

.header-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--opz-accent) 15%, transparent);
  color: var(--opz-accent);
  flex-shrink: 0;
}

.header-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.header-hint {
  font-size: 0.75rem;
  color: var(--opz-text-tertiary);
}

.card-content {
  padding: 1rem;
  border-top: 1px solid var(--opz-border);
}

.orientation-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

@media (min-width: 480px) {
  .orientation-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 768px) {
  .orientation-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

.orientation-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--opz-border);
  background: var(--opz-bg-base);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.orientation-item:hover {
  border-color: var(--opz-accent);
  background: var(--opz-bg-elevated);
}

.orientation-item.active {
  border-color: var(--opz-accent);
  background: color-mix(in srgb, var(--opz-accent) 10%, var(--opz-bg-base));
}

.item-check {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 1.5px solid var(--opz-border);
  background: transparent;
  color: transparent;
  transition: all 0.15s ease;
}

.orientation-item.active .item-check {
  border-color: var(--opz-accent);
  background: var(--opz-accent);
  color: #fff;
}

.item-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.item-desc {
  font-size: 0.6875rem;
  color: var(--opz-text-tertiary);
  line-height: 1.3;
}

.save-btn {
  margin-top: 0.75rem;
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  border: none;
  background: var(--opz-accent);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.save-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
