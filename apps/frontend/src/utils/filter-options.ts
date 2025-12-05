import type { Tag, WordMeta } from '@opz-hub/shared';
import { useMetadataStore } from '@/stores/metadata';

const GLOBAL_CHANNEL_ID = 'global';

function toTag(meta: WordMeta, channelId: string): Tag {
  return {
    id: `${channelId || GLOBAL_CHANNEL_ID}-${meta.word}`,
    name: meta.word,
    channelId: channelId || GLOBAL_CHANNEL_ID,
    usageCount: meta.score,
  };
}

// 获取频道的热词元数据（标签+关键词混合），使用 store 默认限制
async function getChannelWordMetaData(channelId: string) {
  const metadataStore = useMetadataStore();
  return channelId ? await metadataStore.getChannelWordMeta(channelId) : await metadataStore.getGlobalWordMeta();
}

// 从热词/标签元数据接口获取标签（按词频排序）
export async function getFeaturedTags(channelId: string): Promise<Tag[]> {
  const meta = await getChannelWordMetaData(channelId);
  return (meta ?? []).filter((item) => item.type === 'tag').map((item) => toTag(item, channelId));
}

// 从热词/标签元数据接口获取关键词（按词频排序）
export async function getHotKeywords(channelId: string): Promise<string[]> {
  const meta = await getChannelWordMetaData(channelId);
  return (meta ?? []).filter((item) => item.type === 'keyword').map((item) => item.word);
}
