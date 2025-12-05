<script setup lang="ts">
defineProps<{
  title: string;
  desc?: string;
  danger?: boolean;
  noBorder?: boolean;
}>();
</script>

<template>
  <section class="setting-item" :class="{ danger, 'no-border': noBorder }">
    <div class="item-header">
      <span class="item-title" :class="{ danger }">{{ title }}</span>
      <span v-if="desc" class="item-desc">{{ desc }}</span>
    </div>
    <slot />
    <slot name="hint" />
  </section>
</template>

<style scoped>
.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-item:not(:last-child):not(.no-border) {
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--opz-border);
}

.setting-item.danger {
  padding-top: 1rem;
  border-top: 1px dashed color-mix(in srgb, #ef4444 30%, var(--opz-border));
}

.item-header {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.item-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--opz-text-primary);
}

.item-title.danger {
  color: #ef4444;
}

.item-desc {
  font-size: 0.8125rem;
  color: var(--opz-text-tertiary);
}

@media (max-width: 639px) {
  .setting-item:not(:last-child):not(.no-border) {
    padding-bottom: 1rem;
  }
}
</style>
