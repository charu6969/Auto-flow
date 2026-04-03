import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/session';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getInstagramUser,
  subscribeToInstagramWebhooks,
} from '@/services/instagram';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('[auth/callback] OAuth error:', error);
    return NextResponse.redirect(`${APP_URL}/login?error=oauth_denied`);
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/login?error=no_code`);
  }

  try {
    // 1. Exchange code for short-lived Instagram token
    const shortTokenRes = await exchangeCodeForToken(code);
    console.log('[auth/callback] Short-lived token obtained');

    // 2. Exchange for long-lived token (~60 days)
    const longTokenRes = await getLongLivedToken(shortTokenRes.access_token);
    const expiresInSeconds = longTokenRes.expires_in || 60 * 24 * 60 * 60;
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // 3. Validate required permissions are granted
    // Instagram Login returns granted permissions in the token response
    // We check by attempting to fetch user info — if it fails, permissions are missing
    const igUser = await getInstagramUser(longTokenRes.access_token);
    if (!igUser?.id || !igUser?.username) {
      console.error('[auth/callback] Could not fetch Instagram user info — check permissions');
      return NextResponse.redirect(`${APP_URL}/login?error=missing_permissions`);
    }

    console.log('[auth/callback] Instagram user:', igUser.username, '(', igUser.id, ')');

    // 4. Upsert user
    const user = await prisma.user.upsert({
      where: { email: `${igUser.username}@instagram.replybot` },
      update: { name: igUser.username },
      create: {
        email: `${igUser.username}@instagram.replybot`,
        name: igUser.username,
      },
    });

    // 5. Upsert Instagram account.
    // pageId is set to igUserId — the Instagram Login API doesn't use Facebook Pages.
    await prisma.instagramAccount.upsert({
      where: { igUserId: igUser.id },
      update: {
        igUsername: igUser.username,
        pageId: igUser.id,
        accessToken: longTokenRes.access_token,
        tokenExpiresAt,
        isActive: true,
      },
      create: {
        igUserId: igUser.id,
        igUsername: igUser.username,
        pageId: igUser.id,
        accessToken: longTokenRes.access_token,
        tokenExpiresAt,
        isActive: true,
        userId: user.id,
      },
    });

    // 6. Subscribe to Instagram webhook events (comments + messages)
    try {
      await subscribeToInstagramWebhooks(longTokenRes.access_token);
      console.log('[auth/callback] Subscribed to Instagram webhooks');
    } catch (err) {
      console.warn('[auth/callback] Webhook subscription warning (non-fatal):', err);
    }

    // 7. Create session
    const account = await prisma.instagramAccount.findUnique({
      where: { igUserId: igUser.id },
    });

    await createSession({
      userId: user.id,
      email: user.email,
      accountId: account?.id,
    });

    return NextResponse.redirect(`${APP_URL}/dashboard`);
  } catch (error) {
    console.error('[auth/callback] Error:', error);
    return NextResponse.redirect(`${APP_URL}/login?error=auth_failed`);
  }
}
