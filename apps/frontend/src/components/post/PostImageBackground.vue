<script setup lang="ts">
/**
 * 帖子背景图片组件
 * 支持多图轮播、滑动切换、懒加载
 */
import { ref, computed, watch } from 'vue';
import type { Attachment } from '@opz-hub/shared';
import { usePreferencesStore } from '@/stores/preferences';
import eyeOffIcon from '@/assets/icons/eye-off.svg';

const preferencesStore = usePreferencesStore();

// 判断是否为 GIF 图片
function isGifUrl(url: string): boolean {
  return /\.gif(\?|$)/i.test(url);
}

const props = defineProps<{
  images: Attachment[];
  fallbackImage?: string;
  fallbackColor?: string;
  /** 当前图片索引（v-model） */
  currentIndex?: number;
}>();

const emit = defineEmits<{
  'update:currentIndex': [index: number];
}>();

// 内部索引，支持 v-model 双向绑定
const internalIndex = ref(props.currentIndex ?? 0);

// 同步外部值到内部
watch(
  () => props.currentIndex,
  (val) => {
    if (val !== undefined && val !== internalIndex.value) {
      internalIndex.value = val;
    }
  }
);

// 更新索引并通知父组件
function setIndex(index: number) {
  internalIndex.value = index;
  emit('update:currentIndex', index);
}
const imageLoading = ref(true);
const imageError = ref(false);

const currentImage = computed(() => {
  if (props.images && props.images.length > 0 && props.images[internalIndex.value]) {
    return props.images[internalIndex.value];
  }
  return null;
});

// 根据 imageLoadMode 决定是否显示图片
const currentImageUrl = computed(() => {
  const mode = preferencesStore.imageLoadMode;
  const url = currentImage.value?.url || props.fallbackImage || null;

  if (!url) return null;

  // 不加载任何图片
  if (mode === 'none') return null;

  // 仅图片模式：GIF 不加载（显示为 fallback 背景）
  if (mode === 'images-only' && isGifUrl(url)) return null;

  return url;
});

// 是否因设置而隐藏了图片（用于 UI 提示）
const isImageHiddenBySettings = computed(() => {
  const mode = preferencesStore.imageLoadMode;
  const url = currentImage.value?.url || props.fallbackImage;
  if (!url) return false;
  if (mode === 'none') return true;
  if (mode === 'images-only' && isGifUrl(url)) return true;
  return false;
});

// 图片加载成功
function handleImageLoad() {
  imageLoading.value = false;
  imageError.value = false;
}

// 图片加载失败，静默回退到默认背景
function handleImageError() {
  imageLoading.value = false;
  imageError.value = true;
}

// 无图片时的背景色
const fallbackStyle = computed(() => ({
  background: props.fallbackColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
}));

function prevImage() {
  if (props.images.length <= 1) return;
  imageLoading.value = true;
  imageError.value = false;
  setIndex((internalIndex.value - 1 + props.images.length) % props.images.length);
}

function nextImage() {
  if (props.images.length <= 1) return;
  imageLoading.value = true;
  imageError.value = false;
  setIndex((internalIndex.value + 1) % props.images.length);
}

// 触摸滑动相关
const touchStartX = ref(0);
const touchEndX = ref(0);

function handleTouchStart(e: TouchEvent) {
  const touch = e.touches[0];
  if (touch) {
    touchStartX.value = touch.clientX;
  }
}

function handleTouchMove(e: TouchEvent) {
  const touch = e.touches[0];
  if (touch) {
    touchEndX.value = touch.clientX;
  }
}

function handleTouchEnd() {
  const diff = touchStartX.value - touchEndX.value;
  const threshold = 50;

  if (Math.abs(diff) > threshold) {
    if (diff > 0) {
      nextImage();
    } else {
      prevImage();
    }
  }

  touchStartX.value = 0;
  touchEndX.value = 0;
}

</script>

<template>
  <div
    class="post-image-background"
    :style="!currentImageUrl || imageError ? fallbackStyle : undefined"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- 图片隐藏提示 -->
    <div v-if="isImageHiddenBySettings" class="image-hidden-hint">
      <img :src="eyeOffIcon" alt="" />
    </div>

    <!-- 加载中动画 -->
    <div v-if="currentImageUrl && !imageError && imageLoading" class="loading-overlay">
      <div class="loading-spinner" />
    </div>

    <!-- 图片（加载失败时隐藏） -->
    <img
      v-if="currentImageUrl && !imageError"
      :src="currentImageUrl"
      loading="lazy"
      class="background-image"
      :class="{ loaded: !imageLoading }"
      alt=""
      @load="handleImageLoad"
      @error="handleImageError"
    />

    <!-- 右上角操作按钮插槽 -->
    <slot name="actions" />
  </div>
</template>

<style scoped>
.post-image-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.background-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.background-image.loaded {
  opacity: 1;
}

/* 加载动画 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.1);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 图片隐藏提示 */
.image-hidden-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.3;
}

.image-hidden-hint img {
  width: 32px;
  height: 32px;
}

:root[data-theme='dark'] .image-hidden-hint img {
  filter: invert(1);
}
</style>
