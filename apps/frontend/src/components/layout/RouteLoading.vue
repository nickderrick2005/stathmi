<script setup lang="ts">
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
</script>

<template>
  <div class="route-loading">
    <LoadingSpinner size="md" />
  </div>
</template>

<style scoped>
.route-loading {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
