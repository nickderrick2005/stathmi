import { ref } from 'vue';
import { usePreferencesStore } from '@/stores/preferences';

// 全局状态（跨组件共享）- 跳转位置选择弹窗
const showJumpPrompt = ref(false);
const pendingFirstUrl = ref('');
const pendingUpdateUrl = ref('');

/**
 * Discord 链接打开方式管理
 * 统一处理链接跳转逻辑和跳转位置选择弹窗
 */
export function useDiscordLink() {
  const preferencesStore = usePreferencesStore();

  /**
   * 执行 Discord 链接跳转（根据用户偏好选择 app/browser）
   */
  function executeJump(url: string) {
    if (!url) return;

    const mode = preferencesStore.discordLinkMode ?? 'browser';
    if (mode === 'browser') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // 转换为 Discord 深度链接，尝试唤起客户端
      // 使用隐藏 iframe 方式，避免 window.location.href 导致页面状态异常
      const deepLink = url.replace(/^https?:\/\//, 'discord://');
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = deepLink;
      document.body.appendChild(iframe);
      // 清理 iframe
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 100);
    }
  }

  /**
   * 打开 Discord 链接
   * 简单跳转，直接执行
   */
  function openDiscordLink(url: string) {
    if (!url) return;
    executeJump(url);
  }

  /**
   * 打开带更新链接的跳转选择
   * 如果有更新链接，显示选择弹窗；否则直接跳转首楼
   */
  function openWithJumpChoice(firstUrl: string, updateUrl: string | null) {
    if (!firstUrl) return;

    // 如果没有更新链接，直接跳转首楼
    if (!updateUrl) {
      executeJump(firstUrl);
      return;
    }

    // 有更新链接，显示选择弹窗
    pendingFirstUrl.value = firstUrl;
    pendingUpdateUrl.value = updateUrl;
    showJumpPrompt.value = true;
  }

  /**
   * 处理用户选择跳转位置后的回调
   */
  function handleJumpSelected(url: string) {
    executeJump(url);
    closeJumpPrompt();
  }

  /**
   * 关闭跳转位置选择弹窗
   */
  function closeJumpPrompt() {
    showJumpPrompt.value = false;
    pendingFirstUrl.value = '';
    pendingUpdateUrl.value = '';
  }

  return {
    // 跳转位置选择弹窗状态
    showJumpPrompt,
    pendingFirstUrl,
    pendingUpdateUrl,
    // 方法
    openDiscordLink,
    openWithJumpChoice,
    handleJumpSelected,
    closeJumpPrompt,
  };
}
