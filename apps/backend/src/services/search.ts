import { MeiliSearch } from 'meilisearch';

export const createSearchClient = () => {
  return new MeiliSearch({
    host: process.env.MEILI_HOST ?? 'http://localhost:7700',
    apiKey: process.env.MEILI_API_KEY,
  });
};

export const configurePostsIndex = async (client: MeiliSearch) => {
  const indexName = process.env.MEILI_INDEX_POSTS ?? 'posts';
  const index = client.index(indexName);

  await index.updateSearchableAttributes(['title', 'content', 'tags', 'authorName']);

  // 配置中文字段，提升中文搜索相关度
  await index.updateLocalizedAttributes([
    { attributePatterns: ['title', 'content', 'authorName'], locales: ['cmn'] }, // cmn = Chinese Mandarin
    { attributePatterns: ['tags'], locales: [] }, // tags 不需要语言处理
  ]);

  await index.updateFilterableAttributes([
    'id',
    'authorId',
    'categoryId',
    'tags',
    'createdAt',
    'updatedAt',
    'lastActiveAt',
    'isDeleted',
    'isValid',
    'isRecommended',
    'reactionCount',
    'messageCount',
  ]);
  await index.updateSortableAttributes(['createdAt', 'updatedAt', 'lastActiveAt', 'messageCount', 'reactionCount']);
  // 将 sort 提前，确保带关键词的“按回复/按点赞”排序严格生效
  await index.updateRankingRules(['sort', 'words', 'typo', 'proximity', 'attribute', 'exactness']);
  await index.updatePagination({ maxTotalHits: 10000 });

  return indexName;
};
