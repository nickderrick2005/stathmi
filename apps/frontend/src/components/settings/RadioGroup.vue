<script setup lang="ts" generic="T extends string | boolean">
export interface RadioOption<V> {
  value: V;
  label: string;
  desc?: string;
}

defineProps<{
  options: RadioOption<T>[];
  modelValue: T | undefined;
  vertical?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: T];
}>();
</script>

<template>
  <div class="radio-group" :class="{ vertical }">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      class="radio-option"
      :class="{ active: modelValue === opt.value, compact: !opt.desc }"
      @click="emit('update:modelValue', opt.value)"
    >
      <span class="radio-check">✓</span>
      <template v-if="opt.desc">
        <div class="radio-content">
          <span class="radio-label">{{ opt.label }}</span>
          <span class="radio-desc">{{ opt.desc }}</span>
        </div>
      </template>
      <span v-else class="radio-label">{{ opt.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.radio-group {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.radio-group.vertical {
  flex-direction: column;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 0.875rem;
  border-radius: 8px;
  border: 1.5px solid var(--opz-border);
  background: var(--opz-bg-base);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.radio-option.compact {
  padding: 0.5rem 0.75rem;
  gap: 0.5rem;
}

.radio-option:hover {
  border-color: var(--opz-primary);
  background: var(--opz-bg-elevated);
}

.radio-option.active {
  border-color: var(--opz-primary);
  background: color-mix(in srgb, var(--opz-primary) 8%, var(--opz-bg-base));
}

.radio-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 50%;
  border: 2px solid var(--opz-border);
  font-size: 0.5rem;
  color: transparent;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.radio-option.active .radio-check {
  border-color: var(--opz-primary);
  background: var(--opz-primary);
  color: #fff;
}

.radio-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.radio-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--opz-text-primary);
}

.radio-desc {
  font-size: 0.75rem;
  color: var(--opz-text-tertiary);
}

@media (max-width: 639px) {
  .radio-option {
    padding: 0.625rem 0.75rem;
  }

  .radio-option.compact {
    padding: 0.5rem 0.625rem;
  }
}
</style>
