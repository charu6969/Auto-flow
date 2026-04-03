import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient, DmStatus } from '@prisma/client';
import {
  sendInstagramDM,
  parseGraphApiError,
  isPermissionError,
  isRateLimitError,
} from '../services/instagram';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const RATE_LIMIT_MAX = 180;

// Render Redis uses rediss:// (TLS) — enable TLS when detected
const redisTls = REDIS_URL.startsWith('rediss://') ? { tls: { rejectUnauthorized: false } } : {};

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  ...redisTls,
});

const prisma = new PrismaClient();

interface DMJobData {
  dmLogId: string;
  accountId: string;
  pageId: string; // Instagram User ID (stored as pageId for compatibility — Instagram Login API doesn't use Facebook Pages)
  recipientIgId: string;
  message: string;
  accessToken: string;
  commentId?: string;
}

async function getRateCount(accountId: string): Promise<number> {
  const key = `rate:dm:${accountId}`;
  const count = await connection.get(key);
  return count ? parseInt(count, 10) : 0;
}

async function incrementRate(accountId: string): Promise<void> {
  const key = `rate:dm:${accountId}`;
  const count = await connection.incr(key);
  if (count === 1) {
    await connection.expire(key, 3600);
  }
}

const worker = new Worker<DMJobData>(
  'dm-queue',
  async (job) => {
    const { dmLogId, accountId, pageId, recipientIgId, message, accessToken, commentId } = job.data;

    console.log(`[dm-worker] Processing job ${job.id} for DmLog ${dmLogId}`);

    // Update status to SENDING
    await prisma.dmLog.update({
      where: { id: dmLogId },
      data: { status: 'SENDING' },
    });

    // Check rate limit
    const currentRate = await getRateCount(accountId);
    if (currentRate >= RATE_LIMIT_MAX) {
      await prisma.dmLog.update({
        where: { id: dmLogId },
        data: {
          status: 'RATE_LIMITED',
          errorMessage: `Rate limit reached (${currentRate}/${RATE_LIMIT_MAX} per hour)`,
        },
      });
      throw new Error('Rate limit exceeded — will retry with backoff');
    }

    try {
      // Send the DM via Instagram Graph API
      await sendInstagramDM(pageId, recipientIgId, message, accessToken, commentId);

      // Increment rate counter
      await incrementRate(accountId);

      // Update log to SENT
      await prisma.dmLog.update({
        where: { id: dmLogId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      console.log(`[dm-worker] ✅ DM sent for log ${dmLogId}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const graphError = parseGraphApiError(error);

      let finalStatus: DmStatus;
      if (graphError && isPermissionError(graphError)) {
        // Permission/token errors will never succeed on retry
        finalStatus = DmStatus.FAILED;
        console.error(`[dm-worker] ❌ Permission error for log ${dmLogId} (code ${graphError.code}) — not retrying`);
      } else if (graphError && isRateLimitError(graphError)) {
        finalStatus = DmStatus.RATE_LIMITED;
      } else {
        finalStatus = job.attemptsMade >= 2 ? DmStatus.FAILED : DmStatus.QUEUED;
      }

      await prisma.dmLog.update({
        where: { id: dmLogId },
        data: {
          status: finalStatus,
          errorMessage: graphError
            ? `Graph API Error ${graphError.code}: ${graphError.message}`
            : errorMsg,
          retryCount: job.attemptsMade,
        },
      });

      console.error(`[dm-worker] ❌ Failed to send DM for log ${dmLogId}:`, errorMsg);

      // Don't retry permission errors — they'll never succeed
      if (graphError && isPermissionError(graphError)) {
        return;
      }
      throw error; // Re-throw to trigger BullMQ retry
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000, // max 10 jobs per second
    },
  }
);

worker.on('completed', (job) => {
  console.log(`[dm-worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[dm-worker] Job ${job?.id} failed:`, err.message);
});

worker.on('ready', () => {
  console.log('🚀 DM Worker is running...');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[dm-worker] Shutting down...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[dm-worker] Shutting down...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
