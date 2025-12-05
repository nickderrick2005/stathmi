import type { Kysely } from 'kysely';
import type { HotWord, HotWordsMetaResponse, HotWordsResponse, WordMeta, ChannelWordMeta } from '@opz-hub/shared';
import nodejieba from 'nodejieba';
import { getRedis } from '../lib/redis.js';
import type { DB } from '../types/database.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export class HotWordsService {
  private readonly decayFactor = 0.9;
  private readonly searchRetentionDays: number;
  private readonly contentRetentionDays: number;
  private readonly userDictPath: string | null;
  private readonly blacklistPath: string | null;
  private readonly mappingPath: string | null;
  private readonly aliasPath: string | null;
  private readonly stopwordsPath: string | null;

  private static readonly DEFAULT_STOP_WORDS = [
    '的',
    '了',
    '是',
    '在',
    '和',
    '有',
    '我',
    '不',
    '这',
    '你',
    '们',
    '他',
    '她',
    '它',
    '吗',
    '吧',
    '啊',
    '呢',
    '着',
    '过',
    '为',
    '与',
    '及',
    '于',
    '则',
    '而',
    '或',
    '等',
    '对',
    '从',
    '帖子',
    '楼主',
    '内容',
    '标题',
    '今天',
    '昨天',
    '明天',
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
  ];

  private STOP_WORDS = new Set(HotWordsService.DEFAULT_STOP_WORDS);
  private blacklist = new Set<string>();
  private mapping = new Map<string, { canonical: string; type?: 'keyword' | 'tag'; weight?: number }>();
  private dictionariesLoaded = false;

  constructor(private readonly db: Kysely<DB>) {
    this.searchRetentionDays = this.getEnvNumber('HOTWORDS_SEARCH_RETENTION_DAYS', 3, 1);
    this.contentRetentionDays = this.getEnvNumber('HOTWORDS_CONTENT_RETENTION_DAYS', 14, 1);
    const dictEnv = process.env.HOTWORDS_USERDICT_PATH;
    const blacklistEnv = process.env.HOTWORDS_BLACKLIST_PATH;
    const mappingEnv = process.env.HOTWORDS_MAPPING_PATH;
    const aliasEnv = process.env.HOTWORDS_ALIAS_PATH;
    const stopwordsEnv = process.env.HOTWORDS_STOPWORDS_PATH;
    const thisFileDir = path.dirname(fileURLToPath(import.meta.url));
    const resourcesDir = path.resolve(thisFileDir, '..', '..', '..', '..', 'packages', 'resources', 'hotwords');
    const defaultDict = path.join(resourcesDir, 'hotwords.userdict.txt');
    const defaultBlacklist = path.join(resourcesDir, 'hotwords.blacklist.txt');
    const defaultMapping = path.join(resourcesDir, 'hotwords.mapping.json');
    const defaultAlias = path.join(resourcesDir, 'word_aliases.txt');
    const defaultStopwords = path.join(resourcesDir, 'stopwords.txt');
    this.userDictPath = dictEnv ? path.resolve(dictEnv) : defaultDict;
    this.blacklistPath = blacklistEnv ? path.resolve(blacklistEnv) : defaultBlacklist;
    this.mappingPath = mappingEnv ? path.resolve(mappingEnv) : defaultMapping;
    this.aliasPath = aliasEnv ? path.resolve(aliasEnv) : defaultAlias;
    this.stopwordsPath = stopwordsEnv ? path.resolve(stopwordsEnv) : defaultStopwords;
  }

  // Helper to safely get redis instance
  private get redis() {
    return getRedis();
  }

  // ----------------------
  // 热搜：记录用户搜索（原句 + 词级）
  // ----------------------

  async recordSearch(query: string): Promise<void> {
    await this.ensureDictionariesLoaded();
    const redis = this.redis;
    if (!redis) return;

    const normalized = this.normalizeQuery(query);
    if (!normalized) return;

    const today = new Date().toISOString().split('T')[0];
    const queryKey = `hot:search:query:${today}`;
    const tokenKey = `hot:search:tokens:${today}`;

    const tokens = this.tokenizeSearch(normalized);

    const pipeline = redis.pipeline();
    pipeline.zincrby(queryKey, 1, normalized);
    pipeline.expire(queryKey, this.searchRetentionDays * 24 * 3600);

    if (tokens.length > 0) {
      for (const token of tokens) {
        pipeline.zincrby(tokenKey, 1, token);
      }
      pipeline.expire(tokenKey, this.searchRetentionDays * 24 * 3600);
    }

    await pipeline.exec();
  }

  async getHotSearch(limit = 10): Promise<HotWordsResponse> {
    const redis = this.redis;
    if (!redis) {
      return {
        hotSearchQuery: [],
        hotSearchTokens: [],
        highFrequency: [],
        updatedAt: new Date().toISOString(),
      };
    }

    const [hotSearchQuery, hotSearchTokens] = await Promise.all([
      this.getTopWords('hot:search:query:aggregated', limit),
      this.getTopWords('hot:search:tokens:aggregated', limit),
    ]);

    return {
      hotSearchQuery,
      hotSearchTokens,
      highFrequency: [],
      updatedAt: new Date().toISOString(),
    };
  }

  async getHotWordsMeta(limitGlobal = 20, perChannelLimit = 20): Promise<HotWordsMetaResponse> {
    const redis = this.redis;
    if (!redis) {
      return { global: [], channels: [], updatedAt: new Date().toISOString() };
    }

    const [globalKeywords, globalTags, channelIds] = await Promise.all([
      this.getTopWords('hot:content:aggregated', limitGlobal),
      this.getTopTags(undefined, limitGlobal),
      redis.smembers('hot:content:channels'),
    ]);

    const globalMeta = this.mergeWordMetas(globalKeywords, globalTags, limitGlobal);
    const channelMetas: ChannelWordMeta[] = [];

    for (const channelId of channelIds) {
      const [channelKeywords, channelTags] = await Promise.all([
        this.getTopWords(`hot:content:aggregated:channel:${channelId}`, perChannelLimit),
        this.getTopTags(channelId, perChannelLimit),
      ]);
      const items = this.mergeWordMetas(channelKeywords, channelTags, perChannelLimit);
      if (items.length > 0) {
        channelMetas.push({ channelId, items });
      }
    }

    return { global: globalMeta, channels: channelMetas, updatedAt: new Date().toISOString() };
  }

  private async getTopWords(key: string, limit: number): Promise<HotWord[]> {
    const redis = this.redis;
    if (!redis) return [];

    const results = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
    const words: HotWord[] = [];

    for (let i = 0; i < results.length; i += 2) {
      words.push({
        word: results[i],
        score: parseFloat(results[i + 1]),
        rank: Math.floor(i / 2) + 1,
      });
    }
    return words;
  }

  async analyzeContentWords(batchSize = 100): Promise<void> {
    await this.ensureDictionariesLoaded();
    const redis = this.redis;
    if (!redis) return;

    const lastId = BigInt((await redis.get('hot:content:last_analyzed_id')) || '0');
    const today = new Date().toISOString().split('T')[0];
    const todayKey = `hot:content:stats:${today}`;

    const posts = await this.db
      .selectFrom('posts_main')
      .select(['thread_id', 'title', 'first_message_content', 'channel_id'])
      .where('thread_id', '>', lastId.toString())
      .where('is_deleted', '=', false)
      .orderBy('thread_id', 'asc')
      .limit(batchSize)
      .execute();

    if (posts.length === 0) return;

    let allTags = await redis.smembers('hot:cache:all_tags');
    if (allTags.length === 0) {
      const tagsResult = await this.db.selectFrom('tags').select('tag_name').execute();
      allTags = tagsResult.map((t: { tag_name: string }) => t.tag_name);
      if (allTags.length > 0) {
        await redis.sadd('hot:cache:all_tags', ...allTags);
        await redis.expire('hot:cache:all_tags', 3600);
      }
    }
    const tagsSet = new Set(allTags);

    const wordCounts = new Map<string, number>();
    const channelWordCounts = new Map<string, Map<string, number>>();

    for (const post of posts) {
      const titleWords = this.tokenize(post.title);
      const titleSet = new Set(titleWords);
      const contentWords = this.tokenize(post.first_message_content || '');
      const channelId = String(post.channel_id);
      if (!channelWordCounts.has(channelId)) {
        channelWordCounts.set(channelId, new Map());
      }
      const perChannel = channelWordCounts.get(channelId)!;

      for (const word of titleWords) {
        if (this.isValidWord(word, tagsSet)) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 2.0);
          perChannel.set(word, (perChannel.get(word) || 0) + 2.0);
        }
      }

      for (const word of contentWords) {
        if (this.isValidWord(word, tagsSet) && !titleSet.has(word)) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1.0);
          perChannel.set(word, (perChannel.get(word) || 0) + 1.0);
        }
      }
    }

    const pipeline = redis.pipeline();
    for (const [word, score] of wordCounts.entries()) {
      pipeline.zincrby(todayKey, score, word);
    }
    pipeline.expire(todayKey, this.contentRetentionDays * 24 * 3600);

    for (const [channelId, counts] of channelWordCounts.entries()) {
      const channelKey = `hot:content:stats:channel:${channelId}:${today}`;
      pipeline.sadd('hot:content:channels', channelId);
      for (const [word, score] of counts.entries()) {
        pipeline.zincrby(channelKey, score, word);
      }
      pipeline.expire(channelKey, this.contentRetentionDays * 24 * 3600);
    }

    pipeline.set('hot:content:last_analyzed_id', posts[posts.length - 1].thread_id.toString());
    await pipeline.exec();
  }

  async aggregateContentHotWords(): Promise<void> {
    const redis = this.redis;
    if (!redis) return;

    await this.aggregateContentRange('hot:content:stats', 'hot:content:aggregated');

    const channels = await redis.smembers('hot:content:channels');
    for (const channelId of channels) {
      await this.aggregateContentRange(
        `hot:content:stats:channel:${channelId}`,
        `hot:content:aggregated:channel:${channelId}`
      );
    }
  }

  private tokenize(text: string): string[] {
    if (!text) return [];
    return nodejieba
      .cut(text)
      .map((w: string) => w.trim().toLowerCase())
      .filter((w: string) => w.length >= 2);
  }

  private tokenizeSearch(text: string): string[] {
    if (!text) return [];
    return nodejieba
      .cut(text)
      .map((w: string) => w.trim().toLowerCase())
      .filter((w: string) => this.isAllowedWord(w));
  }

  private isValidWord(word: string, tagsSet: Set<string>): boolean {
    return this.isAllowedWord(word) && !tagsSet.has(word);
  }

  private normalizeQuery(raw: string): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const normalized = trimmed
      .replace(/\s+/g, ' ')
      .replace(/^[\p{P}\p{S}]+/u, '')
      .replace(/[\p{P}\p{S}]+$/u, '')
      .toLowerCase();

    if (normalized.length < 2) return null;
    if (/^[0-9]+$/.test(normalized)) return null;
    return normalized;
  }

  private getDecayWeights(days: number): number[] {
    const weights: number[] = [];
    for (let i = 0; i < days; i++) {
      weights.push(Number(this.decayFactor ** i));
    }
    return weights;
  }

  private getEnvNumber(key: string, fallback: number, min = 1): number {
    const raw = process.env[key];
    if (!raw) return fallback;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < min) return fallback;
    return num;
  }

  async aggregateHotSearch(): Promise<void> {
    const redis = this.redis;
    if (!redis) return;

    await Promise.all([
      this.aggregateSearchByPrefix('hot:search:query', 'hot:search:query:aggregated'),
      this.aggregateSearchByPrefix('hot:search:tokens', 'hot:search:tokens:aggregated'),
    ]);
  }

  private async aggregateSearchByPrefix(sourcePrefix: string, targetKey: string): Promise<void> {
    const redis = this.redis;
    if (!redis) return;

    const today = new Date();
    const weights = this.getDecayWeights(this.searchRetentionDays);
    const aggregated = new Map<string, number>();

    for (let i = 0; i < weights.length; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = `${sourcePrefix}:${date.toISOString().split('T')[0]}`;

      if (!(await redis.exists(key))) continue;

      const data = await redis.zrange(key, 0, -1, 'WITHSCORES');
      for (let j = 0; j < data.length; j += 2) {
        const word = data[j];
        const count = parseFloat(data[j + 1]);
        // 聚合时过滤停用词和黑名单
        if (word.length >= 2 && word.length <= 20 && this.isAllowedWord(word)) {
          aggregated.set(word, (aggregated.get(word) || 0) + count * weights[i]);
        }
      }
    }

    const pipeline = redis.pipeline().del(targetKey);
    for (const [word, score] of aggregated.entries()) {
      if (score >= 0.5) pipeline.zadd(targetKey, score, word);
    }
    await pipeline.exec();
  }

  private async ensureDictionariesLoaded(): Promise<void> {
    if (this.dictionariesLoaded) return;
    this.dictionariesLoaded = true;
    await Promise.all([this.loadUserDict(), this.loadBlacklist(), this.loadMapping(), this.loadStopwords()]);
  }

  private async loadUserDict(): Promise<void> {
    const dictPath = this.userDictPath;
    if (!dictPath) return;
    try {
      await fs.access(dictPath);
      const content = await fs.readFile(dictPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [word] = trimmed.split(/\s+/);
        if (!word) continue;
        try {
          nodejieba.insertWord(word);
        } catch {
          // ignore insert errors
        }
      }
    } catch {
      // ignore missing dict file
    }
  }

  private async loadBlacklist(): Promise<void> {
    this.blacklist.clear();
    const pathCandidate = this.blacklistPath;
    if (pathCandidate) {
      try {
        await fs.access(pathCandidate);
        const content = await fs.readFile(pathCandidate, 'utf-8');
        for (const line of content.split('\n')) {
          const word = line.trim().toLowerCase();
          if (word) this.blacklist.add(word);
        }
      } catch {
        // ignore missing blacklist file
      }
    }

    const redis = this.redis;
    if (redis) {
      try {
        const dynamic = await redis.smembers('hot:blacklist:dynamic');
        for (const word of dynamic) {
          const normalized = word.trim().toLowerCase();
          if (normalized) this.blacklist.add(normalized);
        }
      } catch {
        // ignore redis errors
      }
    }
  }

  private async loadStopwords(): Promise<void> {
    if (!this.stopwordsPath) return;
    try {
      await fs.access(this.stopwordsPath);
      const content = await fs.readFile(this.stopwordsPath, 'utf-8');
      for (const line of content.split('\n')) {
        const word = line.trim().toLowerCase();
        if (word) this.STOP_WORDS.add(word);
      }
    } catch {
      // ignore missing stopwords file
    }
  }

  private isAllowedWord(word: string): boolean {
    if (!word || word.length < 2 || word.length > 10) return false;
    if (this.STOP_WORDS.has(word)) return false;
    if (this.blacklist.has(word)) return false;
    return true;
  }

  private async loadMapping(): Promise<void> {
    this.mapping.clear();
    const pathCandidate = this.mappingPath;
    if (!pathCandidate) return;

    // JSON 格式映射
    try {
      await fs.access(pathCandidate);
      const content = await fs.readFile(pathCandidate, 'utf-8');
      const parsed = JSON.parse(content) as Array<{
        word?: string;
        canonical?: string;
        type?: 'keyword' | 'tag';
        weight?: number;
        aliases?: string[];
      }>;

      for (const entry of parsed) {
        const canonical = (entry.canonical ?? entry.word ?? '').trim().toLowerCase();
        const type = entry.type;
        const weight = entry.weight;
        const addAlias = (alias: string | undefined) => {
          const a = alias?.trim().toLowerCase();
          if (!a) return;
          this.mapping.set(a, { canonical: canonical || a, type, weight });
        };
        addAlias(entry.word);
        if (Array.isArray(entry.aliases)) {
          for (const alias of entry.aliases) addAlias(alias);
        }
      }
    } catch {
      // ignore missing or invalid mapping file
    }

    // TXT 格式 alias（形如 "alias -> canonical"）
    if (this.aliasPath) {
      try {
        await fs.access(this.aliasPath);
        const content = await fs.readFile(this.aliasPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const parts = trimmed.split('->').map((p) => p.trim());
          if (parts.length < 2) continue;
          const alias = parts[0].toLowerCase();
          const canonical = parts[1].toLowerCase();
          if (!alias || !canonical) continue;
          this.mapping.set(alias, { canonical, type: undefined, weight: undefined });
        }
      } catch {
        // ignore missing or invalid alias file
      }
    }
  }

  private normalizeWordMeta(
    word: string,
    type: 'keyword' | 'tag',
    score: number
  ): {
    word: string;
    type: 'keyword' | 'tag';
    score: number;
  } {
    const lower = word.toLowerCase();
    const mapped = this.mapping.get(lower);
    if (!mapped) {
      return { word, type, score };
    }
    const newWord = mapped.canonical || word;
    const newType = mapped.type ?? type;
    const newScore = mapped.weight ? score * mapped.weight : score;
    return { word: newWord, type: newType, score: newScore };
  }

  private async aggregateContentRange(sourcePrefix: string, targetKey: string): Promise<void> {
    const redis = this.redis;
    if (!redis) return;

    const today = new Date();
    const weights = this.getDecayWeights(this.contentRetentionDays);
    const aggregated = new Map<string, number>();

    for (let i = 0; i < weights.length; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = `${sourcePrefix}:${date.toISOString().split('T')[0]}`;

      if (!(await redis.exists(key))) continue;

      const data = await redis.zrange(key, 0, -1, 'WITHSCORES');
      for (let j = 0; j < data.length; j += 2) {
        const word = data[j];
        const count = parseFloat(data[j + 1]);
        // 聚合时过滤停用词和黑名单
        if (this.isAllowedWord(word)) {
          aggregated.set(word, (aggregated.get(word) || 0) + count * weights[i]);
        }
      }
    }

    const pipeline = redis.pipeline().del(targetKey);
    for (const [word, score] of aggregated.entries()) {
      if (score >= 0.5) pipeline.zadd(targetKey, score, word);
    }
    await pipeline.exec();
  }

  private mergeWordMetas(keywords: HotWord[], tags: HotWord[], limit: number): WordMeta[] {
    // 分别处理 tags 和 keywords，确保 tags 优先且数量不被 keywords 挤占
    const tagMetas: WordMeta[] = [];
    const keywordMetas: WordMeta[] = [];
    const seen = new Set<string>();

    // 先处理所有 tags
    for (const t of tags) {
      const mapped = this.normalizeWordMeta(t.word, 'tag', t.score);
      const key = mapped.word.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        tagMetas.push({ word: mapped.word, score: mapped.score, type: 'tag', rank: 0 });
      }
    }

    // 再处理 keywords，跳过已存在的
    for (const k of keywords) {
      const mapped = this.normalizeWordMeta(k.word, 'keyword', k.score);
      const key = mapped.word.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        keywordMetas.push({ word: mapped.word, score: mapped.score, type: 'keyword', rank: 0 });
      }
    }

    // 按分数排序各自类别
    tagMetas.sort((a, b) => b.score - a.score);
    keywordMetas.sort((a, b) => b.score - a.score);

    // 合并：先放所有 tags，再补充 keywords 直到达到 limit
    const result = [...tagMetas];
    const remaining = limit - result.length;
    if (remaining > 0) {
      result.push(...keywordMetas.slice(0, remaining));
    }

    // 按分数重新排序并分配 rank
    return result
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  private async getTopTags(channelId: string | undefined, limit: number): Promise<HotWord[]> {
    const baseQuery = this.db.selectFrom('tags').select(['tag_name', 'usage_count']);
    const rows = channelId
      ? await baseQuery.where('tags.channel_id', '=', channelId).orderBy('usage_count', 'desc').limit(limit).execute()
      : await baseQuery.orderBy('usage_count', 'desc').limit(limit).execute();

    return rows
      .filter((row) => !!row.tag_name)
      .map((row, idx) => ({
        word: row.tag_name,
        score: Number(row.usage_count ?? 0),
        rank: idx + 1,
      }));
  }

  /**
   * 重新加载所有词典（停用词、黑名单、映射）
   * 用于在运行时更新词典文件后立即生效
   */
  async reloadDictionaries(): Promise<void> {
    // 重置状态
    this.dictionariesLoaded = false;
    this.STOP_WORDS = new Set(HotWordsService.DEFAULT_STOP_WORDS);
    this.blacklist.clear();
    this.mapping.clear();

    // 重新加载
    await this.ensureDictionariesLoaded();
  }

  // 清空 Redis 中的聚合数据（保留原始统计数据）
  async clearAggregatedData(): Promise<void> {
    const redis = this.redis;
    if (!redis) return;

    const keysToDelete: string[] = [
      'hot:search:query:aggregated',
      'hot:search:tokens:aggregated',
      'hot:content:aggregated',
    ];

    // 获取所有频道的聚合 key
    const channels = await redis.smembers('hot:content:channels');
    for (const channelId of channels) {
      keysToDelete.push(`hot:content:aggregated:channel:${channelId}`);
    }

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
  }

  // 重载词典 -> 清空聚合 -> 重新聚合
  async reloadAndReaggregate(): Promise<{ stopWordsCount: number; blacklistCount: number }> {
    await this.reloadDictionaries();
    await this.clearAggregatedData();
    await this.aggregateHotSearch();
    await this.aggregateContentHotWords();

    return {
      stopWordsCount: this.STOP_WORDS.size,
      blacklistCount: this.blacklist.size,
    };
  }
}
