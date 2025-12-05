<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function handleBack() {
  // 检查是否有可返回的历史记录（同源）
  if (window.history.state?.back) {
    router.back();
  } else {
    router.push('/');
  }
}
</script>

<template>
  <button type="button" class="back-btn" @click="handleBack">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12.5 15L7.5 10L12.5 5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="back-text">返回</span>
  </button>
</template>

<style scoped>
.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--opz-border-color);
  border-radius: 8px;
  background: var(--opz-bg-elevated);
  color: var(--opz-text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.back-btn:hover {
  background: var(--opz-bg-card);
}

.back-btn:active {
  transform: scale(0.95);
}

.back-btn svg {
  width: 20px;
  height: 20px;
}

.back-text {
  display: none;
}

@media (max-width: 768px) {
  .back-btn {
    width: auto;
    padding: 0 12px 0 8px;
    gap: 4px;
  }

  .back-text {
    display: inline;
    font-size: 14px;
  }
}
</style>
