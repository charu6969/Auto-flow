import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { refreshLongLivedToken } from '../services/instagram';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REFRESH_THRESHOLD_DAYS = 7;

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();

// Set up the repeatable job queue
const tokenRefreshQueue = new Queue('token-refresh-queue', {
  connection,
});

// Add repeatable job: run every 24 hours
async function setupRepeatable() {
  await tokenRefreshQueue.add(
    'refresh-all-tokens',
    {},
    {
      repeat: {
        pattern: '0 3 * * *', // Run daily at 3 AM
      },
    }
  );
  console.log('[token-refresh] ⏰ Repeatable job scheduled (daily at 3 AM)');
}

const worker = new Worker(
  'token-refresh-queue',
  async (job) => {
    console.log(`[token-refresh] Starting token refresh check (job ${job.id})...`);

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + REFRESH_THRESHOLD_DAYS);

    const accounts = await prisma.instagramAccount.findMany({
      where: {
        isActive: true,
        tokenExpiresAt: {
          lte: thresholdDate,
        },
      },
    });

    console.log(`[token-refresh] Found ${accounts.length} accounts with expiring tokens`);

    let refreshed = 0;
    let failed = 0;

    for (const account of accounts) {
      try {
        console.log(`[token-refresh] Refreshing token for @${account.igUsername}...`);

        const tokenResponse = await refreshLongLivedToken(account.accessToken);
        const expiresInSeconds = tokenResponse.expires_in || 60 * 24 * 60 * 60;
        const newExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

        await prisma.instagramAccount.update({
          where: { id: account.id },
          data: {
            accessToken: tokenResponse.access_token,
            tokenExpiresAt: newExpiresAt,
          },
        });

        console.log(`[token-refresh] ✅ @${account.igUsername} refreshed (expires ${newExpiresAt.toISOString()})`);
        refreshed++;
      } catch (error) {
        console.error(`[token-refresh] ❌ @${account.igUsername} failed:`, error);
        failed++;
      }
    }

    console.log(`[token-refresh] Complete: ${refreshed} refreshed, ${failed} failed, ${accounts.length} total`);
    return { refreshed, failed, total: accounts.length };
  },
  {
    connection,
    concurrency: 1,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[token-refresh] Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[token-refresh] Job ${job?.id} failed:`, err.message);
});

worker.on('ready', () => {
  console.log('🔑 Token Refresh Worker is running...');
});

// Set up repeatable job on start
setupRepeatable().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
