import cron from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import type { HotWordsService } from '../services/hotWordsService.js';

export const startHotWordsCron = (service: HotWordsService, logger: FastifyBaseLogger) => {
  // 启动时立即执行一次聚合，确保热词数据可用
  (async () => {
    logger.info('Initial hot words aggregation started');
    try {
      await service.aggregateHotSearch();
      await service.aggregateContentHotWords();
      logger.info('Initial hot words aggregation completed');
    } catch (error) {
      logger.error({ error }, 'Initial hot words aggregation failed');
    }
  })();

  cron.schedule('*/1 * * * *', async () => {
    logger.info('Content words analysis started');
    try {
      await service.analyzeContentWords(1000);
      // 分析后立即聚合，确保热词数据及时可用
      await service.aggregateContentHotWords();
      logger.info('Content words analysis and aggregation completed');
    } catch (error) {
      logger.error({ error }, 'Content words analysis failed');
    }
  });

  cron.schedule('0 * * * *', async () => {
    logger.info('Hot words aggregation started');
    try {
      await service.aggregateHotSearch();
      await service.aggregateContentHotWords();
      logger.info('Hot words aggregation completed');
    } catch (error) {
      logger.error({ error }, 'Hot words aggregation failed');
    }
  });

  logger.info('Hot words cron jobs registered');
};
