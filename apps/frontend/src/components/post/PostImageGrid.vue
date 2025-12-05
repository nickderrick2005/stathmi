<script setup lang="ts">
/**
 * 多图拼接组件（Discord 风格）
 * 1张：全图
 * 2张：并排
 * 3张：左1大 + 右2小
 * 4张+：田字格 + 右下角 +N
 */
import { computed, ref, watch } from 'vue';
import type { Attachment } from '@opz-hub/shared';

const props = defineProps<{
  images: Attachment[];
  fallbackImage?: string;
  fallbackColor?: string;
}>();

const emit = defineEmits<{
  click: [];
}>();

// 图片加载失败状态（按索引记录）
const failedImages = ref<Set<number>>(new Set());

// 图片数组变化时重置失败状态
watch(
  () => props.images,
  () => {
    failedImages.value = new Set();
  }
);

// 是否所有图片都加载失败
const allImagesFailed = computed(() => {
  if (props.images.length === 0) return false;
  return failedImages.value.size >= props.images.length;
});

// 布局类型
const layoutType = computed(() => {
  const count = props.images.length;
  // 所有图片加载失败时使用回退图
  if (count === 0 || allImagesFailed.value) return props.fallbackImage ? 'fallback' : 'empty';
  if (count === 1) return 'single';
  if (count === 2) return 'double';
  if (count === 3) return 'triple';
  return 'quad';
});

// 显示的图片（最多4张）
const displayImages = computed(() => props.images.slice(0, 4));

// 超出4张时的额外数量
const extraCount = computed(() => Math.max(0, props.images.length - 4));

function handleClick(e: Event) {
  e.stopPropagation();
  emit('click');
}

// 图片加载失败处理
function handleImageError(index: number) {
  failedImages.value.add(index);
}
</script>

<template>
  <div
    class="post-image-grid"
    :class="[`grid-${layoutType}`]"
    :style="{ background: images.length === 0 ? fallbackColor : undefined }"
    @click="handleClick"
  >
    <!-- 无图但有默认图 -->
    <template v-if="layoutType === 'fallback'">
      <div class="grid-item full">
        <img :src="fallbackImage" loading="lazy" alt="默认图片" />
      </div>
    </template>

    <!-- 无图 -->
    <template v-else-if="layoutType === 'empty'">
      <div class="no-image-placeholder">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"/>
        </svg>
      </div>
    </template>

    <!-- 1张图 -->
    <template v-else-if="layoutType === 'single'">
      <div class="grid-item full">
        <img :src="displayImages[0]?.url" loading="lazy" alt="图片" @error="handleImageError(0)" />
      </div>
    </template>

    <!-- 2张图：并排 -->
    <template v-else-if="layoutType === 'double'">
      <div v-for="(img, i) in displayImages" :key="i" class="grid-item half">
        <img :src="img.url" loading="lazy" alt="图片" @error="handleImageError(i)" />
      </div>
    </template>

    <!-- 3张图：1大 + 2小 -->
    <template v-else-if="layoutType === 'triple'">
      <div class="grid-item large">
        <img :src="displayImages[0]?.url" loading="lazy" alt="图片" @error="handleImageError(0)" />
      </div>
      <div class="grid-side">
        <div v-for="(img, i) in displayImages.slice(1)" :key="i" class="grid-item small">
          <img :src="img.url" loading="lazy" alt="图片" @error="handleImageError(i + 1)" />
        </div>
      </div>
    </template>

    <!-- 4张+：田字格 -->
    <template v-else>
      <div v-for="(img, i) in displayImages" :key="i" class="grid-item quad">
        <img :src="img.url" loading="lazy" alt="图片" @error="handleImageError(i)" />
        <!-- 超出4张时显示 +N -->
        <div v-if="i === 3 && extraCount > 0" class="extra-count">
          +{{ extraCount }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.post-image-grid {
  width: 100%;
  height: 100%;
  display: grid;
  gap: 2px;
  overflow: hidden;
  cursor: pointer;
}

/* 无图占位 */
.no-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
}

.no-image-placeholder svg {
  width: 32px;
  height: 32px;
}

/* 单图/默认图：全屏 */
.grid-single,
.grid-fallback {
  grid-template: 1fr / 1fr;
}

/* 双图：并排 */
.grid-double {
  grid-template: 1fr / 1fr 1fr;
}

/* 三图：左大右小 */
.grid-triple {
  grid-template: 1fr / 1fr 1fr;
}

.grid-triple .grid-item.large {
  grid-row: span 1;
  height: 100%;
}

.grid-side {
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  height: 100%;
}

/* 四图+：田字格 */
.grid-quad {
  grid-template: 1fr 1fr / 1fr 1fr;
}

.grid-item {
  position: relative;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
  width: 100%;
  height: 100%;
}

.grid-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
  display: block;
}

.post-image-grid:hover .grid-item img {
  transform: scale(1.03);
}

.extra-count {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  backdrop-filter: blur(2px);
}
</style>
