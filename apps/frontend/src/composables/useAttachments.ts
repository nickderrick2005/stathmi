/**
 * 附件处理 Composable
 */

import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import type { Post, Attachment } from '@opz-hub/shared';
import { getValidImages } from '@/utils/post-helpers';

export interface UseAttachmentsReturn {
  allImages: ComputedRef<Attachment[]>;
  coverImage: ComputedRef<string | null>;
  hasImages: ComputedRef<boolean>;
  imageCount: ComputedRef<number>;
}

export function useAttachments(postRef: MaybeRefOrGetter<Post>): UseAttachmentsReturn {
  const allImages = computed<Attachment[]>(() => getValidImages(toValue(postRef)));
  const coverImage = computed(() => allImages.value[0]?.url ?? null);
  const hasImages = computed(() => allImages.value.length > 0);
  const imageCount = computed(() => allImages.value.length);

  return { allImages, coverImage, hasImages, imageCount };
}
