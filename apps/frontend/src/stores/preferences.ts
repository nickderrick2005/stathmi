import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { UserSettings, DiscordLinkMode, DisplayMode, PaginationStyle, ImageLoadMode } from '@opz-hub/shared';
import { useUserStore } from './user';

// 重新导出类型供其他模块使用
export type { DisplayMode, PaginationStyle, ImageLoadMode };

/**
 * UI 偏好设置 Store
 * 管理展示方式、分页方式、自定义 CSS 等用户界面偏好
 * 数据来源：从 userStore.settings 同步，修改时回写服务器
 * 注意：这些是默认设置，子页面可独立配置 session 级别的浏览模式
 */
export const usePreferencesStore = defineStore('preferences', () => {
  const displayMode = ref<DisplayMode>('large');
  const paginationStyle = ref<PaginationStyle>('scroll');
  const imageLoadMode = ref<ImageLoadMode>('all');
  const customCss = ref<string>('');
  const discordLinkMode = ref<DiscordLinkMode | undefined>(undefined);
  const cardTitleFontOffset = ref<number>(0);
  const cardContentFontOffset = ref<number>(0);
  const authorRoleColorEnabled = ref<boolean>(true);
  const isLoaded = ref(false);

  const userStore = useUserStore();

  // 从 userStore.settings 加载偏好设置
  function loadFromUserSettings(settings: UserSettings | null) {
    if (!settings) {
      return;
    }

    displayMode.value = settings.displayMode ?? 'large';
    paginationStyle.value = settings.paginationStyle ?? 'scroll';
    imageLoadMode.value = settings.imageLoadMode ?? 'all';
    customCss.value = settings.customCss ?? '';
    discordLinkMode.value = settings.discordLinkMode;
    cardTitleFontOffset.value = settings.cardTitleFontOffset ?? 0;
    cardContentFontOffset.value = settings.cardContentFontOffset ?? 0;
    authorRoleColorEnabled.value = settings.authorRoleColorEnabled ?? true;
    isLoaded.value = true;
  }

  // 更新展示方式
  async function updateDisplayMode(mode: DisplayMode) {
    displayMode.value = mode;
    try {
      await userStore.updateSettings({ displayMode: mode });
    } catch (error) {
      console.error('[Preferences] Failed to update displayMode', error);
      throw error;
    }
  }

  // 更新分页方式
  async function updatePaginationStyle(style: PaginationStyle) {
    paginationStyle.value = style;
    try {
      await userStore.updateSettings({ paginationStyle: style });
    } catch (error) {
      console.error('[Preferences] Failed to update paginationStyle', error);
      throw error;
    }
  }

  // 更新自定义 CSS
  async function updateCustomCss(css: string) {
    customCss.value = css;
    try {
      await userStore.updateSettings({ customCss: css });
    } catch (error) {
      console.error('[Preferences] Failed to update customCss', error);
      throw error;
    }
  }

  // 更新 Discord 链接打开方式
  async function updateDiscordLinkMode(mode: DiscordLinkMode) {
    discordLinkMode.value = mode;
    try {
      await userStore.updateSettings({ discordLinkMode: mode });
    } catch (error) {
      console.error('[Preferences] Failed to update discordLinkMode', error);
      throw error;
    }
  }

  // 更新卡片标题字体偏移
  async function updateCardTitleFontOffset(offset: number) {
    const clamped = Math.max(-3, Math.min(3, offset));
    cardTitleFontOffset.value = clamped;
    try {
      await userStore.updateSettings({ cardTitleFontOffset: clamped });
    } catch (error) {
      console.error('[Preferences] Failed to update cardTitleFontOffset', error);
      throw error;
    }
  }

  // 更新卡片内容字体偏移
  async function updateCardContentFontOffset(offset: number) {
    const clamped = Math.max(-3, Math.min(3, offset));
    cardContentFontOffset.value = clamped;
    try {
      await userStore.updateSettings({ cardContentFontOffset: clamped });
    } catch (error) {
      console.error('[Preferences] Failed to update cardContentFontOffset', error);
      throw error;
    }
  }

  // 更新作者角色颜色开关
  async function updateAuthorRoleColorEnabled(enabled: boolean) {
    authorRoleColorEnabled.value = enabled;
    try {
      await userStore.updateSettings({ authorRoleColorEnabled: enabled });
    } catch (error) {
      console.error('[Preferences] Failed to update authorRoleColorEnabled', error);
      throw error;
    }
  }

  // 更新图片加载模式
  async function updateImageLoadMode(mode: ImageLoadMode) {
    imageLoadMode.value = mode;
    try {
      await userStore.updateSettings({ imageLoadMode: mode });
    } catch (error) {
      console.error('[Preferences] Failed to update imageLoadMode', error);
      throw error;
    }
  }

  return {
    displayMode,
    paginationStyle,
    imageLoadMode,
    customCss,
    discordLinkMode,
    cardTitleFontOffset,
    cardContentFontOffset,
    authorRoleColorEnabled,
    isLoaded,
    loadFromUserSettings,
    updateDisplayMode,
    updatePaginationStyle,
    updateImageLoadMode,
    updateCustomCss,
    updateDiscordLinkMode,
    updateCardTitleFontOffset,
    updateCardContentFontOffset,
    updateAuthorRoleColorEnabled,
  };
});
