import { PostSyncEngine } from './post-sync-engine.js';
import { PostSyncEventStore } from './post-sync-event-store.js';
import { PostgresListener } from './postgres-listener.js';

type SimpleLogger = {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
};

interface WorkerOptions {
  concurrency: number;
  pollIntervalMs: number;
  maxRetries: number;
  backoffStepsMs?: number[];
  listener?: PostgresListener;
  logger?: SimpleLogger;
}

export class PostSyncWorker {
  private readonly queue = new Set<string>();
  private readonly cooldownUntil = new Map<string, number>();
  private readonly backoffSteps: number[];
  private readonly logger: SimpleLogger;
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private active = 0;

  constructor(
    private readonly eventStore: PostSyncEventStore,
    private readonly engine: PostSyncEngine,
    private readonly options: WorkerOptions
  ) {
    this.backoffSteps = options.backoffStepsMs ?? [1000, 5000, 30000, 60000];
    this.logger = options.logger ?? console;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    if (this.options.listener) {
      await this.options.listener.start((postId) => this.enqueue(postId));
    }

    await this.pollOnce();
    this.pollTimer = setInterval(() => {
      this.pollOnce().catch((error) => {
        this.logger.error?.('[PostSyncWorker] poll failed', error);
      });
    }, this.options.pollIntervalMs);

    this.logger.info?.(
      `[PostSyncWorker] started (concurrency=${this.options.concurrency}, poll=${this.options.pollIntervalMs}ms)`
    );
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.options.listener) {
      await this.options.listener.stop();
    }
  }

  private enqueue(postId: string): void {
    if (!this.running) return;

    const cooldownUntil = this.cooldownUntil.get(postId);
    if (cooldownUntil && cooldownUntil > Date.now()) {
      return;
    }

    this.queue.add(postId);
    void this.drain();
  }

  private async pollOnce(): Promise<void> {
    if (!this.running) return;
    const postIds = await this.eventStore.pollPostIds(this.options.concurrency * 2, this.options.maxRetries);
    postIds.forEach((postId) => this.enqueue(postId));
  }

  private async drain(): Promise<void> {
    if (!this.running) return;
    while (this.active < this.options.concurrency && this.queue.size > 0) {
      const next = this.queue.values().next().value as string;
      this.queue.delete(next);
      this.active++;

      void this.process(next)
        .catch((error) => {
          this.logger.error?.('[PostSyncWorker] task failed', error);
        })
        .finally(() => {
          this.active--;
          void this.drain();
        });
    }
  }

  private async process(postId: string): Promise<void> {
    const event = await this.eventStore.getLatestEvent(postId, this.options.maxRetries);
    if (!event) {
      return;
    }

    try {
      await this.engine.apply(event.post_id, event.action);
      await this.eventStore.ackUntil(event.post_id, event.id);
      this.cooldownUntil.delete(postId);
    } catch (error) {
      const nextRetries = event.retries + 1;
      await this.eventStore.markFailed(event.id, nextRetries, error);
      if (nextRetries < this.options.maxRetries) {
        this.scheduleRetry(event.post_id, nextRetries);
      } else {
        this.logger.error?.(
          `[PostSyncWorker] reached max retries for post ${event.post_id}, action=${event.action}`
        );
      }
      throw error;
    }
  }

  private scheduleRetry(postId: string, retryCount: number): void {
    const delay = this.computeBackoff(retryCount);
    const retryAt = Date.now() + delay;
    this.cooldownUntil.set(postId, retryAt);

    setTimeout(() => {
      this.cooldownUntil.delete(postId);
      this.enqueue(postId);
    }, delay);
  }

  private computeBackoff(retryCount: number): number {
    const index = Math.min(retryCount - 1, this.backoffSteps.length - 1);
    return this.backoffSteps[index] ?? 1000;
  }
}
