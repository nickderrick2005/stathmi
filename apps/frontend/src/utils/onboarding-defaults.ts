/**
 * 用户引导默认配置
 * 根据用户选择的性向自动选择对应的频道
 */

// 所有用户默认选择的频道名称
export const DEFAULT_CHANNELS_FOR_ALL = ['纯净区', '全性向', '世界书', '酒馆美化', '酒馆工具', '预设破限', '教程教学'];

// 根据性向自动选择的频道映射
export const ORIENTATION_CHANNEL_MAP: Record<string, string[]> = {
  male: ['男性向', '科研心得'],
  female: ['女性向'],
  gay: ['男性向', '女性向', '小众区'],
  les: ['男性向', '女性向', '小众区'],
  'non-binary': ['小众区'],
};

/**
 * 根据选中的性向获取应该自动选择的频道名称列表
 * @param orientations 用户选择的性向列表
 * @returns 应该选择的频道名称列表（去重）
 */
export function getDefaultChannelsByOrientations(orientations: string[]): string[] {
  const channelNames = new Set<string>(DEFAULT_CHANNELS_FOR_ALL);

  for (const orientation of orientations) {
    const additionalChannels = ORIENTATION_CHANNEL_MAP[orientation] || [];
    additionalChannels.forEach((channel) => channelNames.add(channel));
  }

  return Array.from(channelNames);
}
