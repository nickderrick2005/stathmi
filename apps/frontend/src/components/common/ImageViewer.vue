<script setup lang="ts">
/**
 * 图片查看器组件 - 基于 Naive UI NImage
 * 全屏预览，支持缩放、旋转、多图切换
 */
import { ref, watch, nextTick } from 'vue';
import { NImage, NImageGroup } from 'naive-ui';
import type { Attachment } from '@opz-hub/shared';

const props = defineProps<{
  /** 是否显示 */
  show: boolean;
  /** 图片列表 */
  images: Attachment[];
  /** 初始显示的图片索引 */
  initialIndex?: number;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  close: [];
}>();

// 用于触发预览的图片元素引用
const imageRefs = ref<(HTMLImageElement | null)[]>([]);

// 设置图片引用
function setImageRef(el: unknown, index: number) {
  if (el && typeof el === 'object' && '$el' in el) {
    // NImage 组件实例，获取其 DOM 元素
    const instance = el as { $el: HTMLElement };
    const imgEl = instance.$el?.querySelector('img') as HTMLImageElement | null;
    imageRefs.value[index] = imgEl;
  }
}

// 监听 show 变化，触发对应图片的预览
watch(
  () => props.show,
  async (newShow) => {
    if (newShow && props.images.length > 0) {
      await nextTick();
      const idx = props.initialIndex ?? 0;
      const imgEl = imageRefs.value[idx];
      if (imgEl) {
        imgEl.click();
      }
    }
  }
);

// 处理预览关闭
function handlePreviewClose() {
  emit('update:show', false);
  emit('close');
}
</script>

<template>
  <!-- 仅在 show=true 时渲染图片，避免预加载 -->
  <div v-if="show" class="image-viewer-trigger" aria-hidden="true" @click.stop>
    <NImageGroup @close="handlePreviewClose">
      <NImage
        v-for="(image, index) in images"
        :key="image.url"
        :ref="(el) => setImageRef(el, index)"
        :src="image.url"
        :alt="`图片 ${index + 1}`"
        width="1"
        height="1"
      />
    </NImageGroup>
  </div>
</template>

<style scoped>
.image-viewer-trigger {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}
</style>
