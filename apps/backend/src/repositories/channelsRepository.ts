import type { Channel, Tag } from '@opz-hub/shared';

export interface ChannelsRepository {
  listChannels(): Promise<Channel[]>;
  getChannelById(channelId: string): Promise<Channel | null>;
  getChannelsByIds(channelIds: string[]): Promise<Channel[]>;
  listTagsByChannel(channelId: string): Promise<Tag[]>;
  listPopularTags(): Promise<Tag[]>;
  getTagById(tagId: string): Promise<Tag | null>;
  getTagsByIds(tagIds: string[]): Promise<Tag[]>;
  getTagsByNames(tagNames: string[]): Promise<Tag[]>;
  listRecommendedTags(channelIds: string[], limit?: number): Promise<Tag[]>;
}
