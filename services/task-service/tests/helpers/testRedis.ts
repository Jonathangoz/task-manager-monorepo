import Redis from 'ioredis';

class TestRedis {
  private client: Redis;
  private static instance: TestRedis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost/1', {
      keyPrefix: 'test:task:',
      lazyConnect: true,
    });
  }

  static getInstance(): TestRedis {
    if (!TestRedis.instance) {
      TestRedis.instance = new TestRedis();
    }
    return TestRedis.instance;
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  async flushAll(): Promise<void> {
    await this.client.flushdb();
  }

  getClient(): Redis {
    return this.client;
  }

  // Métodos helper para pruebas
  async setTestData(key: string, value: any, ttl?: number): Promise<void> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async getTestData(key: string): Promise<any> {
    const value = await this.client.get(key);
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return value;
    }
  }
}

export const testRedis = TestRedis.getInstance();
