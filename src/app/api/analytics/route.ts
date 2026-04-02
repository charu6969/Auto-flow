import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * GET /api/analytics — Dashboard stats
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accountId = session.accountId;

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get aggregate stats
  const [totalSent, totalFailed, totalQueued, last24h, activeTriggers] =
    await Promise.all([
      prisma.dmLog.count({
        where: { accountId, status: 'SENT' },
      }),
      prisma.dmLog.count({
        where: { accountId, status: 'FAILED' },
      }),
      prisma.dmLog.count({
        where: { accountId, status: 'QUEUED' },
      }),
      prisma.dmLog.count({
        where: {
          accountId,
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.trigger.count({
        where: { accountId, isActive: true },
      }),
    ]);

  // 7-day breakdown
  const sevenDayLogs = await prisma.dmLog.findMany({
    where: {
      accountId,
      createdAt: { gte: sevenDaysAgo },
    },
    select: {
      status: true,
      createdAt: true,
    },
  });

  const dailyBreakdown: Record<string, { sent: number; failed: number; total: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    dailyBreakdown[key] = { sent: 0, failed: 0, total: 0 };
  }

  for (const log of sevenDayLogs) {
    const key = log.createdAt.toISOString().split('T')[0];
    if (dailyBreakdown[key]) {
      dailyBreakdown[key].total++;
      if (log.status === 'SENT') dailyBreakdown[key].sent++;
      if (log.status === 'FAILED') dailyBreakdown[key].failed++;
    }
  }

  // Recent activity (last 10 logs)
  const recentActivity = await prisma.dmLog.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      trigger: { select: { keyword: true } },
    },
  });

  return NextResponse.json({
    stats: {
      totalSent,
      totalFailed,
      totalQueued,
      last24h,
      activeTriggers,
      successRate:
        totalSent + totalFailed > 0
          ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
          : 100,
    },
    dailyBreakdown: Object.entries(dailyBreakdown).map(([date, stats]) => ({
      date,
      ...stats,
    })),
    recentActivity,
  });
}
