import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/user';
import { sanitizeCustomCss } from '@/utils/css-sanitizer';

/**
 * 用户自定义 CSS 管理
 *
 * 从 userStore.settings 中读取 customCss 字段并进行安全验证
 * 返回已清理的 CSS 字符串供 App.vue 注入
 */
export function useCustomCss() {
  const userStore = useUserStore();
  const { settings } = storeToRefs(userStore);

  // 经过清理和验证的自定义 CSS
  const sanitizedCustomCss = computed<string>(() => {
    const raw = settings.value?.customCss;
    if (!raw) {
      return '';
    }
    return sanitizeCustomCss(raw);
  });

  // 是否存在有效的自定义 CSS
  const hasCustomCss = computed<boolean>(() => Boolean(sanitizedCustomCss.value));

  return {
    sanitizedCustomCss,
    hasCustomCss,
  };
}
