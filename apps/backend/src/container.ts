import type { UserRepository } from './repositories/userRepository.js';
import { FavoritesService } from './services/favoritesService.js';
import { FollowsService } from './services/followsService.js';
import { NotificationsService } from './services/notificationsService.js';
import { PostsService } from './services/postsService.js';
import { OnboardingService } from './services/onboarding-service.js';
import { UserService } from './services/userService.js';
import { ChannelsService } from './services/channelsService.js';
import { RolesService } from './services/rolesService.js';
import { createDatabase } from './services/db.js';
import { KyselyUserRepository } from './repositories/db/UsersRepository.kysely.js';
import { KyselyFavoritesRepository } from './repositories/db/FavoritesRepository.kysely.js';
import { KyselyFollowsRepository } from './repositories/db/FollowsRepository.kysely.js';
import { KyselyNotificationsRepository } from './repositories/db/NotificationsRepository.kysely.js';
import { KyselyChannelFollowsRepository } from './repositories/db/ChannelFollowsRepository.kysely.js';
import { KyselyTagFollowsRepository } from './repositories/db/TagFollowsRepository.kysely.js';
import { KyselyRolesRepository } from './repositories/db/KyselyRolesRepository.js';
import { MeilisearchPostsSearchRepository } from './repositories/search/PostsSearchRepository.meili.js';
import { KyselyPostsReadRepository } from './repositories/db/PostsReadRepository.kysely.js';
import { createSearchClient } from './services/search.js';
import { KyselyChannelsRepository } from './repositories/db/ChannelsRepository.kysely.js';
import { TagFollowsService } from './services/tagFollowsService.js';
import { ChannelFollowsService } from './services/channelFollowsService.js';
import { HotWordsService } from './services/hotWordsService.js';
import { KyselyPostMembersRepository } from './repositories/db/PostMembersRepository.kysely.js';
import { FeedsService } from './services/feedsService.js';
import { SnapshotService } from './snapshot/snapshotService.js';

export interface AppContext {
  db: ReturnType<typeof createDatabase>;
  postsService: PostsService;
  feedsService: FeedsService;
  favoritesService: FavoritesService;
  followsService: FollowsService;
  notificationsService: NotificationsService;
  userService: UserService;
  userRepository: UserRepository;
  channelsService: ChannelsService;
  rolesService: RolesService;
  tagFollowsService: TagFollowsService;
  channelFollowsService: ChannelFollowsService;
  onboardingService: OnboardingService;
  hotWordsService: HotWordsService;
  postMembersRepository: KyselyPostMembersRepository;
  snapshotService: SnapshotService;
}

export const createAppContext = (): AppContext => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required to start the application.');
  }

  const db = createDatabase(dbUrl);
  const searchClient = createSearchClient();

  const postsSearchRepository = new MeilisearchPostsSearchRepository(searchClient, new KyselyPostsReadRepository(db));
  const postsReadRepository = new KyselyPostsReadRepository(db);
  const postsService = new PostsService(postsSearchRepository, postsReadRepository);
  const snapshotService = new SnapshotService(postsSearchRepository, postsService);
  const channelsRepository = new KyselyChannelsRepository(db);
  const channelsService = new ChannelsService(channelsRepository);
  const rolesRepository = new KyselyRolesRepository(db);
  const rolesService = new RolesService(rolesRepository);
  const channelFollowsRepository = new KyselyChannelFollowsRepository(db);
  const tagFollowsRepository = new KyselyTagFollowsRepository(db);
  const tagFollowsService = new TagFollowsService(tagFollowsRepository, channelsRepository);
  const channelFollowsService = new ChannelFollowsService(channelFollowsRepository, channelsRepository);
  const onboardingService = new OnboardingService(
    db,
    channelFollowsRepository,
    tagFollowsRepository,
    channelsRepository
  );

  const userRepository = new KyselyUserRepository(db);
  const favoritesRepository = new KyselyFavoritesRepository(db);
  const favoritesService = new FavoritesService(favoritesRepository, postsService);
  const postMembersRepository = new KyselyPostMembersRepository(db);
  const feedsService = new FeedsService(postsService, favoritesService, postMembersRepository, postsSearchRepository);

  const followsRepository = new KyselyFollowsRepository(db);
  const followsService = new FollowsService(followsRepository, userRepository);

  const notificationsRepository = new KyselyNotificationsRepository(db);
  const notificationsService = new NotificationsService(notificationsRepository);

  const userService = new UserService(userRepository, postsService);
  const hotWordsService = new HotWordsService(db);

  return {
    db,
    postsService,
    feedsService,
    favoritesService,
    followsService,
    notificationsService,
    userService,
    userRepository,
    channelsService,
    rolesService,
    tagFollowsService,
    channelFollowsService,
    onboardingService,
    hotWordsService,
    postMembersRepository,
    snapshotService,
  };
};

export const appContext = createAppContext();
