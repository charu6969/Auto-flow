import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * GET /api/logs/export — Export logs as CSV (Feature #9)
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'csv';

  if (format !== 'csv') {
    return NextResponse.json({ error: 'Only CSV format is supported' }, { status: 400 });
  }

  const logs = await prisma.dmLog.findMany({
    where: {
      accountId: session.accountId,
      isArchived: false,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      trigger: {
        select: { keyword: true },
      },
    },
  });

  // Build CSV
  const headers = [
    'timestamp',
    'commenter_username',
    'comment_text',
    'trigger_keyword',
    'dm_message',
    'dm_status',
    'error_message',
    'retry_count',
    'sent_at',
  ];

  const rows = logs.map((log) => [
    log.createdAt.toISOString(),
    escapeCsv(log.commenterUsername || ''),
    escapeCsv(log.commentText || ''),
    escapeCsv(log.trigger?.keyword || ''),
    escapeCsv(log.dmMessageSent || ''),
    log.status,
    escapeCsv(log.errorMessage || ''),
    log.retryCount.toString(),
    log.sentAt?.toISOString() || '',
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="replybot-logs-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
