<script setup lang="ts">
import BackButton from '@/components/common/BackButton.vue';

const props = defineProps<{
  eyebrow?: string;
  title?: string;
  description?: string;
  showBack?: boolean;
}>();
</script>

<template>
  <section class="view-shell">
    <header v-if="props.eyebrow || props.title || props.description || $slots.header || props.showBack">
      <slot name="header">
        <div v-if="props.showBack || props.title" class="header-row">
          <BackButton v-if="props.showBack" />
          <h1 v-if="props.title">{{ props.title }}</h1>
        </div>
        <p v-if="props.eyebrow" class="eyebrow">{{ props.eyebrow }}</p>
        <p v-if="props.description" class="placeholder">{{ props.description }}</p>
      </slot>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.view-shell {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.header-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.eyebrow {
  text-transform: uppercase;
  color: var(--opz-text-muted);
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

h1 {
  margin: 0;
}

.placeholder {
  color: var(--opz-text-muted);
}
</style>
