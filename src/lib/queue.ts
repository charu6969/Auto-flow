import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Render Redis uses rediss:// (TLS) — enable TLS when detected
const redisTls = REDIS_URL.startsWith('rediss://') ? { tls: { rejectUnauthorized: false } } : {};

// Shared Redis connection for all queues
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  ...redisTls,
});

// DM sending queue
export const dmQueue = new Queue('dm-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

// Token refresh queue (Feature #1)
export const tokenRefreshQueue = new Queue('token-refresh-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
});

// Rate limit helpers
export async function getRateLimit(accountId: string): Promise<number> {
  const key = `rate:dm:${accountId}`;
  const count = await redisConnection.get(key);
  return count ? parseInt(count, 10) : 0;
}

export async function incrementRateLimit(accountId: string): Promise<number> {
  const key = `rate:dm:${accountId}`;
  const count = await redisConnection.incr(key);
  if (count === 1) {
    await redisConnection.expire(key, 3600); // 1 hour TTL
  }
  return count;
}

export const RATE_LIMIT_MAX = 180;
