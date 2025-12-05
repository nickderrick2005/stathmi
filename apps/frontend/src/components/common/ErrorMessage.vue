<script setup lang="ts">
const props = defineProps<{
  title?: string;
  message?: string;
  retry?: () => void | Promise<void>;
  compact?: boolean;
}>();

const emit = defineEmits<{
  retry: [];
}>();

async function handleRetry() {
  emit('retry');
  if (props.retry) {
    await props.retry();
  }
}
</script>

<template>
  <div class="error-message" :data-compact="props.compact ?? false" role="alert">
    <div class="text">
      <p class="title">{{ props.title || '加载失败' }}</p>
      <p v-if="props.message" class="desc">{{ props.message }}</p>
    </div>
    <button v-if="props.retry" type="button" class="retry" @click="handleRetry">重试</button>
  </div>
</template>

<style scoped>
.error-message {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 12px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.1), rgba(239, 68, 68, 0.08));
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: var(--opz-text-primary);
}

.error-message[data-compact='true'] {
  padding: 10px 12px;
}

.text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title {
  margin: 0;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--opz-danger);
}

.desc {
  margin: 0;
  color: var(--opz-text-secondary);
  font-size: 0.9rem;
}

.retry {
  border: 1px solid var(--opz-danger);
  background: var(--opz-danger);
  color: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.retry:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(239, 68, 68, 0.22);
}

.retry:active {
  transform: translateY(0);
  box-shadow: none;
}
</style>
