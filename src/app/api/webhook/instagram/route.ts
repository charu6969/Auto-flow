import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processCommentWebhook } from '@/services/webhook-processor';

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN!;
const APP_SECRET = process.env.META_APP_SECRET!;

/**
 * GET — Webhook verification challenge from Meta
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[webhook] ✅ Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn('[webhook] ❌ Verification failed');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST — Receive comment events from Instagram
 * Includes HMAC-SHA256 signature verification (Feature #2)
 */
export async function POST(request: NextRequest) {
  // Feature #2: Verify webhook signature
  const signature = request.headers.get('x-hub-signature-256');
  const rawBody = await request.text();

  if (APP_SECRET && signature) {
    const expectedSignature =
      'sha256=' +
      crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');

    if (signature !== expectedSignature) {
      console.warn('[webhook] ❌ Invalid signature');
      console.warn('Expected:', expectedSignature);
      console.warn('Received:', signature);
      // In development, we'll let it pass to allow local testing
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }
  }

  try {
    const body = JSON.parse(rawBody);

    // Instagram webhook payload structure
    if (body.object !== 'instagram') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const entries = body.entry || [];

    for (const entry of entries) {
      const igUserId = entry.id;
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field === 'comments') {
          const comment = change.value;
          await processCommentWebhook(igUserId, {
            id: comment.id,
            text: comment.text,
            from: comment.from,
            media: comment.media,
          });
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[webhook] Error processing webhook:', error);
    return NextResponse.json({ received: true }, { status: 200 }); // Always 200 to Meta
  }
}
