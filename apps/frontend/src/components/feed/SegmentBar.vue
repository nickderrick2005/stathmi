<script setup lang="ts">
import { useScrollHideOnDown } from '@/composables/useScrollHideOnDown';

export interface Segment {
  value: string;
  label: string;
  description?: string;
}

defineProps<{
  segments: Segment[];
}>();

const activeSegment = defineModel<string>('activeSegment', { required: true });

// 滚动交互：向下滚动时折叠，向上滚动时展开
const { isVisible } = useScrollHideOnDown();

function handleClick(value: string) {
  if (value === activeSegment.value) return;
  activeSegment.value = value;
}
</script>

<template>
  <div class="segment-bar-wrapper" :class="{ 'is-hidden': !isVisible }">
    <div class="segment-bar">
      <div class="scroll-container">
        <button
          v-for="segment in segments"
          :key="segment.value"
          class="segment-pill"
          :class="{ active: activeSegment === segment.value }"
          @click="handleClick(segment.value)"
        >
          <span class="pill-label">{{ segment.label }}</span>
          <span v-if="segment.description" class="pill-desc">{{ segment.description }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.segment-bar-wrapper {
  position: sticky;
  top: var(--opz-header-height);
  z-index: 19;
  background: var(--opz-bg-base);
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
  width: 100%;
  border-bottom: 1px solid var(--opz-border);
}

.segment-bar-wrapper.is-hidden {
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
}

.segment-bar {
  width: 100%;
  max-width: 2400px;
  margin: 0 auto;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.scroll-container {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  mask-image: linear-gradient(to right, black calc(100% - 24px), transparent 100%);
  -webkit-mask-image: linear-gradient(to right, black calc(100% - 24px), transparent 100%);
}

.scroll-container::-webkit-scrollbar {
  display: none;
}

@media (min-width: 768px) {
  .scroll-container {
    flex-wrap: wrap;
    overflow-x: visible;
    mask-image: none;
    -webkit-mask-image: none;
  }
}

.segment-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
  padding: 0.35rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--opz-border);
  background: var(--opz-bg-soft);
  color: var(--opz-text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  flex-shrink: 0;
}

.segment-pill:hover {
  background: var(--opz-bg-mute);
}

.segment-pill.active {
  background: var(--opz-text-primary);
  color: var(--opz-bg-base);
  border-color: var(--opz-text-primary);
}

.pill-label {
  font-size: 0.9rem;
  line-height: 1.2;
}

.pill-desc {
  font-size: 0.75rem;
  opacity: 0.85;
}
</style>
