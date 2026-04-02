import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { z } from 'zod';

const createTriggerSchema = z.object({
  keyword: z.string().min(1).max(100),
  responseMessage: z.string().min(1).max(1000),
  mediaId: z.string().optional().nullable(), // Feature #3
});

const toggleTriggerSchema = z.object({
  id: z.string(),
  isActive: z.boolean(),
});

async function getAccountId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.accountId) return null;
  return session.accountId;
}

/**
 * GET — List all triggers for the authenticated user's account
 */
export async function GET() {
  const accountId = await getAccountId();
  if (!accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const triggers = await prisma.trigger.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          dmLogs: true,
        },
      },
    },
  });

  return NextResponse.json({ triggers });
}

/**
 * POST — Create a new trigger
 */
export async function POST(request: NextRequest) {
  const accountId = await getAccountId();
  if (!accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createTriggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { keyword, responseMessage, mediaId } = parsed.data;

  // Check for existing trigger with same keyword
  const existing = await prisma.trigger.findFirst({
    where: {
      accountId,
      keyword: keyword.toUpperCase(),
      mediaId: mediaId || null,
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: `Trigger for keyword "${keyword}" already exists` },
      { status: 409 }
    );
  }

  const trigger = await prisma.trigger.create({
    data: {
      keyword: keyword.toUpperCase(),
      responseMessage,
      mediaId: mediaId || null,
      accountId,
    },
  });

  return NextResponse.json({ trigger }, { status: 201 });
}

/**
 * PATCH — Toggle trigger active/inactive
 */
export async function PATCH(request: NextRequest) {
  const accountId = await getAccountId();
  if (!accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = toggleTriggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const trigger = await prisma.trigger.updateMany({
    where: { id: parsed.data.id, accountId },
    data: { isActive: parsed.data.isActive },
  });

  if (trigger.count === 0) {
    return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE — Delete a trigger
 */
export async function DELETE(request: NextRequest) {
  const accountId = await getAccountId();
  if (!accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing trigger ID' }, { status: 400 });
  }

  const result = await prisma.trigger.deleteMany({
    where: { id, accountId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
