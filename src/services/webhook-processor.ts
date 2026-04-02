import { prisma } from '@/lib/prisma';
import { dmQueue } from '@/lib/queue';
import { findMatchingTrigger } from './keyword-matcher';
import { getCommentDetails } from './instagram';

interface WebhookCommentEvent {
  id: string; // comment ID
  text?: string;
  from?: { id: string; username?: string };
  media?: { id: string };
}

/**
 * Process an incoming Instagram comment webhook event:
 * 1. Find the Instagram account
 * 2. Get full comment details from the Graph API
 * 3. Run keyword matcher against active triggers
 * 4. Check for duplicate comments (Feature #8)
 * 5. Create DmLog and enqueue the DM job
 */
export async function processCommentWebhook(
  igUserId: string,
  event: WebhookCommentEvent
): Promise<void> {
  // 1. Find the account in DB
  const account = await prisma.instagramAccount.findUnique({
    where: { igUserId },
    include: { triggers: true },
  });

  if (!account || !account.isActive) {
    console.log(`[webhook] No active account for IG user ${igUserId}`);
    return;
  }

  // 2. Get full comment details (text, commenter info)
  let commentText = event.text || '';
  let commenterIgId = event.from?.id || '';
  let commenterUsername = event.from?.username || '';
  let mediaId = event.media?.id || '';

  if (!commentText || !commenterIgId) {
    try {
      const details = await getCommentDetails(event.id, account.accessToken);
      commentText = details.text || commentText;
      commenterIgId = details.from?.id || commenterIgId;
      commenterUsername = details.from?.username || commenterUsername;
      mediaId = details.media?.id || mediaId;
    } catch (err) {
      console.error(`[webhook] Failed to fetch comment details for ${event.id}:`, err);
      return;
    }
  }

  // Don't DM ourselves
  if (commenterIgId === account.igUserId) {
    return;
  }

  // 3. Find matching trigger
  const match = findMatchingTrigger(commentText, account.triggers, mediaId);
  if (!match) {
    console.log(`[webhook] No trigger match for comment: "${commentText}"`);
    return;
  }

  // 4. Duplicate comment protection (Feature #8)
  const existingLog = await prisma.dmLog.findUnique({
    where: {
      unique_dm_per_commenter_trigger_media: {
        commenterIgId,
        triggerId: match.trigger.id,
        mediaId: mediaId || '',
      },
    },
  });

  if (existingLog) {
    console.log(`[webhook] Duplicate detected for commenter ${commenterIgId}, trigger ${match.trigger.keyword}, media ${mediaId}. Skipping.`);
    return;
  }

  // 5. Create DM log entry
  const dmLog = await prisma.dmLog.create({
    data: {
      commentId: event.id,
      commentText,
      commenterIgId,
      commenterUsername,
      mediaId: mediaId || '',
      dmMessageSent: match.trigger.responseMessage,
      status: 'QUEUED',
      accountId: account.id,
      triggerId: match.trigger.id,
    },
  });

  // 6. Increment trigger match count
  await prisma.trigger.update({
    where: { id: match.trigger.id },
    data: { matchCount: { increment: 1 } },
  });

  // 7. Enqueue BullMQ job
  await dmQueue.add('send-dm', {
    dmLogId: dmLog.id,
    accountId: account.id,
    igUserId: account.igUserId,
    recipientIgId: commenterIgId,
    message: match.trigger.responseMessage,
    accessToken: account.accessToken,
    commentId: event.id, // Needed for Instagram Private Replies
  });

  console.log(`[webhook] Enqueued DM for comment "${commentText}" → trigger "${match.trigger.keyword}"`);
}
