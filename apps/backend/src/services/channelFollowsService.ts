import type { ChannelFollowResponse } from '@opz-hub/shared';
import type { ChannelFollowsRepository } from '../repositories/channelFollowsRepository.js';
import type { ChannelsRepository } from '../repositories/channelsRepository.js';

export class ChannelFollowsService {
  constructor(
    private readonly repository: ChannelFollowsRepository,
    private readonly channelsRepository: ChannelsRepository
  ) {}

  async list(userId: string): Promise<ChannelFollowResponse[]> {
    const records = await this.repository.list(userId);
    if (!records.length) {
      return [];
    }

    const channelIds = Array.from(new Set(records.map((record) => record.channelId)));
    const channels = await this.channelsRepository.getChannelsByIds(channelIds);
    const channelMap = new Map(channels.map((channel) => [channel.id, channel]));

    return records
      .map((record) => {
        const channel = channelMap.get(record.channelId);
        if (!channel) {
          return undefined;
        }
        return {
          channelId: record.channelId,
          createdAt: record.createdAt,
          channel,
        } satisfies ChannelFollowResponse;
      })
      .filter((item): item is ChannelFollowResponse => Boolean(item));
  }

  async listFollowedChannelIds(userId: string): Promise<string[]> {
    const records = await this.repository.list(userId);
    return records.map((record) => record.channelId);
  }

  async add(userId: string, channelId: string): Promise<{ success: boolean; reason?: string }> {
    const channel = await this.channelsRepository.getChannelById(channelId);
    if (!channel) {
      return { success: false, reason: 'CHANNEL_NOT_FOUND' };
    }

    await this.repository.insert(userId, channelId);
    return { success: true };
  }

  async remove(userId: string, channelId: string): Promise<{ success: boolean; reason?: string }> {
    const removed = await this.repository.remove(userId, channelId);
    if (!removed) {
      return { success: false, reason: 'NOT_FOUND' };
    }
    return { success: true };
  }
}
