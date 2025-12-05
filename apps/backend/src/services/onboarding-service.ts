import type { Kysely } from 'kysely';
import type { OnboardingPreferences, SuccessResponse } from '@opz-hub/shared';
import type { DB } from './db.js';
import { withTransaction } from './db.js';
import type { ChannelFollowsRepository } from '../repositories/channelFollowsRepository.js';
import type { TagFollowsRepository } from '../repositories/tagFollowsRepository.js';
import type { ChannelsRepository } from '../repositories/channelsRepository.js';

export class OnboardingService {
  constructor(
    private readonly db: Kysely<DB>,
    private readonly channelFollowsRepository: ChannelFollowsRepository,
    private readonly tagFollowsRepository: TagFollowsRepository,
    private readonly channelsRepository: ChannelsRepository
  ) {}

  async savePreferences(userId: string, preferences: OnboardingPreferences): Promise<SuccessResponse> {
    const orientations = Array.from(new Set((preferences.orientations ?? []).filter(Boolean)));
    const channelIds = Array.from(new Set((preferences.channelIds ?? []).filter(Boolean)));
    const tagIds = Array.from(new Set((preferences.tagIds ?? []).filter(Boolean)));
    const blockedTagNames = Array.from(new Set((preferences.blockedTagNames ?? []).filter(Boolean)));

    const tags = tagIds.length ? await this.channelsRepository.getTagsByIds(tagIds) : [];
    if (tagIds.length && tags.length !== tagIds.length) {
      throw new Error('TAG_NOT_FOUND');
    }

    await withTransaction(this.db, async (trx) => {
      await trx
        .withSchema('web_app')
        .updateTable('users')
        .set({
          orientations,
        })
        .where('discord_id', '=', userId)
        .execute();

      if (channelIds.length) {
        await this.channelFollowsRepository.upsertMany(userId, channelIds, trx);
      }

      for (const tag of tags) {
        await this.tagFollowsRepository.insert(userId, tag.id, trx);
      }

      // 保存屏蔽的标签到 user_settings.hidden_tags
      if (blockedTagNames.length) {
        await trx
          .withSchema('web_app')
          .updateTable('user_settings')
          .set({
            hidden_tags: blockedTagNames,
            updated_at: new Date(),
          })
          .where('user_id', '=', userId)
          .execute();
      }
    });

    return { success: true };
  }
}
