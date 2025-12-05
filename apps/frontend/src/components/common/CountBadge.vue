<script setup lang="ts">
withDefaults(
  defineProps<{
    count: number;
    variant?: 'default' | 'muted';
  }>(),
  {
    variant: 'default',
  }
);
</script>

<template>
  <span v-if="count > 0" class="count-badge" :class="`variant-${variant}`">
    {{ count }}
  </span>
</template>

<style scoped>
.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
}

.variant-default {
  background: var(--opz-primary);
  color: #fff;
}

.variant-muted {
  background: var(--opz-bg-soft);
  color: var(--opz-text-secondary);
}
</style>
