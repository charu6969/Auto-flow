import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { findMatchingTrigger } from '@/services/keyword-matcher';
import { dmQueue } from '@/lib/queue';

/**
 * POST /api/test/simulate-comment — Test trigger simulation (Feature #10)
 * Runs the full pipeline but marks the DM log as test
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { triggerId, commentText } = body as {
    triggerId?: string;
    commentText: string;
  };

  if (!commentText) {
    return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
  }

  const accountId = session.accountId;

  // Get triggers
  const triggers = triggerId
    ? await prisma.trigger.findMany({ where: { id: triggerId, accountId } })
    : await prisma.trigger.findMany({ where: { accountId, isActive: true } });

  if (triggers.length === 0) {
    return NextResponse.json({
      matched: false,
      message: 'No triggers found',
    });
  }

  // Run keyword matcher
  const match = findMatchingTrigger(commentText, triggers);

  if (!match) {
    return NextResponse.json({
      matched: false,
      message: `No trigger matched for: "${commentText}"`,
      testedAgainst: triggers.map((t) => t.keyword),
    });
  }

  // Create test DM log
  const dmLog = await prisma.dmLog.create({
    data: {
      commentId: `test_${Date.now()}`,
      commentText,
      commenterIgId: `test_user_${Date.now()}`,
      commenterUsername: 'test_user',
      mediaId: '',
      dmMessageSent: match.trigger.responseMessage,
      status: 'QUEUED',
      isTest: true,
      accountId,
      triggerId: match.trigger.id,
    },
  });

  // Enqueue (but mark as test so worker can handle accordingly)
  const account = await prisma.instagramAccount.findUnique({
    where: { id: accountId },
  });

  if (account) {
    await dmQueue.add('send-dm', {
      dmLogId: dmLog.id,
      accountId,
      igUserId: account.igUserId,
      recipientIgId: `test_user_${Date.now()}`,
      message: match.trigger.responseMessage,
      accessToken: account.accessToken,
      isTest: true,
    });
  }

  return NextResponse.json({
    matched: true,
    trigger: {
      keyword: match.trigger.keyword,
      responseMessage: match.trigger.responseMessage,
    },
    dmLogId: dmLog.id,
    message: `✅ Matched trigger "${match.trigger.keyword}" — test DM queued`,
  });
}
