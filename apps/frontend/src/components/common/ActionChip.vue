<script setup lang="ts">
defineProps<{
  label: string;
  variant?: 'default' | 'active' | 'blocked';
  actionTitle?: string;
}>();

const emit = defineEmits<{
  click: [];
  action: [];
}>();
</script>

<template>
  <span class="action-chip" :class="variant">
    <button type="button" class="chip-main" @click="emit('click')">
      {{ label }}
    </button>
    <button type="button" class="chip-action" :title="actionTitle" @click="emit('action')">
      &times;
    </button>
  </span>
</template>

<style scoped>
.action-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 5px;
  border: 1px solid var(--opz-border);
  background: transparent;
  overflow: hidden;
  transition: border-color 0.15s ease;
  user-select: none;
}

.action-chip:hover {
  border-color: var(--opz-primary);
}

.action-chip.active {
  border-color: var(--opz-primary);
  background: color-mix(in srgb, var(--opz-primary) 12%, var(--opz-bg-base));
}

.action-chip.blocked {
  border-color: color-mix(in srgb, var(--opz-danger) 40%, var(--opz-border));
  background: color-mix(in srgb, var(--opz-danger) 6%, var(--opz-bg-base));
}

.action-chip.blocked:hover {
  border-color: var(--opz-danger);
}

.chip-main {
  padding: 0.25rem 0.4rem;
  border: none;
  background: transparent;
  color: var(--opz-text-primary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease;
}

.action-chip:hover .chip-main {
  color: var(--opz-text-primary);
}

.action-chip.active .chip-main {
  color: var(--opz-primary);
}

.action-chip.blocked .chip-main {
  color: var(--opz-text-tertiary);
}

.action-chip.blocked:hover .chip-main {
  color: var(--opz-danger);
}

.chip-action {
  padding: 0.25rem 0.3rem;
  border: none;
  border-left: 1px solid var(--opz-border);
  background: transparent;
  color: var(--opz-text-secondary);
  font-size: 0.875rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chip-action:hover {
  background: color-mix(in srgb, var(--opz-danger) 12%, transparent);
  color: var(--opz-danger);
}

.action-chip.active .chip-action {
  border-left-color: color-mix(in srgb, var(--opz-primary) 30%, var(--opz-border));
}

.action-chip.blocked .chip-action {
  border-left-color: color-mix(in srgb, var(--opz-danger) 30%, var(--opz-border));
}

.action-chip.blocked .chip-action:hover {
  background: color-mix(in srgb, var(--opz-success) 15%, transparent);
  color: var(--opz-success);
}
</style>
