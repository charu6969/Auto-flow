import { prisma } from '@/lib/prisma';
import { refreshLongLivedToken } from './instagram';

const REFRESH_THRESHOLD_DAYS = 7;

/**
 * Token Refresh Service (Feature #1)
 * Checks all active Instagram accounts and refreshes tokens
 * that are expiring within the next 7 days.
 */
export async function refreshExpiringTokens(): Promise<{
  refreshed: number;
  failed: number;
  skipped: number;
}> {
  const results = { refreshed: 0, failed: 0, skipped: 0 };

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + REFRESH_THRESHOLD_DAYS);

  // Find all active accounts with tokens expiring soon
  const accounts = await prisma.instagramAccount.findMany({
    where: {
      isActive: true,
      tokenExpiresAt: {
        lte: thresholdDate,
      },
    },
  });

  console.log(`[token-refresh] Found ${accounts.length} accounts with expiring tokens`);

  for (const account of accounts) {
    try {
      console.log(`[token-refresh] Refreshing token for @${account.igUsername}...`);

      const tokenResponse = await refreshLongLivedToken(account.accessToken);

      // Calculate new expiry (default to 60 days if not provided)
      const expiresInSeconds = tokenResponse.expires_in || 60 * 24 * 60 * 60;
      const newExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      await prisma.instagramAccount.update({
        where: { id: account.id },
        data: {
          accessToken: tokenResponse.access_token,
          tokenExpiresAt: newExpiresAt,
        },
      });

      console.log(`[token-refresh] ✅ Refreshed token for @${account.igUsername} (expires ${newExpiresAt.toISOString()})`);
      results.refreshed++;
    } catch (error) {
      console.error(`[token-refresh] ❌ Failed to refresh token for @${account.igUsername}:`, error);
      results.failed++;
    }
  }

  // Count skipped accounts (not expiring soon)
  const totalActive = await prisma.instagramAccount.count({ where: { isActive: true } });
  results.skipped = totalActive - accounts.length;

  return results;
}
