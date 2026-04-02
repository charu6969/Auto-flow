import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { dmQueue } from '@/lib/queue';

/**
 * POST /api/logs/retry — Bulk retry failed logs (Feature #6)
 * Re-enqueues selected FAILED logs back into the DM queue
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { ids } = body as { ids: string[] };

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No log IDs provided' }, { status: 400 });
  }

  // Get all failed logs for this account
  const logs = await prisma.dmLog.findMany({
    where: {
      id: { in: ids },
      accountId: session.accountId,
      status: 'FAILED',
    },
    include: {
      account: {
        select: {
          igUserId: true,
          accessToken: true,
        },
      },
    },
  });

  if (logs.length === 0) {
    return NextResponse.json({ error: 'No eligible logs to retry' }, { status: 404 });
  }

  let requeued = 0;

  for (const log of logs) {
    // Reset status to QUEUED
    await prisma.dmLog.update({
      where: { id: log.id },
      data: {
        status: 'QUEUED',
        errorMessage: null,
        retryCount: 0,
      },
    });

    // Re-enqueue job
    await dmQueue.add('send-dm', {
      dmLogId: log.id,
      accountId: log.accountId,
      igUserId: log.account.igUserId,
      recipientIgId: log.commenterIgId,
      message: log.dmMessageSent || '',
      accessToken: log.account.accessToken,
    });

    requeued++;
  }

  return NextResponse.json({ requeued });
}
