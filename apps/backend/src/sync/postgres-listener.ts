import { Client } from 'pg';

type Logger = {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
};

interface NotificationPayload {
  postId?: string;
  post_id?: string;
  action?: string;
}

export class PostgresListener {
  private client: Client | null = null;
  private stopped = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private onEvent: ((postId: string) => void) | null = null;

  constructor(
    private readonly connectionString: string,
    private readonly channel = 'post_sync_channel',
    private readonly logger: Logger = console
  ) {}

  async start(onEvent: (postId: string) => void): Promise<void> {
    this.onEvent = onEvent;
    this.stopped = false;
    await this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      try {
        await this.client.query(`UNLISTEN ${this.channel}`);
      } catch {
        // ignore
      }
      try {
        await this.client.end();
      } catch {
        // ignore
      }
      this.client = null;
    }
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;

    const client = new Client({ connectionString: this.connectionString });
    this.client = client;

    client.on('error', (error) => {
      this.logger.error?.('[PostgresListener] connection error', error);
      this.scheduleReconnect();
    });

    client.on('end', () => {
      if (this.stopped) return;
      this.logger.warn?.('[PostgresListener] connection ended, reconnecting...');
      this.scheduleReconnect();
    });

    try {
      await client.connect();
      await client.query(`LISTEN ${this.channel}`);
      this.logger.info?.(`[PostgresListener] listening on channel ${this.channel}`);
    } catch (error) {
      this.logger.error?.('[PostgresListener] failed to listen, scheduling reconnect', error);
      this.scheduleReconnect();
      return;
    }

    client.on('notification', (msg) => {
      const payload = this.parsePayload(msg.payload);
      const postId = payload?.postId ?? payload?.post_id ?? null;
      if (postId && this.onEvent) {
        this.onEvent(String(postId));
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 1000);
  }

  private parsePayload(payload: string | undefined): NotificationPayload | null {
    if (!payload) return null;
    try {
      return JSON.parse(payload) as NotificationPayload;
    } catch {
      return { postId: payload };
    }
  }
}
