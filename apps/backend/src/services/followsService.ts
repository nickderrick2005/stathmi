import type { FollowResponse } from '@opz-hub/shared';
import type { FollowsRepository } from '../repositories/followsRepository.js';
import type { UserRepository } from '../repositories/userRepository.js';

export class FollowsService {
  constructor(
    private readonly repository: FollowsRepository,
    private readonly userRepository: UserRepository
  ) {}

  /**
   * 检查作者是否存在（优先查用户表，其次查帖子表）
   */
  private async isValidAuthor(authorId: string): Promise<boolean> {
    // 先检查是否是注册用户
    const user = await this.userRepository.getUserById(authorId);
    if (user) return true;

    // 再检查是否发过帖子（未注册但有发帖记录的作者）
    return this.repository.authorExists(authorId);
  }

  public async list(userId: string): Promise<FollowResponse[]> {
    const records = await this.repository.list(userId);
    if (records.length === 0) return [];

    // 只获取关注的作者信息，避免获取全部用户
    const authorIds = records.map((r) => r.authorId);
    const authors = await this.userRepository.getAuthorsByIds(authorIds);
    const authorMap = new Map(authors.map((author) => [author.id, author] as const));

    // 查找未在 user_data 中的作者（可能只发过帖子但未在 user_data 表中）
    const missingAuthorIds = authorIds.filter((id) => !authorMap.has(id));
    if (missingAuthorIds.length > 0) {
      // 批量获取缺失作者的基本信息
      const basicInfos = await Promise.all(
        missingAuthorIds.map((id) => this.repository.getAuthorBasicInfo(id))
      );
      for (let i = 0; i < missingAuthorIds.length; i++) {
        const info = basicInfos[i];
        if (info) {
          authorMap.set(missingAuthorIds[i], {
            id: info.id,
            username: info.username,
            nickname: info.nickname,
            globalName: info.globalName,
            avatar: '',
            discordRoles: [],
            joinedAt: new Date().toISOString(),
            followers: 0,
            following: 0,
          });
        }
      }
    }

    return records
      .map((record) => {
        const author = authorMap.get(record.authorId);
        return author ? { ...record, author } : null;
      })
      .filter((r): r is FollowResponse => r !== null);
  }

  public async listAuthorIds(userId: string): Promise<string[]> {
    const records = await this.repository.list(userId);
    return Array.from(new Set(records.map((record) => record.authorId)));
  }

  public async add(userId: string, authorId: string): Promise<{ success: boolean; reason?: string }> {
    if (!authorId) {
      return { success: false, reason: 'AUTHOR_ID_REQUIRED' };
    }

    if (await this.repository.exists(userId, authorId)) {
      return { success: true };
    }

    // 检查作者是否存在（注册用户或发过帖子的作者）
    const isValid = await this.isValidAuthor(authorId);
    if (!isValid) {
      return { success: false, reason: 'AUTHOR_NOT_FOUND' };
    }

    await this.repository.insert(userId, authorId);
    return { success: true };
  }

  public async remove(userId: string, authorId: string): Promise<{ success: boolean; reason?: string }> {
    if (!authorId) {
      return { success: false, reason: 'AUTHOR_ID_REQUIRED' };
    }

    const removed = await this.repository.remove(userId, authorId);
    if (!removed) {
      return { success: false, reason: 'NOT_FOUND' };
    }
    return { success: true };
  }
}
