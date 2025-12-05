import type { TagFollowResponse } from '@opz-hub/shared';
import type { TagFollowsRepository } from '../repositories/tagFollowsRepository.js';
import type { ChannelsRepository } from '../repositories/channelsRepository.js';

export class TagFollowsService {
  constructor(
    private readonly repository: TagFollowsRepository,
    private readonly channelsRepository: ChannelsRepository
  ) {}

  async list(userId: string): Promise<TagFollowResponse[]> {
    const records = await this.repository.list(userId);
    if (!records.length) {
      return [];
    }

    const tagIds = Array.from(new Set(records.map((record) => record.tagId)));
    const tags = await this.channelsRepository.getTagsByIds(tagIds);
    const tagMap = new Map(tags.map((tag) => [tag.id, tag]));

    return records
      .map((record) => {
        const tag = tagMap.get(record.tagId);
        if (!tag) {
          return undefined;
        }
        return {
          tagId: tag.id,
          createdAt: record.createdAt,
          tag,
        } satisfies TagFollowResponse;
      })
      .filter((item): item is TagFollowResponse => Boolean(item));
  }

  async listFollowedTagNames(userId: string): Promise<string[]> {
    const records = await this.repository.list(userId);
    if (!records.length) return [];
    const tags = await this.channelsRepository.getTagsByIds(Array.from(new Set(records.map((r) => r.tagId))));
    return Array.from(new Set(tags.map((tag) => tag.name)));
  }

  async add(userId: string, tagId: string): Promise<{ success: boolean; reason?: string }> {
    const tag = await this.channelsRepository.getTagById(tagId);
    if (!tag) {
      return { success: false, reason: 'TAG_NOT_FOUND' };
    }

    await this.repository.insert(userId, tagId);
    return { success: true };
  }

  async remove(userId: string, tagId: string): Promise<{ success: boolean; reason?: string }> {
    const removed = await this.repository.remove(userId, tagId);
    if (!removed) {
      return { success: false, reason: 'NOT_FOUND' };
    }
    return { success: true };
  }
}
