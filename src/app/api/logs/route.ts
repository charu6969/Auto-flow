import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * GET /api/logs — Paginated DM logs with status filtering
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {
    accountId: session.accountId,
    isArchived: false,
  };

  if (status && status !== 'ALL') {
    where.status = status;
  }

  const [logs, total] = await Promise.all([
    prisma.dmLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        trigger: {
          select: { keyword: true },
        },
      },
    }),
    prisma.dmLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * DELETE /api/logs — Archive selected logs (Feature #6)
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session?.accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { ids } = body as { ids: string[] };

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No log IDs provided' }, { status: 400 });
  }

  const result = await prisma.dmLog.updateMany({
    where: {
      id: { in: ids },
      accountId: session.accountId,
    },
    data: { isArchived: true },
  });

  return NextResponse.json({ archived: result.count });
}
