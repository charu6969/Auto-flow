import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * GET /api/triggers/[id]/stats — Per-trigger analytics (Feature #7)
 * Returns 7-day daily breakdown of matches/sent/failed
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const triggerId = params.id;

  // Verify trigger belongs to this account
  const trigger = await prisma.trigger.findFirst({
    where: { id: triggerId, accountId: session.accountId },
  });

  if (!trigger) {
    return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
  }

  // Get 7-day breakdown
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const logs = await prisma.dmLog.findMany({
    where: {
      triggerId,
      createdAt: { gte: sevenDaysAgo },
    },
    select: {
      status: true,
      createdAt: true,
    },
  });

  // Group by day
  const dailyStats: Record<string, { matches: number; sent: number; failed: number }> = {};

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    dailyStats[key] = { matches: 0, sent: 0, failed: 0 };
  }

  for (const log of logs) {
    const key = log.createdAt.toISOString().split('T')[0];
    if (dailyStats[key]) {
      dailyStats[key].matches++;
      if (log.status === 'SENT') dailyStats[key].sent++;
      if (log.status === 'FAILED') dailyStats[key].failed++;
    }
  }

  // Calculate totals
  const totalMatches = logs.length;
  const totalSent = logs.filter((l) => l.status === 'SENT').length;
  const totalFailed = logs.filter((l) => l.status === 'FAILED').length;

  return NextResponse.json({
    trigger: {
      id: trigger.id,
      keyword: trigger.keyword,
      matchCount: trigger.matchCount,
    },
    totals: {
      matches: totalMatches,
      sent: totalSent,
      failed: totalFailed,
      sentRate: totalMatches > 0 ? Math.round((totalSent / totalMatches) * 100) : 0,
      failRate: totalMatches > 0 ? Math.round((totalFailed / totalMatches) * 100) : 0,
    },
    daily: Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      ...stats,
    })),
  });
}
