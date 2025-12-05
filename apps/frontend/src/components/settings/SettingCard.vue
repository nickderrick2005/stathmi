<script setup lang="ts">
defineProps<{
  title: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  danger?: boolean; // 保留向后兼容
}>();
</script>

<template>
  <div class="setting-card" :class="[variant || (danger ? 'danger' : 'default')]">
    <div class="card-header">
      <h3 class="card-title">{{ title }}</h3>
    </div>
    <div class="card-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.setting-card {
  background: var(--opz-bg-elevated);
  border-radius: 12px;
  border: 1px solid var(--opz-border);
  overflow: hidden;
}

.card-header {
  padding: 0.875rem 1rem;
  background: var(--opz-bg-soft);
  border-bottom: 1px solid var(--opz-border);
}

.card-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--opz-text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-title::before {
  content: '';
  width: 3px;
  height: 1em;
  border-radius: 2px;
  background: var(--opz-text-tertiary);
}

/* 颜色变体 */
.setting-card.primary .card-title::before {
  background: var(--opz-primary);
}

.setting-card.success .card-title::before {
  background: var(--opz-success);
}

.setting-card.warning .card-title::before {
  background: var(--opz-warning);
}

.setting-card.danger {
  border-color: color-mix(in srgb, var(--opz-danger) 30%, var(--opz-border));
}

.setting-card.danger .card-title::before {
  background: var(--opz-danger);
}

.card-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

@media (max-width: 639px) {
  .card-header {
    padding: 0.75rem 0.875rem;
  }

  .card-body {
    padding: 0.875rem;
    gap: 1rem;
  }
}
</style>
