<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function goHome() {
  router.push('/');
}
</script>

<template>
  <div class="notfound-page">
    <div class="notfound-container">
      <img src="/default-img/404.png" alt="404 Not Found" class="notfound-img" />
      <button type="button" class="home-btn" @click="goHome">返回首页</button>
    </div>
  </div>
</template>

<style scoped>
.notfound-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: var(--opz-bg-base);
}

.notfound-container {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.notfound-img {
  max-width: 320px;
  width: 100%;
  height: auto;
}

.home-btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 10px;
  background: var(--opz-primary);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.home-btn:hover {
  opacity: 0.9;
}

@media (max-width: 480px) {
  .notfound-img {
    max-width: 260px;
  }
}
</style>
