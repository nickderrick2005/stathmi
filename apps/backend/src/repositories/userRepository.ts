import {
  type Author,
  type AuthorAutocompleteItem,
  type ChannelStats,
  type UserName,
  type UserProfile,
  type UserSettings,
} from '@opz-hub/shared';

export interface UpsertUserParams {
  discordId: string;
  isAdmin: boolean;
}

export interface UpsertUserResult {
  id: string;
  username: string;
  nickname?: string;
  globalName?: string;
  avatar: string | null;
  orientations: string[];
  isAdmin: boolean;
  discordRoles: string[];
}

export interface UserRepository {
  getUserByDiscordId(discordId: string): Promise<UserProfile | null>;
  getUserById(userId: string): Promise<UserProfile | null>;
  createUser(data: { discordId: string }): Promise<UserProfile>;
  updateLastLogin(userId: string): Promise<void>;
  listAuthors(): Promise<Author[]>;
  getAuthorsByIds(authorIds: string[]): Promise<Author[]>;
  getUserSettings(userId: string): Promise<UserSettings | null>;
  updateUserSettings(userId: string, partial: Partial<UserSettings>): Promise<UserSettings>;
  createUserSettings(userId: string): Promise<UserSettings>;
  upsertUser(data: UpsertUserParams): Promise<UpsertUserResult>;
  updateUserOrientations(userId: string, orientations: string[]): Promise<void>;
  getFollowingFeedViewedAt(userId: string): Promise<string | null>;
  updateFollowingFeedViewedAt(userId: string, viewedAt: Date): Promise<void>;
  getUsersByIds(userIds: string[]): Promise<UserProfile[]>;
  getUserNamesByIds(userIds: string[]): Promise<UserName[]>;
  clearUserData(userId: string): Promise<void>;
  getUserPostStats(userId: string): Promise<{ totalLikes: number; totalComments: number; channelStats: ChannelStats[] }>;
  getUserFollowStats(userId: string): Promise<{ followers: number; following: number }>;
  getUserFirstPostAt(userId: string): Promise<string | null>;
  searchAuthors(query: string, limit: number): Promise<AuthorAutocompleteItem[]>;
}
