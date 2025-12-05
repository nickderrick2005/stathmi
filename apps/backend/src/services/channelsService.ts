import type { Channel, Tag } from '@opz-hub/shared';
import type { ChannelsRepository } from '../repositories/channelsRepository.js';

export class ChannelsService {
  constructor(private readonly repository: ChannelsRepository) {}

  async listChannels(): Promise<Channel[]> {
    return this.repository.listChannels();
  }

  async listChannelTags(channelId: string): Promise<Tag[]> {
    if (!channelId) {
      return [];
    }
    return this.repository.listTagsByChannel(channelId);
  }

  async listPopularTags(): Promise<Tag[]> {
    return this.repository.listPopularTags();
  }

  async listRecommendedTags(channelIds: string[], limit = 20): Promise<Tag[]> {
    if (!channelIds.length) {
      return [];
    }
    return this.repository.listRecommendedTags(channelIds, limit);
  }

  async getTagsByNames(tagNames: string[]): Promise<Tag[]> {
    if (!tagNames.length) {
      return [];
    }
    return this.repository.getTagsByNames(tagNames);
  }
}
