import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Channel, Tag } from '@opz-hub/shared';
import type { DB } from '../../types/database.js';
import type { ChannelsRepository } from '../channelsRepository.js';
import { wrapDbError } from '../../utils/dbErrors.js';
import { getAppConfig } from '../../config/app-config.js';

export class KyselyChannelsRepository implements ChannelsRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listChannels(): Promise<Channel[]> {
    return wrapDbError('KyselyChannelsRepository.listChannels', async () => {
      const { whitelistedChannelIds, channelMappings } = getAppConfig();

      if (!whitelistedChannelIds || whitelistedChannelIds.length === 0) {
        throw new Error(
          'Channel whitelist is empty. Please configure whitelistedChannelIds in apps/backend/config/channels.json'
        );
      }

      const rows = await this.db
        .selectFrom('channels')
        .innerJoin(
          (eb) =>
            eb
              .selectFrom('posts_main')
              .select(['channel_id', eb.fn.count<number>(sql`thread_id`).as('post_count')])
              .where('is_deleted', '=', false)
              .where('channel_id', 'in', whitelistedChannelIds)
              .groupBy('channel_id')
              .as('channel_post_counts'),
          (join) => join.onRef('channels.channel_id', '=', 'channel_post_counts.channel_id')
        )
        .select([
          'channels.channel_id',
          'channels.channel_name',
          'channels.guild_id',
          'channels.guild_name',
          'channel_post_counts.post_count',
        ])
        .where('channels.channel_id', 'in', whitelistedChannelIds)
        .orderBy('channel_post_counts.post_count', 'desc')
        .execute();

      return rows.map((row) => ({
        id: String(row.channel_id),
        name: channelMappings?.[String(row.channel_id)] ?? row.channel_name,
        guildId: String(row.guild_id),
        guildName: row.guild_name,
        postCount: Number(row.post_count),
      }));
    });
  }

  async getChannelById(channelId: string): Promise<Channel | null> {
    return wrapDbError('KyselyChannelsRepository.getChannelById', async () => {
      const { channelMappings } = getAppConfig();

      const row = await this.db
        .selectFrom('channels')
        .select(['channel_id', 'channel_name', 'guild_id', 'guild_name'])
        .where('channel_id', '=', channelId)
        .executeTakeFirst();

      if (!row) {
        return null;
      }

      return {
        id: String(row.channel_id),
        name: channelMappings?.[String(row.channel_id)] ?? row.channel_name,
        guildId: String(row.guild_id),
        guildName: row.guild_name,
        postCount: 0,
      };
    });
  }

  async getChannelsByIds(channelIds: string[]): Promise<Channel[]> {
    if (channelIds.length === 0) {
      return [];
    }
    return wrapDbError('KyselyChannelsRepository.getChannelsByIds', async () => {
      const { channelMappings } = getAppConfig();

      const rows = await this.db
        .selectFrom('channels')
        .select(['channel_id', 'channel_name', 'guild_id', 'guild_name'])
        .where('channel_id', 'in', channelIds)
        .execute();

      return rows.map((row) => ({
        id: String(row.channel_id),
        name: channelMappings?.[String(row.channel_id)] ?? row.channel_name,
        guildId: String(row.guild_id),
        guildName: row.guild_name,
        postCount: 0,
      }));
    });
  }

  async listTagsByChannel(channelId: string): Promise<Tag[]> {
    return wrapDbError('KyselyChannelsRepository.listTagsByChannel', async () => {
      const rows = await this.db
        .selectFrom('tags')
        .select(['tag_id', 'tag_name', 'channel_id', 'usage_count'])
        .where('channel_id', '=', channelId)
        .orderBy('usage_count', 'desc')
        .orderBy('tag_name', 'asc')
        .execute();

      return rows.map((row) => ({
        id: String(row.tag_id),
        name: row.tag_name,
        channelId: String(row.channel_id),
        usageCount: Number(row.usage_count ?? 0),
      }));
    });
  }

  async listPopularTags(): Promise<Tag[]> {
    return wrapDbError('KyselyChannelsRepository.listPopularTags', async () => {
      // 聚合相同名称的标签，计算总使用次数
      const rows = await this.db
        .selectFrom('tags')
        .select(['tag_name', this.db.fn.sum<number>('usage_count').as('total_usage')])
        .groupBy('tag_name')
        .orderBy('total_usage', 'desc')
        .limit(20)
        .execute();

      return rows.map((row, index) => ({
        id: `global-${index}`, // 虚拟 ID，因为聚合了
        name: row.tag_name,
        channelId: 'global',
        usageCount: Number(row.total_usage ?? 0),
      }));
    });
  }

  async getTagById(tagId: string): Promise<Tag | null> {
    return wrapDbError('KyselyChannelsRepository.getTagById', async () => {
      const row = await this.db
        .selectFrom('tags')
        .select(['tag_id', 'tag_name', 'channel_id', 'usage_count'])
        .where('tag_id', '=', tagId)
        .executeTakeFirst();

      if (!row) {
        return null;
      }

      return {
        id: String(row.tag_id),
        name: row.tag_name,
        channelId: String(row.channel_id),
        usageCount: Number(row.usage_count ?? 0),
      };
    });
  }

  async getTagsByIds(tagIds: string[]): Promise<Tag[]> {
    if (tagIds.length === 0) {
      return [];
    }
    return wrapDbError('KyselyChannelsRepository.getTagsByIds', async () => {
      const rows = await this.db
        .selectFrom('tags')
        .select(['tag_id', 'tag_name', 'channel_id', 'usage_count'])
        .where('tag_id', 'in', tagIds)
        .execute();

      return rows.map((row) => ({
        id: String(row.tag_id),
        name: row.tag_name,
        channelId: String(row.channel_id),
        usageCount: Number(row.usage_count ?? 0),
      }));
    });
  }

  async getTagsByNames(tagNames: string[]): Promise<Tag[]> {
    if (tagNames.length === 0) {
      return [];
    }
    return wrapDbError('KyselyChannelsRepository.getTagsByNames', async () => {
      const rows = await this.db
        .selectFrom('tags')
        .select(['tag_id', 'tag_name', 'channel_id', 'usage_count'])
        .where('tag_name', 'in', tagNames)
        .execute();

      return rows.map((row) => ({
        id: String(row.tag_id),
        name: row.tag_name,
        channelId: String(row.channel_id),
        usageCount: Number(row.usage_count ?? 0),
      }));
    });
  }

  async listRecommendedTags(channelIds: string[], limitPerChannel = 20): Promise<Tag[]> {
    if (channelIds.length === 0) {
      return [];
    }
    return wrapDbError('KyselyChannelsRepository.listRecommendedTags', async () => {
      // 使用窗口函数为每个频道分别获取 top N 标签
      // 这样确保每个频道都有代表性的标签返回
      const rows = await this.db
        .selectFrom(
          this.db
            .selectFrom('tags')
            .select([
              'tag_id',
              'tag_name',
              'channel_id',
              'usage_count',
              sql<number>`row_number() over (partition by channel_id order by usage_count desc)`.as('rn'),
            ])
            .where('channel_id', 'in', channelIds)
            .as('ranked')
        )
        .select(['tag_id', 'tag_name', 'channel_id', 'usage_count'])
        .where('rn', '<=', limitPerChannel)
        .execute();

      return rows.map((row) => ({
        id: String(row.tag_id),
        name: row.tag_name,
        channelId: String(row.channel_id),
        usageCount: Number(row.usage_count ?? 0),
      }));
    });
  }
}
